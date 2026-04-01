'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../server/src/services/attendanceService');
const repositoryPath = require.resolve('../server/src/services/attendanceRepository');
const calendarPath = require.resolve('../server/src/services/academicCalendarService');

function loadAttendanceService({ repositoryMock, calendarMock }) {
  const originalService = require.cache[servicePath];
  const originalRepository = require.cache[repositoryPath];
  const originalCalendar = require.cache[calendarPath];

  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: repositoryMock
  };
  require.cache[calendarPath] = {
    id: calendarPath,
    filename: calendarPath,
    loaded: true,
    exports: calendarMock
  };

  delete require.cache[servicePath];

  return {
    attendanceService: require(servicePath),
    restore() {
      delete require.cache[servicePath];

      if (originalService) {
        require.cache[servicePath] = originalService;
      }

      if (originalRepository) {
        require.cache[repositoryPath] = originalRepository;
      } else {
        delete require.cache[repositoryPath];
      }

      if (originalCalendar) {
        require.cache[calendarPath] = originalCalendar;
      } else {
        delete require.cache[calendarPath];
      }
    }
  };
}

test('submitDailyAttendance rejects non-pending dates such as exam days', async () => {
  let applyCalled = false;
  const snapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        report_date: '2026-03-28'
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };
  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot,
      applyDailyAttendance: async () => {
        applyCalled = true;
        return snapshot;
      }
    },
    calendarMock: {
      getPendingAcademicDates: async () => ({
        calendar: { file_name: 'calendar.pdf', instructional_event_count: 1 },
        pending_dates: [
          {
            date: '2026-03-31',
            label: 'Tue, Mar 31, 2026',
            description: 'Regular Teaching'
          }
        ]
      }),
      toLocalIsoDate: () => '2026-04-01'
    }
  });

  try {
    await assert.rejects(
      () =>
        attendanceService.submitDailyAttendance(
          { uid: 'user-1', email: 'student@example.com', name: 'Student' },
          {
            attendanceDate: '2026-04-01',
            entries: [
              {
                subject_name: 'COA',
                was_class_held: true,
                was_present: true
              }
            ]
          }
        ),
      {
        message:
          'Daily attendance can only be submitted for pending regular teaching dates after the latest weekly upload.'
      }
    );

    assert.equal(applyCalled, false);
  } finally {
    restore();
  }
});

test('submitDailyAttendance accepts a pending regular teaching date', async () => {
  let appliedPayload = null;
  const initialSnapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        report_date: '2026-03-28',
        file_name: 'week-03.pdf'
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };
  const updatedSnapshot = {
    ...initialSnapshot,
    subjects: [{ subject_name: 'COA', attended: 11, total: 13 }],
    submitted_daily_dates: ['2026-03-31']
  };
  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => initialSnapshot,
      applyDailyAttendance: async (profileId, attendanceDate, entries) => {
        appliedPayload = { profileId, attendanceDate, entries };
        return updatedSnapshot;
      }
    },
    calendarMock: {
      getPendingAcademicDates: async ({ submittedDates = [] }) => ({
        calendar: { file_name: 'calendar.pdf', instructional_event_count: 1 },
        pending_dates: submittedDates.includes('2026-03-31')
          ? []
          : [
              {
                date: '2026-03-31',
                label: 'Tue, Mar 31, 2026',
                description: 'Regular Teaching'
              }
            ]
      }),
      toLocalIsoDate: () => '2026-04-01'
    }
  });

  try {
    const result = await attendanceService.submitDailyAttendance(
      { uid: 'user-1', email: 'student@example.com', name: 'Student' },
      {
        attendanceDate: '2026-03-31',
        entries: [
          {
            subject_name: 'COA',
            was_class_held: true,
            was_present: true
          }
        ]
      }
    );

    assert.deepEqual(appliedPayload, {
      profileId: 'profile-1',
      attendanceDate: '2026-03-31',
      entries: [
        {
          subject_name: 'COA',
          was_class_held: true,
          was_present: true
        }
      ]
    });
    assert.equal(result.attendance_percentage, '84.62%');
    assert.deepEqual(result.pending_attendance_dates, []);
  } finally {
    restore();
  }
});
