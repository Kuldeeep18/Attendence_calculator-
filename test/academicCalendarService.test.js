'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getPendingAcademicDates,
  parseAcademicCalendarPdf
} = require('../server/src/shared/services/academicCalendarService');
const { env } = require('../server/src/config/env');

test('parses the academic calendar PDF into dated events', async () => {
  const filePath = path.resolve(
    __dirname,
    '../SEM-4_Academic Calendar 2026_SY_CE.pdf'
  );

  const parsed = await parseAcademicCalendarPdf(
    fs.readFileSync(filePath),
    path.basename(filePath)
  );

  const marchTest = parsed.events.find((event) => event.date === '2026-03-30');
  const aprilTest = parsed.events.find((event) => event.date === '2026-04-01');

  assert.equal(parsed.file_name, 'SEM-4_Academic Calendar 2026_SY_CE.pdf');
  assert.equal(marchTest.description, 'Test-1 (CCE): DM');
  assert.equal(marchTest.instructional, false);
  assert.equal(aprilTest.description, 'Test-1 (CCE): COA');
  assert.equal(aprilTest.instructional, false);
});

test('builds pending academic dates between the last weekly upload and the current date', async () => {
  const pending = await getPendingAcademicDates({
    fromDate: '2026-03-28',
    toDate: '2026-04-01',
    submittedDates: ['2026-03-30']
  });

  assert.equal(pending.calendar.file_name, 'SEM-4_Academic Calendar 2026_SY_CE.pdf');
  assert.deepEqual(pending.pending_dates.map((event) => event.date), []);
});

test('supports ACADEMIC_CALENDAR_PATH relative to the server directory', async () => {
  const previousCalendarPath = env.ACADEMIC_CALENDAR_PATH;
  env.ACADEMIC_CALENDAR_PATH = '../SEM-4_Academic Calendar 2026_SY_CE.pdf';

  try {
    const pending = await getPendingAcademicDates({
      fromDate: '2026-03-28',
      toDate: '2026-04-01',
      submittedDates: []
    });

    assert.equal(pending.calendar.file_name, 'SEM-4_Academic Calendar 2026_SY_CE.pdf');
  } finally {
    env.ACADEMIC_CALENDAR_PATH = previousCalendarPath;
  }
});
