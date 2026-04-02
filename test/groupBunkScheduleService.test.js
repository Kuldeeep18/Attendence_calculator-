'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSharedBunkRecommendations
} = require('../server/src/features/planner/services/groupBunkScheduleService');

test('buildSharedBunkRecommendations returns the next safe lecture and the best scored lecture', () => {
  const participants = [
    {
      id: 'user-a',
      name: 'Aarav',
      division: 'B1',
      subjects: [
        { subject_name: 'FSD-2', attended: 18, total: 20 },
        { subject_name: 'COA', attended: 19, total: 20 }
      ]
    },
    {
      id: 'user-b',
      name: 'Riya',
      division: 'B2',
      subjects: [
        { subject_name: 'COA', attended: 15, total: 18 },
        { subject_name: 'DM', attended: 18, total: 20 }
      ]
    }
  ];
  const timetable = {
    file_name: 'timetable.pdf',
    effective_from: '9-March-2026',
    divisions: ['B1', 'B2'],
    lecture_times: {
      FRI: {
        2: '9:45 am to 10:45 am'
      },
      SAT: {
        1: '8:45am to 9:45am'
      }
    },
    schedule: {
      B1: {
        FRI: {
          2: { lecture_no: 2, time_range: '9:45 am to 10:45 am', subject_name: 'FSD2' }
        },
        SAT: {
          1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'COA' }
        }
      },
      B2: {
        FRI: {
          2: { lecture_no: 2, time_range: '9:45 am to 10:45 am', subject_name: 'COA' }
        },
        SAT: {
          1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'DM' }
        }
      }
    }
  };
  const calendarEvents = [
    {
      date: '2026-04-03',
      label: 'Fri, Apr 3, 2026',
      weekday: 'FRI',
      description: 'Regular Teaching',
      instructional: true
    },
    {
      date: '2026-04-04',
      label: 'Sat, Apr 4, 2026',
      weekday: 'SAT',
      description: 'Regular Teaching',
      instructional: true
    }
  ];

  const recommendations = buildSharedBunkRecommendations({
    participants,
    timetable,
    calendarEvents,
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 2
  });

  assert.equal(recommendations.next_shared_lecture.date, '2026-04-03');
  assert.equal(recommendations.best_shared_lecture.date, '2026-04-04');
  assert.equal(recommendations.recommended_slots.length, 2);
  assert.equal(recommendations.recommended_slots[0].participants[0].before_attendance, '90.00%');
  assert.equal(recommendations.recommended_slots[0].participants[0].after_attendance, '85.71%');
  assert.equal(recommendations.recommended_slots[0].participants[1].before_attendance, '83.33%');
  assert.equal(recommendations.recommended_slots[0].participants[1].after_attendance, '78.95%');
});

test('buildSharedBunkRecommendations maps timetable aliases like FCSP2 to PYTHON-2', () => {
  const recommendations = buildSharedBunkRecommendations({
    participants: [
      {
        id: 'user-a',
        name: 'Aarav',
        division: 'B1',
        subjects: [{ subject_name: 'PYTHON-2', attended: 10, total: 12 }]
      }
    ],
    timetable: {
      file_name: 'timetable.pdf',
      effective_from: '9-March-2026',
      divisions: ['B1'],
      lecture_times: {
        MON: {
          1: '8:45am to 9:45am'
        }
      },
      schedule: {
        B1: {
          MON: {
            1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'FCSP2' }
          }
        }
      }
    },
    calendarEvents: [
      {
        date: '2026-04-06',
        label: 'Mon, Apr 6, 2026',
        weekday: 'MON',
        description: 'Regular Teaching',
        instructional: true
      }
    ],
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 1
  });

  assert.equal(recommendations.next_shared_lecture.participants[0].subject_name, 'PYTHON-2');
  assert.equal(recommendations.next_shared_lecture.participants[0].after_attendance, '76.92%');
});

test('buildSharedBunkRecommendations applies bunk impact sequentially when returning multiple slots', () => {
  const recommendations = buildSharedBunkRecommendations({
    participants: [
      {
        id: 'user-a',
        name: 'Aarav',
        division: 'B1',
        subjects: [{ subject_name: 'DM', attended: 6, total: 7 }]
      },
      {
        id: 'user-b',
        name: 'Riya',
        division: 'B2',
        subjects: [{ subject_name: 'TOC', attended: 6, total: 7 }]
      }
    ],
    timetable: {
      file_name: 'timetable.pdf',
      effective_from: '9-March-2026',
      divisions: ['B1', 'B2'],
      lecture_times: {
        MON: {
          1: '8:45am to 9:45am'
        },
        TUE: {
          1: '8:45am to 9:45am'
        }
      },
      schedule: {
        B1: {
          MON: {
            1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'DM' }
          },
          TUE: {
            1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'DM' }
          }
        },
        B2: {
          MON: {
            1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'TOC' }
          },
          TUE: {
            1: { lecture_no: 1, time_range: '8:45am to 9:45am', subject_name: 'TOC' }
          }
        }
      }
    },
    calendarEvents: [
      {
        date: '2026-04-06',
        label: 'Mon, Apr 6, 2026',
        weekday: 'MON',
        description: 'Regular Teaching',
        instructional: true
      },
      {
        date: '2026-04-07',
        label: 'Tue, Apr 7, 2026',
        weekday: 'TUE',
        description: 'Regular Teaching',
        instructional: true
      }
    ],
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 2
  });

  assert.equal(recommendations.recommended_slots.length, 1);
  assert.equal(recommendations.recommended_slots[0].date, '2026-04-06');
});

test('buildSharedBunkRecommendations can limit recommendations to lectures before or after break', () => {
  const basePayload = {
    participants: [
      {
        id: 'user-a',
        name: 'Aarav',
        division: 'B1',
        subjects: [
          { subject_name: 'DM', attended: 12, total: 14 },
          { subject_name: 'COA', attended: 12, total: 14 }
        ]
      },
      {
        id: 'user-b',
        name: 'Riya',
        division: 'B2',
        subjects: [
          { subject_name: 'DM', attended: 12, total: 14 },
          { subject_name: 'COA', attended: 12, total: 14 }
        ]
      }
    ],
    timetable: {
      file_name: 'timetable.pdf',
      effective_from: '9-March-2026',
      divisions: ['B1', 'B2'],
      lecture_times: {
        MON: {
          1: '8:45am to 9:35am',
          2: '9:40am to 10:30am',
          3: '11:20am to 12:10pm'
        }
      },
      schedule: {
        B1: {
          MON: {
            2: { lecture_no: 2, time_range: '9:40am to 10:30am', subject_name: 'DM' },
            3: { lecture_no: 3, time_range: '11:20am to 12:10pm', subject_name: 'COA' }
          }
        },
        B2: {
          MON: {
            2: { lecture_no: 2, time_range: '9:40am to 10:30am', subject_name: 'DM' },
            3: { lecture_no: 3, time_range: '11:20am to 12:10pm', subject_name: 'COA' }
          }
        }
      }
    },
    calendarEvents: [
      {
        date: '2026-04-06',
        label: 'Mon, Apr 6, 2026',
        weekday: 'MON',
        description: 'Regular Teaching',
        instructional: true
      }
    ],
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 1
  };

  const beforeBreakRecommendation = buildSharedBunkRecommendations({
    ...basePayload,
    bunkTimingPreference: 'BEFORE_BREAK'
  });

  const afterBreakRecommendation = buildSharedBunkRecommendations({
    ...basePayload,
    bunkTimingPreference: 'AFTER_BREAK'
  });

  assert.equal(beforeBreakRecommendation.next_shared_lecture.lecture_no, 2);
  assert.equal(afterBreakRecommendation.next_shared_lecture.lecture_no, 3);
});

test('buildSharedBunkRecommendations can enforce consecutive lecture mode for 2+ bunks', () => {
  const recommendations = buildSharedBunkRecommendations({
    participants: [
      {
        id: 'user-a',
        name: 'Aarav',
        division: 'B1',
        subjects: [
          { subject_name: 'DM', attended: 18, total: 20 },
          { subject_name: 'COA', attended: 18, total: 20 },
          { subject_name: 'TOC', attended: 18, total: 20 }
        ]
      }
    ],
    timetable: {
      file_name: 'timetable.pdf',
      effective_from: '9-March-2026',
      divisions: ['B1'],
      lecture_times: {
        MON: {
          1: '8:45am to 9:35am',
          2: '9:40am to 10:30am',
          3: '10:35am to 11:25am'
        }
      },
      schedule: {
        B1: {
          MON: {
            1: { lecture_no: 1, time_range: '8:45am to 9:35am', subject_name: 'DM' },
            2: { lecture_no: 2, time_range: '9:40am to 10:30am', subject_name: 'COA' },
            3: { lecture_no: 3, time_range: '10:35am to 11:25am', subject_name: 'TOC' }
          }
        }
      }
    },
    calendarEvents: [
      {
        date: '2026-04-06',
        label: 'Mon, Apr 6, 2026',
        weekday: 'MON',
        description: 'Regular Teaching',
        instructional: true
      }
    ],
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 2,
    multiBunkPreference: 'CONSECUTIVE'
  });

  assert.equal(recommendations.recommended_slots.length, 2);
  assert.equal(recommendations.recommended_slots[0].lecture_no, 1);
  assert.equal(recommendations.recommended_slots[1].lecture_no, 2);
});

test('buildSharedBunkRecommendations can enforce alone lecture mode for 2+ bunks', () => {
  const recommendations = buildSharedBunkRecommendations({
    participants: [
      {
        id: 'user-a',
        name: 'Aarav',
        division: 'B1',
        subjects: [
          { subject_name: 'DM', attended: 18, total: 20 },
          { subject_name: 'COA', attended: 18, total: 20 },
          { subject_name: 'TOC', attended: 18, total: 20 }
        ]
      }
    ],
    timetable: {
      file_name: 'timetable.pdf',
      effective_from: '9-March-2026',
      divisions: ['B1'],
      lecture_times: {
        MON: {
          1: '8:45am to 9:35am',
          2: '9:40am to 10:30am',
          3: '10:35am to 11:25am'
        }
      },
      schedule: {
        B1: {
          MON: {
            1: { lecture_no: 1, time_range: '8:45am to 9:35am', subject_name: 'DM' },
            2: { lecture_no: 2, time_range: '9:40am to 10:30am', subject_name: 'COA' },
            3: { lecture_no: 3, time_range: '10:35am to 11:25am', subject_name: 'TOC' }
          }
        }
      }
    },
    calendarEvents: [
      {
        date: '2026-04-06',
        label: 'Mon, Apr 6, 2026',
        weekday: 'MON',
        description: 'Regular Teaching',
        instructional: true
      }
    ],
    currentDateTime: new Date(2026, 3, 2, 8, 0, 0),
    bunkCount: 2,
    multiBunkPreference: 'ALONE'
  });

  assert.equal(recommendations.recommended_slots.length, 2);
  assert.equal(recommendations.recommended_slots[0].lecture_no, 1);
  assert.equal(recommendations.recommended_slots[1].lecture_no, 3);
});
