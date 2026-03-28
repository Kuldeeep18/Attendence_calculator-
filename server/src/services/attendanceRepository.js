'use strict';

const { assertSupabaseConfigured, getSupabaseAdminClient } = require('../lib/supabase');
const { getPostgresPool, isPostgresConfigured } = require('../lib/postgres');
const { hasSupabaseCredentials } = require('../config/env');

function createRepositoryError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertDataStoreConfigured() {
  if (!hasSupabaseCredentials() && !isPostgresConfigured()) {
    throw createRepositoryError(
      'Configure either Supabase service role credentials or DATABASE_URL.',
      500
    );
  }
}

function isUsingSupabaseRest() {
  return hasSupabaseCredentials();
}

function mapSubjectRows(subjects) {
  return subjects.map((subject) => ({
    subject_name: subject.subject_name,
    attended: subject.attended,
    total: subject.total
  }));
}

async function ensureProfile(authUser) {
  assertDataStoreConfigured();

  const payload = {
    firebase_uid: authUser.uid,
    email: authUser.email,
    name: authUser.name || (authUser.email ? authUser.email.split('@')[0] : 'Student')
  };

  if (isUsingSupabaseRest()) {
    assertSupabaseConfigured();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('attendance_profiles')
      .upsert(payload, { onConflict: 'firebase_uid' })
      .select('id, firebase_uid, email, name')
      .single();

    if (error) {
      throw createRepositoryError(`Failed to load the current profile: ${error.message}`);
    }

    return data;
  }

  try {
    const pool = getPostgresPool();
    const query = `
      insert into attendance_profiles (firebase_uid, email, name)
      values ($1, $2, $3)
      on conflict (firebase_uid)
      do update set
        email = excluded.email,
        name = excluded.name
      returning id, firebase_uid, email, name
    `;

    const result = await pool.query(query, [
      payload.firebase_uid,
      payload.email,
      payload.name
    ]);

    return result.rows[0];
  } catch (error) {
    throw createRepositoryError(`Failed to load the current profile: ${error.message}`);
  }
}

async function getAllowedProfileIds(ownerProfileId) {
  assertDataStoreConfigured();

  if (isUsingSupabaseRest()) {
    assertSupabaseConfigured();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_profile_id')
      .eq('owner_profile_id', ownerProfileId);

    if (error) {
      throw createRepositoryError(`Failed to load friendships: ${error.message}`);
    }

    const friendIds = data.map((row) => row.friend_profile_id);
    return [ownerProfileId, ...friendIds];
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      `
        select friend_profile_id
        from friendships
        where owner_profile_id = $1
      `,
      [ownerProfileId]
    );

    const friendIds = result.rows.map((row) => row.friend_profile_id);
    return [ownerProfileId, ...friendIds];
  } catch (error) {
    throw createRepositoryError(`Failed to load friendships: ${error.message}`);
  }
}

async function getProfilesByIds(profileIds) {
  assertDataStoreConfigured();

  if (profileIds.length === 0) {
    return [];
  }

  if (isUsingSupabaseRest()) {
    assertSupabaseConfigured();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('attendance_profiles')
      .select('id, name, email')
      .in('id', profileIds)
      .order('name', { ascending: true });

    if (error) {
      throw createRepositoryError(`Failed to load profiles: ${error.message}`);
    }

    return data;
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      `
        select id, name, email
        from attendance_profiles
        where id = any($1::uuid[])
        order by name asc
      `,
      [profileIds]
    );

    return result.rows;
  } catch (error) {
    throw createRepositoryError(`Failed to load profiles: ${error.message}`);
  }
}

async function getSubjectsByProfileIds(profileIds) {
  assertDataStoreConfigured();

  if (profileIds.length === 0) {
    return [];
  }

  if (isUsingSupabaseRest()) {
    assertSupabaseConfigured();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('attendance_subjects')
      .select('profile_id, subject_name, attended, total')
      .in('profile_id', profileIds)
      .order('subject_name', { ascending: true });

    if (error) {
      throw createRepositoryError(`Failed to load subjects: ${error.message}`);
    }

    return data;
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      `
        select profile_id, subject_name, attended, total
        from attendance_subjects
        where profile_id = any($1::uuid[])
        order by subject_name asc
      `,
      [profileIds]
    );

    return result.rows;
  } catch (error) {
    throw createRepositoryError(`Failed to load subjects: ${error.message}`);
  }
}

async function getFriendSummaries(ownerProfileId) {
  const allowedProfileIds = await getAllowedProfileIds(ownerProfileId);
  const friendProfileIds = allowedProfileIds.filter((profileId) => profileId !== ownerProfileId);

  if (friendProfileIds.length === 0) {
    return [];
  }

  const [profiles, subjects] = await Promise.all([
    getProfilesByIds(friendProfileIds),
    getSubjectsByProfileIds(friendProfileIds)
  ]);

  const subjectsByProfile = new Map();

  subjects.forEach((subject) => {
    const current = subjectsByProfile.get(subject.profile_id) || [];
    current.push(subject);
    subjectsByProfile.set(subject.profile_id, current);
  });

  return profiles.map((profile) => {
    const profileSubjects = subjectsByProfile.get(profile.id) || [];
    const totals = profileSubjects.reduce(
      (summary, subject) => {
        summary.attended += subject.attended;
        summary.total += subject.total;
        return summary;
      },
      { attended: 0, total: 0 }
    );

    const attendancePercentage = totals.total
      ? `${((totals.attended / totals.total) * 100).toFixed(2)}%`
      : '0.00%';

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      attendance: attendancePercentage,
      subject_count: profileSubjects.length,
      subjects: mapSubjectRows(profileSubjects)
    };
  });
}

module.exports = {
  ensureProfile,
  getAllowedProfileIds,
  getFriendSummaries,
  getProfilesByIds,
  getSubjectsByProfileIds
};
