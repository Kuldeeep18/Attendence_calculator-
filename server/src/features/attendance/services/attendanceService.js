'use strict';

const { env, getAdminEmails } = require('../../../config/env');
const attendanceRepository = require('../../../shared/services/attendanceRepository');
const {
  getPendingAcademicDates,
  loadAcademicCalendar,
  toLocalIsoDate
} = require('../../../shared/services/academicCalendarService');
const {
  loadTimetable,
  normalizeSubjectName
} = require('../../planner/services/timetableService');
const {
  DEFAULT_SUBJECT_ORDER,
  parseWeeklyAttendancePdf
} = require('./weeklyAttendanceParser');

const WEEKDAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function canImportWeeklyAttendance(authUser) {
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return env.NODE_ENV !== 'production';
  }

  return Boolean(
    authUser.email && adminEmails.includes(authUser.email.trim().toLowerCase())
  );
}

function normalizeEnrollmentNo(enrollmentNo) {
  const normalized = String(enrollmentNo || '').trim();

  if (!/^\d{12,14}$/.test(normalized)) {
    throw createServiceError(
      'Enter the enrollment number exactly as it appears in the weekly PDF.',
      400
    );
  }

  return normalized;
}

function normalizeAttendanceDate(attendanceDate) {
  const normalized = String(attendanceDate || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createServiceError('attendanceDate must be in YYYY-MM-DD format.', 400);
  }

  return normalized;
}

function normalizeDailyEntries(entries, allowedSubjectNames) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw createServiceError('Add at least one subject in the daily attendance update.', 400);
  }

  const allowedSubjects = new Set(allowedSubjectNames);
  const normalizedEntries = [];
  const seenSubjects = new Set();

  entries.forEach((entry) => {
    const subjectName = String(entry.subject_name || '').trim();

    if (!subjectName) {
      throw createServiceError('Each daily attendance entry needs a subject name.', 400);
    }

    if (seenSubjects.has(subjectName)) {
      throw createServiceError(`Duplicate daily attendance entry for ${subjectName}.`, 400);
    }

    if (allowedSubjects.size > 0 && !allowedSubjects.has(subjectName)) {
      throw createServiceError(
        `${subjectName} is not part of the current imported subject list.`,
        400
      );
    }

    const hasLectureCounts =
      entry.held_lectures != null ||
      entry.attended_lectures != null ||
      entry.proxy_lectures != null;

    const heldLectures = hasLectureCounts
      ? normalizeLectureCount(entry.held_lectures, `${subjectName} held lectures`)
      : Number(Boolean(entry.was_class_held));
    const attendedLectures = hasLectureCounts
      ? normalizeLectureCount(entry.attended_lectures, `${subjectName} attended lectures`)
      : Number(Boolean(entry.was_present));
    const proxyLectures = hasLectureCounts
      ? normalizeLectureCount(entry.proxy_lectures, `${subjectName} proxy lectures`, 0)
      : 0;

    if (attendedLectures > heldLectures) {
      throw createServiceError(
        `Attended lectures cannot be greater than held lectures (${subjectName}).`,
        400
      );
    }

    if (proxyLectures > attendedLectures) {
      throw createServiceError(
        `Proxy lectures cannot be greater than attended lectures (${subjectName}).`,
        400
      );
    }

    seenSubjects.add(subjectName);
    normalizedEntries.push({
      subject_name: subjectName,
      held_lectures: heldLectures,
      attended_lectures: attendedLectures,
      proxy_lectures: proxyLectures,
      was_class_held: heldLectures > 0,
      was_present: attendedLectures > 0
    });
  });

  return normalizedEntries;
}

function normalizeLectureCount(value, fieldLabel, fallbackValue = null) {
  const normalized =
    value == null || value === ''
      ? fallbackValue
      : Number(value);

  if (!Number.isInteger(normalized) || normalized < 0) {
    throw createServiceError(
      `${fieldLabel} must be a whole number greater than or equal to 0.`,
      400
    );
  }

  return normalized;
}

function resolveAttendancePercentage(snapshot, subjectTotals) {
  const overallPercentage =
    snapshot.linked_student?.overall_percentage == null
      ? null
      : Number(snapshot.linked_student.overall_percentage);

  if (Number.isFinite(overallPercentage)) {
    return `${overallPercentage.toFixed(2)}%`;
  }

  const totalAttended =
    snapshot.linked_student?.total_attended == null
      ? null
      : Number(snapshot.linked_student.total_attended);
  const totalConducted =
    snapshot.linked_student?.total_conducted == null
      ? null
      : Number(snapshot.linked_student.total_conducted);

  if (Number.isFinite(totalAttended) && Number.isFinite(totalConducted) && totalConducted > 0) {
    return `${((totalAttended / totalConducted) * 100).toFixed(2)}%`;
  }

  return subjectTotals.total
    ? `${((subjectTotals.attended / subjectTotals.total) * 100).toFixed(2)}%`
    : null;
}

function normalizeImportDate(dateValue) {
  const normalized = String(dateValue || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function formatLocalIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function parseWeekNumber(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/\bweek[\s:_-]*0*(\d{1,2})\b/i);

  if (!match) {
    return null;
  }

  const weekNumber = Number(match[1]);

  return Number.isInteger(weekNumber) && weekNumber > 0 ? weekNumber : null;
}

function getWeekdayKeyFromDate(dateString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return WEEKDAY_KEYS[date.getDay()] || '';
}

async function buildTimetableLectureHints({
  pendingDates,
  division,
  availableSubjects
}) {
  if (!Array.isArray(pendingDates) || pendingDates.length === 0 || !division) {
    return {};
  }

  const timetable = await loadTimetable();
  const normalizedDivision = String(division || '').trim().toUpperCase();
  const divisionSchedule = timetable.schedule?.[normalizedDivision];

  if (!divisionSchedule) {
    return {};
  }

  const normalizedSubjectMap = new Map(
    (availableSubjects || []).map((subjectName) => [
      normalizeSubjectName(subjectName),
      subjectName
    ])
  );
  const lectureHints = {};

  pendingDates.forEach((pendingDate) => {
    const weekdayKey = getWeekdayKeyFromDate(pendingDate.date);
    const daySchedule = divisionSchedule?.[weekdayKey] || {};
    const subjectLectureCounts = Object.fromEntries(
      (availableSubjects || []).map((subjectName) => [subjectName, 0])
    );

    Object.values(daySchedule).forEach((lectureSlot) => {
      const normalizedSubject = normalizeSubjectName(lectureSlot?.subject_name || '');
      const subjectName =
        normalizedSubjectMap.get(normalizedSubject) || normalizedSubject;

      if (!subjectName) {
        return;
      }

      subjectLectureCounts[subjectName] = (subjectLectureCounts[subjectName] || 0) + 1;
    });

    lectureHints[pendingDate.date] = subjectLectureCounts;
  });

  return lectureHints;
}

function toWeekStartDate(dateString) {
  const normalizedDate = normalizeImportDate(dateString);

  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Shift to Monday for stable academic week buckets.
  const daysFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);

  return formatLocalIsoDate(date);
}

function resolveCoverageDateFromWeekNumber(calendarEvents, weekNumber) {
  if (!Array.isArray(calendarEvents) || !weekNumber) {
    return null;
  }

  const instructionalWeekMap = new Map();

  calendarEvents
    .filter((event) => event?.instructional && normalizeImportDate(event.date))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    .forEach((event) => {
      const weekKey = toWeekStartDate(event.date);

      if (!weekKey) {
        return;
      }

      const currentWeekEnd = instructionalWeekMap.get(weekKey);

      if (!currentWeekEnd || event.date > currentWeekEnd) {
        instructionalWeekMap.set(weekKey, event.date);
      }
    });

  const weekEndDates = [...instructionalWeekMap.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, weekEndDate]) => weekEndDate);

  return weekEndDates[weekNumber - 1] || null;
}

async function resolveLatestWeeklyUploadDate(latestImport) {
  if (!latestImport) {
    return null;
  }

  const weekNumber =
    parseWeekNumber(latestImport.week_label) ||
    parseWeekNumber(latestImport.file_name);

  if (weekNumber && typeof loadAcademicCalendar === 'function') {
    try {
      const calendar = await loadAcademicCalendar();
      const weekCoverageDate = resolveCoverageDateFromWeekNumber(
        calendar?.events || [],
        weekNumber
      );

      if (weekCoverageDate) {
        return weekCoverageDate;
      }
    } catch {
      // Fall back to import date fields if calendar resolution fails.
    }
  }

  // Prefer the weekly coverage end date from the PDF range (Date: X To Y).
  // Some sheets have a later report/export date that should not shift pending-day start.
  const endDate = normalizeImportDate(latestImport.end_date);
  if (endDate) {
    return endDate;
  }

  const reportDate = normalizeImportDate(latestImport.report_date);
  if (reportDate) {
    return reportDate;
  }

  const startDate = normalizeImportDate(latestImport.start_date);
  if (startDate) {
    return startDate;
  }

  if (!latestImport.created_at) {
    return null;
  }

  const createdAt = new Date(latestImport.created_at);
  return Number.isNaN(createdAt.getTime()) ? null : toLocalIsoDate(createdAt);
}

async function buildDashboardResponse(snapshot, authUser) {
  const availableSubjects = snapshot.subjects.length
    ? snapshot.subjects.map((subject) => subject.subject_name)
    : [...DEFAULT_SUBJECT_ORDER];
  const totals = snapshot.subjects.reduce(
    (summary, subject) => {
      summary.attended += subject.attended;
      summary.total += subject.total;
      return summary;
    },
    { attended: 0, total: 0 }
  );
  const currentDate = toLocalIsoDate(new Date());
  const lastWeeklyUploadDate = await resolveLatestWeeklyUploadDate(
    snapshot.linked_student?.latest_import || null
  );
  let calendarStatus = { calendar: null, pending_dates: [] };
  let academicCalendarError = null;
  let timetableLectureHints = {};
  let timetableError = null;

  if (lastWeeklyUploadDate) {
    try {
      calendarStatus = await getPendingAcademicDates({
        fromDate: lastWeeklyUploadDate,
        toDate: currentDate,
        submittedDates: snapshot.submitted_daily_dates || []
      });
    } catch (error) {
      academicCalendarError = error.message;
    }
  }

  if (calendarStatus.pending_dates.length > 0) {
    try {
      timetableLectureHints = await buildTimetableLectureHints({
        pendingDates: calendarStatus.pending_dates,
        division: snapshot.linked_student?.division || null,
        availableSubjects
      });
    } catch (error) {
      timetableError = error.message;
    }
  }

  return {
    ...snapshot,
    attendance_percentage: resolveAttendancePercentage(snapshot, totals),
    available_subjects: availableSubjects,
    can_import_weekly: canImportWeeklyAttendance(authUser),
    current_date: currentDate,
    last_weekly_upload_date: lastWeeklyUploadDate,
    academic_calendar: calendarStatus.calendar,
    academic_calendar_error: academicCalendarError,
    timetable_lecture_hints: timetableLectureHints,
    timetable_error: timetableError,
    pending_attendance_dates: calendarStatus.pending_dates
  };
}

async function getAttendanceDashboard(authUser) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const snapshot = await attendanceRepository.getCurrentAttendanceSnapshot(currentProfile.id);
  return buildDashboardResponse(snapshot, authUser);
}

async function linkStudentProfile(authUser, payload = {}) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const enrollmentNo = normalizeEnrollmentNo(payload.enrollmentNo);
  const snapshot = await attendanceRepository.linkProfileToStudent(
    currentProfile.id,
    enrollmentNo
  );

  return buildDashboardResponse(snapshot, authUser);
}

async function importWeeklyAttendance(authUser, files) {
  if (!canImportWeeklyAttendance(authUser)) {
    throw createServiceError(
      'This account is not allowed to upload the weekly attendance PDFs.',
      403
    );
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw createServiceError('Upload one or more weekly attendance PDFs.', 400);
  }

  const invalidFile = files.find(
    (file) => !String(file.originalname || '').toLowerCase().endsWith('.pdf')
  );

  if (invalidFile) {
    throw createServiceError('Only PDF files can be used for the weekly attendance import.', 400);
  }

  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const parsedImports = [];

  for (const file of files) {
    parsedImports.push(await parseWeeklyAttendancePdf(file.buffer, file.originalname));
  }

  const savedImports = [];
  for (const parsedImport of parsedImports) {
    savedImports.push(
      await attendanceRepository.saveWeeklyImport(currentProfile.id, parsedImport)
    );
  }

  return {
    imports: savedImports,
    total_files: savedImports.length,
    total_students: savedImports.reduce(
      (count, currentImport) => count + currentImport.student_count,
      0
    ),
    subject_order: [...DEFAULT_SUBJECT_ORDER]
  };
}

async function assertPendingDailyAttendanceDate(snapshot, attendanceDate) {
  const lastWeeklyUploadDate = await resolveLatestWeeklyUploadDate(
    snapshot.linked_student?.latest_import || null
  );

  if (!lastWeeklyUploadDate) {
    throw createServiceError(
      'Import a weekly attendance PDF and link your enrollment before saving daily attendance.',
      400
    );
  }

  let calendarStatus;

  try {
    calendarStatus = await getPendingAcademicDates({
      fromDate: lastWeeklyUploadDate,
      toDate: toLocalIsoDate(new Date()),
      submittedDates: snapshot.submitted_daily_dates || []
    });
  } catch (error) {
    throw createServiceError(error.message, error.status || 400);
  }

  const pendingDateSet = new Set(
    calendarStatus.pending_dates.map((pendingDate) => pendingDate.date)
  );

  if (!pendingDateSet.has(attendanceDate)) {
    throw createServiceError(
      'Daily attendance can only be submitted for pending regular teaching dates after the latest weekly coverage date.',
      400
    );
  }
}

async function submitDailyAttendance(authUser, payload = {}) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const snapshot = await attendanceRepository.getCurrentAttendanceSnapshot(currentProfile.id);
  const attendanceDate = normalizeAttendanceDate(payload.attendanceDate);
  const normalizedEntries = normalizeDailyEntries(
    payload.entries,
    snapshot.subjects.length
      ? snapshot.subjects.map((subject) => subject.subject_name)
      : DEFAULT_SUBJECT_ORDER
  );
  await assertPendingDailyAttendanceDate(snapshot, attendanceDate);

  const updatedSnapshot = await attendanceRepository.applyDailyAttendance(
    currentProfile.id,
    attendanceDate,
    normalizedEntries
  );

  return buildDashboardResponse(updatedSnapshot, authUser);
}

module.exports = {
  getAttendanceDashboard,
  importWeeklyAttendance,
  linkStudentProfile,
  submitDailyAttendance
};
