'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_SUBJECT_ORDER,
  parseWeeklyAttendancePdf
} = require('../server/src/services/weeklyAttendanceParser');

test('parses the B1-B4 weekly attendance PDF', async () => {
  const filePath = path.resolve(
    __dirname,
    '../SY2_Weekly_Compile_ Attendance_Sem-4_2026 - B1 - B4_Week  03.pdf'
  );

  const parsed = await parseWeeklyAttendancePdf(
    fs.readFileSync(filePath),
    path.basename(filePath)
  );

  assert.equal(parsed.students.length, 142);
  assert.deepEqual(parsed.divisions, ['B1', 'B2', 'B3', 'B4']);
  assert.equal(parsed.week_label, 'Week 3');
  assert.equal(parsed.subject_order.join(','), DEFAULT_SUBJECT_ORDER.join(','));
  assert.equal(parsed.students[0].division, 'B1');
  assert.equal(parsed.students[0].name, 'SHUBHRA JYOTI BRAHMA');
  assert.equal(parsed.students.at(-1).division, 'B4');
  assert.equal(parsed.students.at(-1).roll_no, 142);
});

test('parses the B5-B9 weekly attendance PDF', async () => {
  const filePath = path.resolve(
    __dirname,
    '../SY2_Weekly_Compile_ Attendance_Sem-4_2026 - B5 - B9_Week  03.pdf'
  );

  const parsed = await parseWeeklyAttendancePdf(
    fs.readFileSync(filePath),
    path.basename(filePath)
  );

  assert.equal(parsed.students.length, 150);
  assert.deepEqual(parsed.divisions, ['B5', 'B6', 'B7', 'B8', 'B9']);
  assert.equal(parsed.week_label, 'Week 3');
  assert.equal(parsed.students[0].division, 'B5');
  assert.equal(parsed.students[0].roll_no, 143);
  assert.equal(parsed.students.at(-1).division, 'B9');
  assert.equal(parsed.students.at(-1).roll_no, 292);
});
