'use strict';

const attendanceRepository = require('../../../shared/services/attendanceRepository');

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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

module.exports = {
  addFriendByEnrollment,
  listSelectableFriends
};