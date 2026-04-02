'use strict';

const { MIN_ATTENDANCE_RATIO } = require('../../../../../src');
const {
  loadAcademicCalendar,
  toLocalIsoDate
} = require('../../../shared/services/academicCalendarService');
const { loadTimetable, normalizeSubjectName } = require('./timetableService');

const WEEKDAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MAX_RECOMMENDED_SLOTS = 5;
const BUNK_TIMING_PREFERENCE = {
  NONE: 'NONE',
  BEFORE_BREAK: 'BEFORE_BREAK',
  AFTER_BREAK: 'AFTER_BREAK'
};
const MULTI_BUNK_PREFERENCE = {
  NONE: 'NONE',
  CONSECUTIVE: 'CONSECUTIVE',
  ALONE: 'ALONE'
};

function calculateAttendanceRatio(attended, total) {
  if (!total) {
    return 0;
  }

  return attended / total;
}

function formatPercentage(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatSlotTitle(dateLabel, lectureNo, timeRange) {
  return `${dateLabel} | Lecture ${lectureNo} | ${timeRange}`;
}

function parseStartMinutes(timeRange) {
  const match = String(timeRange || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(am|pm)\s+to/i);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const meridiem = match[3].toLowerCase();

  if (meridiem === 'pm') {
    hours += 12;
  }

  return (hours * 60) + minutes;
}

function parseClockToMinutes(hoursText, minutesText, meridiemText) {
  let hours = Number(hoursText) % 12;
  const minutes = Number(minutesText);

  if (String(meridiemText || '').toLowerCase() === 'pm') {
    hours += 12;
  }

  return (hours * 60) + minutes;
}

function parseTimeRangeMinutes(timeRange) {
  const match = String(timeRange || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s+to\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);

  if (!match) {
    return null;
  }

  return {
    start_minutes: parseClockToMinutes(match[1], match[2], match[3]),
    end_minutes: parseClockToMinutes(match[4], match[5], match[6])
  };
}

function resolveBreakBoundary(daySchedule = {}) {
  const lectureEntries = Object.entries(daySchedule)
    .map(([lectureNo, timeRange]) => ({
      lecture_no: Number(lectureNo),
      parsed_range: parseTimeRangeMinutes(timeRange)
    }))
    .filter((entry) => Number.isFinite(entry.lecture_no))
    .sort((left, right) => left.lecture_no - right.lecture_no);

  if (lectureEntries.length < 2) {
    return null;
  }

  let breakAfterLectureNo = null;
  let largestGap = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < lectureEntries.length - 1; index += 1) {
    const currentLecture = lectureEntries[index];
    const nextLecture = lectureEntries[index + 1];

    if (!currentLecture.parsed_range || !nextLecture.parsed_range) {
      continue;
    }

    const gapMinutes =
      nextLecture.parsed_range.start_minutes - currentLecture.parsed_range.end_minutes;

    if (gapMinutes > largestGap) {
      largestGap = gapMinutes;
      breakAfterLectureNo = currentLecture.lecture_no;
    }
  }

  if (breakAfterLectureNo != null) {
    return breakAfterLectureNo;
  }

  return lectureEntries[Math.floor((lectureEntries.length - 1) / 2)].lecture_no;
}

function buildBreakBoundaryByWeekday(lectureTimes = {}) {
  return Object.fromEntries(
    Object.entries(lectureTimes).map(([weekdayKey, daySchedule]) => [
      weekdayKey,
      resolveBreakBoundary(daySchedule)
    ])
  );
}

function shouldIncludeLectureWindow(lectureNo, breakBoundary, bunkTimingPreference) {
  if (bunkTimingPreference === BUNK_TIMING_PREFERENCE.NONE || !Number.isFinite(breakBoundary)) {
    return true;
  }

  if (bunkTimingPreference === BUNK_TIMING_PREFERENCE.BEFORE_BREAK) {
    return lectureNo <= breakBoundary;
  }

  if (bunkTimingPreference === BUNK_TIMING_PREFERENCE.AFTER_BREAK) {
    return lectureNo > breakBoundary;
  }

  return true;
}

function compareChronologicalSlots(left, right) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  return left.lecture_no - right.lecture_no;
}

function compareScoredSlots(left, right) {
  if (right.minimum_future_ratio !== left.minimum_future_ratio) {
    return right.minimum_future_ratio - left.minimum_future_ratio;
  }

  if (right.average_future_ratio !== left.average_future_ratio) {
    return right.average_future_ratio - left.average_future_ratio;
  }

  return compareChronologicalSlots(left, right);
}

function getWeekdayKey(dateString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return WEEKDAY_KEYS[date.getDay()] || '';
}

function normalizeParticipants(participants = []) {
  return participants.map((participant) => ({
    ...participant,
    division: String(participant.division || '').trim().toUpperCase(),
    subjects: (participant.subjects || []).map((subject) => ({
      ...subject,
      subject_name: normalizeSubjectName(subject.subject_name),
      attended: Number(subject.attended || 0),
      total: Number(subject.total || 0)
    }))
  }));
}

function cloneParticipants(participants = []) {
  return participants.map((participant) => ({
    ...participant,
    subjects: participant.subjects.map((subject) => ({ ...subject }))
  }));
}

function getUpcomingInstructionalDates(calendarEvents, currentDateTime) {
  const currentDate = toLocalIsoDate(currentDateTime);
  const currentMinutes = (currentDateTime.getHours() * 60) + currentDateTime.getMinutes();

  return calendarEvents
    .filter((event) => event.instructional && event.date >= currentDate)
    .map((event) => ({
      ...event,
      is_today: event.date === currentDate,
      current_minutes: currentMinutes
    }));
}

function buildUpcomingLectureWindows(
  timetable,
  instructionalDates,
  bunkTimingPreference = BUNK_TIMING_PREFERENCE.NONE
) {
  const lectureWindows = [];
  const breakBoundaryByWeekday = buildBreakBoundaryByWeekday(timetable.lecture_times || {});

  instructionalDates.forEach((event) => {
    const weekdayKey = getWeekdayKey(event.date);
    const daySchedule = timetable.lecture_times?.[weekdayKey] || {};
    const breakBoundary = breakBoundaryByWeekday[weekdayKey];

    const orderedLectures = Object.entries(daySchedule)
      .map(([lectureNo, timeRange]) => ({
        lecture_no: Number(lectureNo),
        time_range: timeRange
      }))
      .filter((entry) => Number.isFinite(entry.lecture_no))
      .sort((left, right) => left.lecture_no - right.lecture_no);

    orderedLectures.forEach((lecture) => {
      const lectureNumber = lecture.lecture_no;
      const timeRange = lecture.time_range;

      if (event.is_today && parseStartMinutes(timeRange) <= event.current_minutes) {
        return;
      }

      if (!shouldIncludeLectureWindow(lectureNumber, breakBoundary, bunkTimingPreference)) {
        return;
      }

      lectureWindows.push({
        date: event.date,
        date_label: event.label,
        weekday: weekdayKey,
        lecture_no: lectureNumber,
        time_range: timeRange,
        calendar_description: event.description || 'Regular Teaching'
      });
    });
  });

  return lectureWindows.sort(compareChronologicalSlots);
}

function evaluateSharedLectureWindow(lectureWindow, participants, timetable) {
  const participantSummaries = [];

  for (const participant of participants) {
    if (!participant.division) {
      return null;
    }

    const lectureSlot =
      timetable.schedule?.[participant.division]?.[lectureWindow.weekday]?.[String(lectureWindow.lecture_no)];

    if (!lectureSlot?.subject_name) {
      return null;
    }

    const trackedSubject = participant.subjects.find(
      (subject) => subject.subject_name === normalizeSubjectName(lectureSlot.subject_name)
    );

    if (!trackedSubject) {
      return null;
    }

    const beforeRatio = calculateAttendanceRatio(trackedSubject.attended, trackedSubject.total);
    const afterRatio = calculateAttendanceRatio(trackedSubject.attended, trackedSubject.total + 1);

    if (afterRatio < MIN_ATTENDANCE_RATIO) {
      return null;
    }

    participantSummaries.push({
      user_id: participant.id,
      name: participant.name,
      division: participant.division,
      subject_name: trackedSubject.subject_name,
      lecture_subject_name: normalizeSubjectName(lectureSlot.subject_name),
      room_no: lectureSlot.room_no,
      faculty_code: lectureSlot.faculty_code,
      attended: trackedSubject.attended,
      total: trackedSubject.total,
      before_attendance: formatPercentage(beforeRatio),
      after_attendance: formatPercentage(afterRatio),
      before_ratio: beforeRatio,
      after_ratio: afterRatio
    });
  }

  const minimumFutureRatio = Math.min(
    ...participantSummaries.map((participant) => participant.after_ratio)
  );
  const averageFutureRatio =
    participantSummaries.reduce((sum, participant) => sum + participant.after_ratio, 0) /
    participantSummaries.length;

  return {
    ...lectureWindow,
    title: formatSlotTitle(
      lectureWindow.date_label,
      lectureWindow.lecture_no,
      lectureWindow.time_range
    ),
    participants: participantSummaries,
    minimum_future_ratio: minimumFutureRatio,
    average_future_ratio: averageFutureRatio
  };
}

function applyLectureWindow(candidate, participants) {
  candidate.participants.forEach((candidateParticipant) => {
    const currentParticipant = participants.find(
      (participant) => participant.id === candidateParticipant.user_id
    );

    if (!currentParticipant) {
      return;
    }

    const subject = currentParticipant.subjects.find(
      (item) => item.subject_name === candidateParticipant.subject_name
    );

    if (subject) {
      subject.total += 1;
    }
  });
}

function areConsecutiveLectures(left, right) {
  return (
    left.date === right.date &&
    right.lecture_no === left.lecture_no + 1
  );
}

function areAdjacentLectures(left, right) {
  return (
    left.date === right.date &&
    Math.abs(left.lecture_no - right.lecture_no) === 1
  );
}

function buildSequentialRecommendations({
  lectureWindows,
  participants,
  timetable,
  recommendationLimit,
  multiBunkPreference
}) {
  const simulatedParticipants = cloneParticipants(participants);
  const recommendedSlots = [];

  for (const lectureWindow of lectureWindows) {
    if (recommendedSlots.length >= recommendationLimit) {
      break;
    }

    const candidate = evaluateSharedLectureWindow(
      lectureWindow,
      simulatedParticipants,
      timetable
    );

    if (!candidate) {
      continue;
    }

    if (
      multiBunkPreference === MULTI_BUNK_PREFERENCE.ALONE &&
      recommendedSlots.some((slot) => areAdjacentLectures(slot, candidate))
    ) {
      continue;
    }

    recommendedSlots.push(candidate);
    applyLectureWindow(candidate, simulatedParticipants);
  }

  return recommendedSlots;
}

function buildConsecutiveRecommendations({
  lectureWindows,
  participants,
  timetable,
  recommendationLimit
}) {
  let bestRun = [];

  for (let startIndex = 0; startIndex < lectureWindows.length; startIndex += 1) {
    const simulatedParticipants = cloneParticipants(participants);
    const run = [];
    let previousLecture = null;

    for (let currentIndex = startIndex; currentIndex < lectureWindows.length; currentIndex += 1) {
      const currentLecture = lectureWindows[currentIndex];

      if (previousLecture && !areConsecutiveLectures(previousLecture, currentLecture)) {
        break;
      }

      const candidate = evaluateSharedLectureWindow(
        currentLecture,
        simulatedParticipants,
        timetable
      );

      if (!candidate) {
        break;
      }

      run.push(candidate);
      applyLectureWindow(candidate, simulatedParticipants);
      previousLecture = currentLecture;

      if (run.length >= recommendationLimit) {
        return run;
      }
    }

    if (run.length > bestRun.length) {
      bestRun = run;
    }
  }

  return bestRun;
}

function buildSharedBunkRecommendations({
  participants,
  timetable,
  calendarEvents,
  currentDateTime,
  bunkCount,
  bunkTimingPreference = BUNK_TIMING_PREFERENCE.NONE,
  multiBunkPreference = MULTI_BUNK_PREFERENCE.NONE
}) {
  const normalizedParticipants = normalizeParticipants(participants);

  if (!normalizedParticipants.length) {
    return {
      timetable: { file_name: timetable.file_name },
      best_shared_lecture: null,
      next_shared_lecture: null,
      recommended_slots: []
    };
  }

  const participantsMissingDivision = normalizedParticipants.some(
    (participant) => !participant.division
  );

  if (participantsMissingDivision) {
    throw new Error(
      'Each selected user must be linked to an imported attendance profile with a division before schedule recommendations can be generated.'
    );
  }

  const instructionalDates = getUpcomingInstructionalDates(calendarEvents, currentDateTime);
  const lectureWindows = buildUpcomingLectureWindows(
    timetable,
    instructionalDates,
    bunkTimingPreference
  );
  const initialCandidates = lectureWindows
    .map((lectureWindow) =>
      evaluateSharedLectureWindow(lectureWindow, normalizedParticipants, timetable)
    )
    .filter(Boolean);
  const recommendationLimit = Math.max(1, Math.min(bunkCount, MAX_RECOMMENDED_SLOTS));
  const recommendedSlots =
    multiBunkPreference === MULTI_BUNK_PREFERENCE.CONSECUTIVE && recommendationLimit >= 2
      ? buildConsecutiveRecommendations({
          lectureWindows,
          participants: normalizedParticipants,
          timetable,
          recommendationLimit
        })
      : buildSequentialRecommendations({
          lectureWindows,
          participants: normalizedParticipants,
          timetable,
          recommendationLimit,
          multiBunkPreference
        });

  const bestSharedLecture = [...initialCandidates].sort(compareScoredSlots)[0] || null;

  return {
    timetable: {
      file_name: timetable.file_name,
      effective_from: timetable.effective_from,
      divisions: timetable.divisions
    },
    best_shared_lecture: bestSharedLecture,
    next_shared_lecture: recommendedSlots[0] || null,
    recommended_slots: recommendedSlots
  };
}

async function loadSharedBunkRecommendations(
  participants,
  bunkCount = 1,
  bunkTimingPreference = BUNK_TIMING_PREFERENCE.NONE,
  multiBunkPreference = MULTI_BUNK_PREFERENCE.NONE
) {
  const [calendar, timetable] = await Promise.all([
    loadAcademicCalendar(),
    loadTimetable()
  ]);

  return buildSharedBunkRecommendations({
    participants,
    timetable,
    calendarEvents: calendar.events || [],
    currentDateTime: new Date(),
    bunkCount,
    bunkTimingPreference,
    multiBunkPreference
  });
}

module.exports = {
  buildSharedBunkRecommendations,
  loadSharedBunkRecommendations
};
