'use strict';

const { env, getAdminEmails } = require('../../../config/env');
const attendanceRepository = require('../../../shared/services/attendanceRepository');
const {
  getPendingAcademicDates,
  toLocalIsoDate
} = require('../../../shared/services/academicCalendarService');
const {
  DEFAULT_SUBJECT_ORDER,
  parseWeeklyAttendancePdf
} = require('./weeklyAttendanceParser');

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

    const wasClassHeld = Boolean(entry.was_class_held);
    const wasPresent = Boolean(entry.was_present);

    if (wasPresent && !wasClassHeld) {
      throw createServiceError(
        `A subject cannot be marked present if the class was not held (${subjectName}).`,
        400
      );
    }

    seenSubjects.add(subjectName);
    normalizedEntries.push({
      subject_name: subjectName,
      was_class_held: wasClassHeld,
      was_present: wasPresent
    });
  });

  return normalizedEntries;
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
  const lastWeeklyUploadDate =
    snapshot.linked_student?.latest_import?.report_date || null;
  let calendarStatus = { calendar: null, pending_dates: [] };
  let academicCalendarError = null;

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

  return {
    ...snapshot,
    attendance_percentage: totals.total
      ? `${((totals.attended / totals.total) * 100).toFixed(2)}%`
      : null,
    available_subjects: availableSubjects,
    can_import_weekly: canImportWeeklyAttendance(authUser),
    current_date: currentDate,
    last_weekly_upload_date: lastWeeklyUploadDate,
    academic_calendar: calendarStatus.calendar,
    academic_calendar_error: academicCalendarError,
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
  const lastWeeklyUploadDate =
    snapshot.linked_student?.latest_import?.report_date || null;

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
      'Daily attendance can only be submitted for pending regular teaching dates after the latest weekly upload.',
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
