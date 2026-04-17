'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../server/src/features/attendance/services/attendanceService');
const repositoryPath = require.resolve('../server/src/shared/services/attendanceRepository');
const calendarPath = require.resolve('../server/src/shared/services/academicCalendarService');
const timetablePath = require.resolve('../server/src/features/planner/services/timetableService');

function loadAttendanceService({ repositoryMock, calendarMock, timetableMock }) {
  const originalService = require.cache[servicePath];
  const originalRepository = require.cache[repositoryPath];
  const originalCalendar = require.cache[calendarPath];
  const originalTimetable = require.cache[timetablePath];

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
  require.cache[timetablePath] = {
    id: timetablePath,
    filename: timetablePath,
    loaded: true,
    exports:
      timetableMock || {
        loadTimetable: async () => ({ schedule: {} }),
        normalizeSubjectName: (subjectName) => subjectName
      }
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

      if (originalTimetable) {
        require.cache[timetablePath] = originalTimetable;
      } else {
        delete require.cache[timetablePath];
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
          'Daily attendance can only be submitted for pending regular teaching dates after the latest weekly coverage date.'
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
          held_lectures: 1,
          attended_lectures: 1,
          proxy_lectures: 0,
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

test('submitDailyAttendance supports multiple attended lectures with proxy count', async () => {
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

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => initialSnapshot,
      applyDailyAttendance: async (profileId, attendanceDate, entries) => {
        appliedPayload = { profileId, attendanceDate, entries };
        return initialSnapshot;
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
    await attendanceService.submitDailyAttendance(
      { uid: 'user-1', email: 'student@example.com', name: 'Student' },
      {
        attendanceDate: '2026-03-31',
        entries: [
          {
            subject_name: 'COA',
            held_lectures: 2,
            attended_lectures: 2,
            proxy_lectures: 1
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
          held_lectures: 2,
          attended_lectures: 2,
          proxy_lectures: 1,
          was_class_held: true,
          was_present: true
        }
      ]
    });
  } finally {
    restore();
  }
});

test('submitDailyAttendance rejects proxy lectures greater than attended lectures', async () => {
  const snapshot = {
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

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot,
      applyDailyAttendance: async () => snapshot
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
            attendanceDate: '2026-03-31',
            entries: [
              {
                subject_name: 'COA',
                held_lectures: 2,
                attended_lectures: 1,
                proxy_lectures: 2
              }
            ]
          }
        ),
      {
        message: 'Proxy lectures cannot be greater than attended lectures (COA).'
      }
    );
  } finally {
    restore();
  }
});

test('getAttendanceDashboard prefers linked student aggregate overall percentage', async () => {
  const snapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      total_attended: 53,
      total_conducted: 66,
      overall_percentage: 80.2,
      latest_import: null
    },
    subjects: [
      { subject_name: 'COA', attended: 14, total: 16 },
      { subject_name: 'DM', attended: 8, total: 10 },
      { subject_name: 'FSD-2', attended: 7, total: 12 },
      { subject_name: 'PYTHON-2', attended: 9, total: 12 },
      { subject_name: 'TOC', attended: 14, total: 16 }
    ],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot
    },
    calendarMock: {
      getPendingAcademicDates: async () => ({ calendar: null, pending_dates: [] }),
      toLocalIsoDate: () => '2026-04-01'
    }
  });

  try {
    const result = await attendanceService.getAttendanceDashboard({
      uid: 'user-1',
      email: 'student@example.com',
      name: 'Student'
    });

    assert.equal(result.attendance_percentage, '80.20%');
  } finally {
    restore();
  }
});

test('getAttendanceDashboard falls back to latest import created_at when report_date is missing', async () => {
  const importCreatedAt = '2026-04-16T07:42:36.109Z';
  let pendingDatesRequest = null;
  const snapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        report_date: null,
        start_date: null,
        end_date: null,
        created_at: importCreatedAt
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot
    },
    calendarMock: {
      getPendingAcademicDates: async (request) => {
        pendingDatesRequest = request;
        return {
          calendar: {
            file_name: 'SEM-4_Academic Calendar 2026_SY_CE.pdf',
            instructional_event_count: 81
          },
          pending_dates: []
        };
      },
      toLocalIsoDate: (date) => {
        if (date instanceof Date && date.getTime() === Date.parse(importCreatedAt)) {
          return '2026-04-16';
        }

        return '2026-04-20';
      }
    }
  });

  try {
    const result = await attendanceService.getAttendanceDashboard({
      uid: 'user-1',
      email: 'student@example.com',
      name: 'Student'
    });

    assert.equal(result.last_weekly_upload_date, '2026-04-16');
    assert.equal(
      result.academic_calendar?.file_name,
      'SEM-4_Academic Calendar 2026_SY_CE.pdf'
    );
    assert.deepEqual(pendingDatesRequest, {
      fromDate: '2026-04-16',
      toDate: '2026-04-20',
      submittedDates: []
    });
  } finally {
    restore();
  }
});

test('submitDailyAttendance uses latest import created_at when report_date is missing', async () => {
  const importCreatedAt = '2026-03-30T08:15:00.000Z';
  let pendingFromDate = null;
  let applyCalled = false;
  const initialSnapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        report_date: null,
        start_date: null,
        end_date: null,
        created_at: importCreatedAt,
        file_name: 'week-04.pdf'
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => initialSnapshot,
      applyDailyAttendance: async () => {
        applyCalled = true;
        return initialSnapshot;
      }
    },
    calendarMock: {
      getPendingAcademicDates: async ({ fromDate }) => {
        pendingFromDate = fromDate;

        return {
          calendar: { file_name: 'calendar.pdf', instructional_event_count: 1 },
          pending_dates: [
            {
              date: '2026-03-31',
              label: 'Tue, Mar 31, 2026',
              description: 'Regular Teaching'
            }
          ]
        };
      },
      toLocalIsoDate: (date) => {
        if (date instanceof Date && date.getTime() === Date.parse(importCreatedAt)) {
          return '2026-03-30';
        }

        return '2026-04-01';
      }
    }
  });

  try {
    await attendanceService.submitDailyAttendance(
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

    assert.equal(pendingFromDate, '2026-03-30');
    assert.equal(applyCalled, true);
  } finally {
    restore();
  }
});

test('getAttendanceDashboard prefers latest import end_date over report_date', async () => {
  let pendingDatesRequest = null;
  const snapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        report_date: '2026-04-16',
        start_date: '2026-04-07',
        end_date: '2026-04-12',
        created_at: '2026-04-16T07:42:36.109Z'
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot
    },
    calendarMock: {
      getPendingAcademicDates: async (request) => {
        pendingDatesRequest = request;
        return {
          calendar: {
            file_name: 'SEM-4_Academic Calendar 2026_SY_CE.pdf',
            instructional_event_count: 81
          },
          pending_dates: []
        };
      },
      toLocalIsoDate: () => '2026-04-20'
    }
  });

  try {
    const result = await attendanceService.getAttendanceDashboard({
      uid: 'user-1',
      email: 'student@example.com',
      name: 'Student'
    });

    assert.equal(result.last_weekly_upload_date, '2026-04-12');
    assert.deepEqual(pendingDatesRequest, {
      fromDate: '2026-04-12',
      toDate: '2026-04-20',
      submittedDates: []
    });
  } finally {
    restore();
  }
});

test('getAttendanceDashboard derives cutoff from week number using academic calendar', async () => {
  let pendingDatesRequest = null;
  const snapshot = {
    profile: { id: 'profile-1', student_id: 'student-1' },
    linked_student: {
      id: 'student-1',
      latest_import: {
        week_label: 'Week 04',
        file_name: 'SY2_Weekly_Compile_Attendance_Sem-4_2026_Week 04.pdf',
        report_date: '2026-04-17',
        start_date: null,
        end_date: null,
        created_at: '2026-04-17T07:42:36.109Z'
      }
    },
    subjects: [{ subject_name: 'COA', attended: 10, total: 12 }],
    recent_daily_logs: [],
    submitted_daily_dates: []
  };

  const instructionalDates = [
    '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21',
    '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28',
    '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04',
    '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11'
  ];

  const { attendanceService, restore } = loadAttendanceService({
    repositoryMock: {
      ensureProfile: async () => ({ id: 'profile-1' }),
      getCurrentAttendanceSnapshot: async () => snapshot
    },
    calendarMock: {
      loadAcademicCalendar: async () => ({
        file_name: 'SEM-4_Academic Calendar 2026_SY_CE.pdf',
        events: instructionalDates.map((date) => ({ date, instructional: true }))
      }),
      getPendingAcademicDates: async (request) => {
        pendingDatesRequest = request;
        return {
          calendar: {
            file_name: 'SEM-4_Academic Calendar 2026_SY_CE.pdf',
            instructional_event_count: instructionalDates.length
          },
          pending_dates: []
        };
      },
      toLocalIsoDate: () => '2026-04-20'
    }
  });

  try {
    const result = await attendanceService.getAttendanceDashboard({
      uid: 'user-1',
      email: 'student@example.com',
      name: 'Student'
    });

    assert.equal(result.last_weekly_upload_date, '2026-04-11');
    assert.deepEqual(pendingDatesRequest, {
      fromDate: '2026-04-11',
      toDate: '2026-04-20',
      submittedDates: []
    });
  } finally {
    restore();
  }
});
