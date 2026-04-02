'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSmartGroupBunkPlan,
  calculateGroupBunk,
  calculateSafeBunks,
  getCommonSafeSubjects,
  getSafeSubjects,
  simulateGroupBunk
} = require('../src');

const sampleUsers = [
  {
    id: 1,
    name: 'Ava',
    subjects: [
      { subject_name: 'Math', attended: 18, total: 20 },
      { subject_name: 'Physics', attended: 17, total: 20 },
      { subject_name: 'Chemistry', attended: 16, total: 20 }
    ]
  },
  {
    id: 2,
    name: 'Noah',
    subjects: [
      { subject_name: 'Math', attended: 19, total: 22 },
      { subject_name: 'Physics', attended: 18, total: 22 },
      { subject_name: 'Chemistry', attended: 17, total: 22 },
      { subject_name: 'Biology', attended: 0, total: 0 }
    ]
  }
];

test('calculateSafeBunks supports the mandatory numeric formula signature', () => {
  assert.equal(calculateSafeBunks(9, 10), 2);
  assert.equal(calculateSafeBunks(0, 0), 0);
});

test('calculateSafeBunks computes aggregate safe bunks for a user object', () => {
  assert.equal(calculateSafeBunks(sampleUsers[0]), 8);
});

test('calculateGroupBunk returns zero when any user is already at or below the threshold', () => {
  const users = [
    {
      id: 1,
      name: 'Mia',
      subjects: [{ subject_name: 'Math', attended: 15, total: 20 }]
    },
    {
      id: 2,
      name: 'Leo',
      subjects: [{ subject_name: 'Math', attended: 14, total: 20 }]
    }
  ];

  assert.equal(calculateGroupBunk(users), 0);
});

test('getSafeSubjects filters only subjects that remain safe after one bunk', () => {
  const safeSubjects = getSafeSubjects(sampleUsers[0]);

  assert.deepEqual(
    safeSubjects.map((subject) => subject.subject_name),
    ['Math', 'Physics', 'Chemistry']
  );
});

test('getCommonSafeSubjects returns the sorted safe intersection across all users', () => {
  const commonSafeSubjects = getCommonSafeSubjects(sampleUsers);

  assert.deepEqual(
    commonSafeSubjects.map((subject) => subject.subject_name),
    ['Math', 'Physics']
  );
});

test('simulateGroupBunk handles large bunk counts safely', () => {
  assert.equal(simulateGroupBunk(sampleUsers, 3), 'SAFE');
  assert.equal(simulateGroupBunk(sampleUsers, 7), 'UNSAFE');
});

test('buildSmartGroupBunkPlan returns the required JSON output shape', () => {
  const result = buildSmartGroupBunkPlan(sampleUsers, 2);

  assert.equal(result.group_bunk_limit, 6);
  assert.equal(result.future_status, 'SAFE');
  assert.equal(result.users.length, 2);
  assert.equal(result.recommended_subjects.length, 2);
  assert.deepEqual(result.users[0], {
    id: 1,
    name: 'Ava',
    attendance: '85.00%',
    safe_bunks: 8
  });
});

test('subjects with zero total classes are treated as unsafe for bunking recommendations', () => {
  const safeSubjects = getSafeSubjects({
    id: 3,
    name: 'Ivy',
    subjects: [{ subject_name: 'Biology', attended: 0, total: 0 }]
  });

  assert.deepEqual(safeSubjects, []);
});
