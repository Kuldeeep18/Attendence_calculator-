'use strict';

const MIN_ATTENDANCE_RATIO = 0.75;
const MAX_RECOMMENDATIONS = 3;

function calculateAttendanceRatio(attended, total) {
  if (total === 0) {
    return 0;
  }

  return attended / total;
}

function formatPercentage(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

function assertFiniteNumber(value, fieldName) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number.`);
  }
}

function assertNonNegative(value, fieldName) {
  if (value < 0) {
    throw new RangeError(`${fieldName} cannot be negative.`);
  }
}

function normalizeSubject(subject, userName) {
  if (!subject || typeof subject !== 'object') {
    throw new TypeError(`Each subject for ${userName} must be an object.`);
  }

  const subjectName = String(subject.subject_name ?? '').trim();
  const attended = Number(subject.attended);
  const total = Number(subject.total);

  if (!subjectName) {
    throw new TypeError(`Each subject for ${userName} must include subject_name.`);
  }

  assertFiniteNumber(attended, `${userName}.${subjectName}.attended`);
  assertFiniteNumber(total, `${userName}.${subjectName}.total`);
  assertNonNegative(attended, `${userName}.${subjectName}.attended`);
  assertNonNegative(total, `${userName}.${subjectName}.total`);

  if (attended > total) {
    throw new RangeError(
      `${userName}.${subjectName}.attended cannot be greater than total.`
    );
  }

  return {
    subject_name: subjectName,
    attended,
    total
  };
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') {
    throw new TypeError('Each user must be an object.');
  }

  const userId = user.id ?? null;
  const userName = String(user.name ?? '').trim();
  const subjects = Array.isArray(user.subjects) ? user.subjects : [];

  if (!userName) {
    throw new TypeError('Each user must include a name.');
  }

  return {
    id: userId,
    name: userName,
    subjects: subjects.map((subject) => normalizeSubject(subject, userName))
  };
}

function normalizeUsers(users) {
  if (!Array.isArray(users)) {
    throw new TypeError('users must be an array.');
  }

  return users.map(normalizeUser);
}

function getUserTotals(user) {
  return user.subjects.reduce(
    (totals, subject) => {
      totals.totalAttended += subject.attended;
      totals.totalClasses += subject.total;
      return totals;
    },
    { totalAttended: 0, totalClasses: 0 }
  );
}

function getSubjectSafety(subject) {
  const currentRatio = calculateAttendanceRatio(subject.attended, subject.total);
  const newTotal = subject.total + 1;
  const futureRatio = calculateAttendanceRatio(subject.attended, newTotal);

  return {
    subject_name: subject.subject_name,
    attended: subject.attended,
    total: subject.total,
    attendance_ratio: currentRatio,
    attendance: formatPercentage(currentRatio),
    future_ratio: futureRatio,
    future_attendance: formatPercentage(futureRatio),
    risk_drop: currentRatio - futureRatio,
    status: futureRatio >= MIN_ATTENDANCE_RATIO ? 'SAFE' : 'UNSAFE'
  };
}

function calculateSafeBunks(userOrAttended, total) {
  if (typeof userOrAttended === 'number') {
    const attended = userOrAttended;

    assertFiniteNumber(attended, 'attended');
    assertFiniteNumber(total, 'total');
    assertNonNegative(attended, 'attended');
    assertNonNegative(total, 'total');

    if (total === 0) {
      return 0;
    }

    return Math.floor((attended / MIN_ATTENDANCE_RATIO) - total);
  }

  const user = normalizeUser(userOrAttended);
  const { totalAttended, totalClasses } = getUserTotals(user);
  return calculateSafeBunks(totalAttended, totalClasses);
}

function calculateGroupBunk(users) {
  const normalizedUsers = normalizeUsers(users);

  if (normalizedUsers.length === 0) {
    return 0;
  }

  const userSafeBunks = normalizedUsers.map((user) => calculateSafeBunks(user));

  if (userSafeBunks.some((safeBunks) => safeBunks <= 0)) {
    return 0;
  }

  return Math.min(...userSafeBunks);
}

function getSafeSubjects(user) {
  const normalizedUser = normalizeUser(user);

  return normalizedUser.subjects
    .map(getSubjectSafety)
    .filter((subject) => subject.status === 'SAFE');
}

function getCommonSafeSubjects(users) {
  const normalizedUsers = normalizeUsers(users);

  if (normalizedUsers.length === 0) {
    return [];
  }

  const intersection = new Map();

  normalizedUsers.forEach((user, index) => {
    const safeSubjects = getSafeSubjects(user);
    const safeSubjectMap = new Map();

    safeSubjects.forEach((subject) => {
      safeSubjectMap.set(subject.subject_name.toLowerCase(), subject);
    });

    if (index === 0) {
      safeSubjectMap.forEach((subject, key) => {
        intersection.set(key, {
          subject_name: subject.subject_name,
          attendance_ratios: [subject.attendance_ratio],
          future_ratios: [subject.future_ratio],
          risk_drops: [subject.risk_drop]
        });
      });

      return;
    }

    Array.from(intersection.keys()).forEach((key) => {
      const currentUserSubject = safeSubjectMap.get(key);

      if (!currentUserSubject) {
        intersection.delete(key);
        return;
      }

      const aggregate = intersection.get(key);
      aggregate.attendance_ratios.push(currentUserSubject.attendance_ratio);
      aggregate.future_ratios.push(currentUserSubject.future_ratio);
      aggregate.risk_drops.push(currentUserSubject.risk_drop);
    });
  });

  return Array.from(intersection.values())
    .map((subject) => {
      const averageAttendanceRatio =
        subject.attendance_ratios.reduce((sum, value) => sum + value, 0) /
        subject.attendance_ratios.length;
      const averageFutureRatio =
        subject.future_ratios.reduce((sum, value) => sum + value, 0) /
        subject.future_ratios.length;
      const averageRiskDrop =
        subject.risk_drops.reduce((sum, value) => sum + value, 0) /
        subject.risk_drops.length;

      return {
        subject_name: subject.subject_name,
        attendance: formatPercentage(averageAttendanceRatio),
        future_attendance: formatPercentage(averageFutureRatio),
        risk_drop: Number((averageRiskDrop * 100).toFixed(2))
      };
    })
    .sort((left, right) => {
      const leftAttendance = Number.parseFloat(left.attendance);
      const rightAttendance = Number.parseFloat(right.attendance);

      if (rightAttendance !== leftAttendance) {
        return rightAttendance - leftAttendance;
      }

      if (left.risk_drop !== right.risk_drop) {
        return left.risk_drop - right.risk_drop;
      }

      return left.subject_name.localeCompare(right.subject_name);
    });
}

function simulateGroupBunk(users, k) {
  const normalizedUsers = normalizeUsers(users);
  const bunkCount = Number(k);

  assertFiniteNumber(bunkCount, 'k');

  if (!Number.isInteger(bunkCount)) {
    throw new TypeError('k must be an integer.');
  }

  assertNonNegative(bunkCount, 'k');

  for (const user of normalizedUsers) {
    const { totalAttended, totalClasses } = getUserTotals(user);
    const newTotal = totalClasses + bunkCount;
    const futurePercentage = calculateAttendanceRatio(totalAttended, newTotal);

    if (futurePercentage < MIN_ATTENDANCE_RATIO) {
      return 'UNSAFE';
    }
  }

  return 'SAFE';
}

function buildSmartGroupBunkPlan(users, bunkCount = 1) {
  const normalizedUsers = normalizeUsers(users);
  const commonSafeSubjects = getCommonSafeSubjects(normalizedUsers);

  return {
    group_bunk_limit: calculateGroupBunk(normalizedUsers),
    recommended_subjects: commonSafeSubjects.slice(0, MAX_RECOMMENDATIONS),
    future_status: simulateGroupBunk(normalizedUsers, bunkCount),
    users: normalizedUsers.map((user) => {
      const { totalAttended, totalClasses } = getUserTotals(user);
      const attendanceRatio = calculateAttendanceRatio(totalAttended, totalClasses);

      return {
        id: user.id,
        name: user.name,
        attendance: formatPercentage(attendanceRatio),
        safe_bunks: calculateSafeBunks(totalAttended, totalClasses)
      };
    })
  };
}

module.exports = {
  MIN_ATTENDANCE_RATIO,
  buildSmartGroupBunkPlan,
  calculateGroupBunk,
  calculateSafeBunks,
  getCommonSafeSubjects,
  getSafeSubjects,
  simulateGroupBunk
};
