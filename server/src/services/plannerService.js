'use strict';

const { buildSmartGroupBunkPlan } = require('../../../src');

const attendanceRepository = require('./attendanceRepository');

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildPlannerUsers(profiles, subjects) {
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

async function buildPlannerResult(authUser, payload = {}) {
  const currentProfile = await attendanceRepository.ensureProfile(authUser);
  const selectedUserIds = normalizeSelectedUserIds(payload.selectedUserIds);
  const bunkCount = normalizeBunkCount(payload.bunkCount);

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

  const plannerUsers = buildPlannerUsers(profiles, subjects);

  return buildSmartGroupBunkPlan(plannerUsers, bunkCount);
}

module.exports = {
  buildPlannerResult,
  listSelectableFriends
};
