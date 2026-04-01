'use strict';

const { buildSmartGroupBunkPlan } = require('../../../src');

const attendanceRepository = require('./attendanceRepository');
const { loadSharedBunkRecommendations } = require('./groupBunkScheduleService');

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

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildPlannerParticipants(profiles, subjects) {
  const subjectsByProfile = new Map();

  subjects.forEach((subject) => {
    const currentSubjects = subjectsByProfile.get(subject.profile_id) || [];
    currentSubjects.push({
      subject_name: subject.subject_name,
      attended: subject.attended,
      total: subject.total
    });
    subjectsByProfile.set(subject.profile_id, currentSubjects);
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    division: profile.division || null,
    enrollment_no: profile.enrollment_no || null,
    subjects: subjectsByProfile.get(profile.id) || []
  }));
}

function normalizeSelectedUserIds(selectedUserIds) {
  if (selectedUserIds == null) {
    return [];
  }

  if (!Array.isArray(selectedUserIds)) {
    throw createServiceError('selectedUserIds must be an array.', 400);
  }

  return Array.from(
    new Set(
      selectedUserIds
        .map((userId) => String(userId || '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeBunkCount(bunkCount) {
  const normalizedCount = bunkCount == null ? 1 : Number(bunkCount);

  if (!Number.isInteger(normalizedCount) || normalizedCount < 0) {
    throw createServiceError('bunkCount must be a non-negative integer.', 400);
  }

  return normalizedCount;
}

function normalizeBunkTimingPreference(bunkTimingPreference) {
  if (bunkTimingPreference == null || bunkTimingPreference === '') {
    return BUNK_TIMING_PREFERENCE.NONE;
  }

  const normalizedValue = String(bunkTimingPreference)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const mappedValue = {
    NONE: BUNK_TIMING_PREFERENCE.NONE,
    NO_PREFERENCE: BUNK_TIMING_PREFERENCE.NONE,
    BEFORE_BREAK: BUNK_TIMING_PREFERENCE.BEFORE_BREAK,
    BEFORE_BREAK_BUNK: BUNK_TIMING_PREFERENCE.BEFORE_BREAK,
    AFTER_BREAK: BUNK_TIMING_PREFERENCE.AFTER_BREAK,
    AFTER_BREAK_BUNK: BUNK_TIMING_PREFERENCE.AFTER_BREAK
  }[normalizedValue];

  if (!mappedValue) {
    throw createServiceError(
      'bunkTimingPreference must be one of NONE, BEFORE_BREAK, or AFTER_BREAK.',
      400
    );
  }

  return mappedValue;
}

function normalizeMultiBunkPreference(multiBunkPreference, bunkCount) {
  if (bunkCount < 2 || multiBunkPreference == null || multiBunkPreference === '') {
    return MULTI_BUNK_PREFERENCE.NONE;
  }

  const normalizedValue = String(multiBunkPreference)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const mappedValue = {
    NONE: MULTI_BUNK_PREFERENCE.NONE,
    NO_PREFERENCE: MULTI_BUNK_PREFERENCE.NONE,
    CONSECUTIVE: MULTI_BUNK_PREFERENCE.CONSECUTIVE,
    CONSECUTIVE_LECTURES: MULTI_BUNK_PREFERENCE.CONSECUTIVE,
    ALONE: MULTI_BUNK_PREFERENCE.ALONE,
    ALONE_LECTURES: MULTI_BUNK_PREFERENCE.ALONE,
    SEPARATE: MULTI_BUNK_PREFERENCE.ALONE,
    SEPARATE_LECTURES: MULTI_BUNK_PREFERENCE.ALONE
  }[normalizedValue];

  if (!mappedValue) {
    throw createServiceError(
      'multiBunkPreference must be one of NONE, CONSECUTIVE, or ALONE.',
      400
    );
  }

  return mappedValue;
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

async function listSelectableFriends(authUser) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const friends = await attendanceRepository.getFriendSummaries(currentProfile.id);

  return {
    current_user: {
      id: currentProfile.id,
      name: currentProfile.name,
      email: currentProfile.email
    },
    friends
  };
}

async function addFriendByEnrollment(authUser, payload = {}) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const enrollmentNo = normalizeEnrollmentNo(payload.enrollmentNo);

  const addedFriend = await attendanceRepository.addFriendByEnrollment(
    currentProfile.id,
    enrollmentNo
  );
  const friends = await attendanceRepository.getFriendSummaries(currentProfile.id);

  return {
    current_user: {
      id: currentProfile.id,
      name: currentProfile.name,
      email: currentProfile.email
    },
    added_friend: addedFriend,
    friends
  };
}

async function buildPlannerResult(authUser, payload = {}) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const selectedUserIds = normalizeSelectedUserIds(payload.selectedUserIds);
  const bunkCount = normalizeBunkCount(payload.bunkCount);
  const bunkTimingPreference = normalizeBunkTimingPreference(payload.bunkTimingPreference);
  const multiBunkPreference = normalizeMultiBunkPreference(
    payload.multiBunkPreference,
    bunkCount
  );

  const allowedProfileIds = new Set(
    await attendanceRepository.getAllowedProfileIds(currentProfile.id)
  );

  const requestedProfileIds = Array.from(
    new Set([currentProfile.id, ...selectedUserIds])
  );

  const unauthorizedIds = requestedProfileIds.filter(
    (profileId) => !allowedProfileIds.has(profileId)
  );

  if (unauthorizedIds.length > 0) {
    throw createServiceError(
      'One or more selected friends are not linked to the current user.',
      403
    );
  }

  const [profiles, subjects] = await Promise.all([
    attendanceRepository.getProfilesByIds(requestedProfileIds),
    attendanceRepository.getSubjectsByProfileIds(requestedProfileIds)
  ]);

  if (profiles.length !== requestedProfileIds.length) {
    throw createServiceError(
      'Some selected users could not be found in Supabase attendance_profiles.',
      404
    );
  }

  const profileOrder = new Map(
    requestedProfileIds.map((profileId, index) => [profileId, index])
  );

  profiles.sort((left, right) => profileOrder.get(left.id) - profileOrder.get(right.id));

  const plannerParticipants = buildPlannerParticipants(profiles, subjects);
  const plannerResult = buildSmartGroupBunkPlan(plannerParticipants, bunkCount);
  let scheduleRecommendations = {
    timetable: null,
    best_shared_lecture: null,
    next_shared_lecture: null,
    recommended_slots: [],
    schedule_recommendation_error: null
  };

  try {
    scheduleRecommendations = {
      ...(await loadSharedBunkRecommendations(
        plannerParticipants,
        bunkCount,
        bunkTimingPreference,
        multiBunkPreference
      )),
      schedule_recommendation_error: null
    };
  } catch (error) {
    scheduleRecommendations.schedule_recommendation_error = error.message;
  }

  return {
    ...plannerResult,
    ...scheduleRecommendations
  };
}

module.exports = {
  addFriendByEnrollment,
  buildPlannerResult,
  listSelectableFriends
};
