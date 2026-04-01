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

function assertPostgresConfigured() {
  if (!isPostgresConfigured()) {
    throw createRepositoryError(
      'DATABASE_URL is required for weekly attendance imports and daily attendance updates.',
      500
    );
  }
}

function isUsingSupabaseRest() {
  return hasSupabaseCredentials() && !isPostgresConfigured();
}

function mapSubjectRows(subjects) {
  return subjects.map((subject) => ({
    subject_name: subject.subject_name,
    attended: subject.attended,
    total: subject.total,
    updated_at: subject.updated_at || null
  }));
}

function calculateAttendancePercentage(subjects) {
  const totals = subjects.reduce(
    (summary, subject) => {
      summary.attended += subject.attended;
      summary.total += subject.total;
      return summary;
    },
    { attended: 0, total: 0 }
  );

  return totals.total
    ? `${((totals.attended / totals.total) * 100).toFixed(2)}%`
    : '0.00%';
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
      .select('id, firebase_uid, email, name, student_id')
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
      returning id, firebase_uid, email, name, student_id
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
      .select('id, name, email, student_id')
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
        select id, name, email, student_id
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

async function getLegacySubjectsByProfileIds(profileIds) {
  if (profileIds.length === 0) {
    return [];
  }

  if (isUsingSupabaseRest()) {
    assertSupabaseConfigured();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('attendance_subjects')
      .select('profile_id, subject_name, attended, total, updated_at')
      .in('profile_id', profileIds)
      .order('subject_name', { ascending: true });

    if (error) {
      throw createRepositoryError(`Failed to load legacy subjects: ${error.message}`);
    }

    return data;
  }

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      select profile_id, subject_name, attended, total, updated_at
      from attendance_subjects
      where profile_id = any($1::uuid[])
      order by subject_name asc
    `,
    [profileIds]
  );

  return result.rows;
}

async function getStudentSubjectsByStudentIds(studentIds) {
  if (!studentIds.length) {
    return [];
  }

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      select student_id, subject_name, attended, total, updated_at
      from attendance_student_subjects
      where student_id = any($1::uuid[])
      order by subject_name asc
    `,
    [studentIds]
  );

  return result.rows;
}

async function getSubjectsByProfileIds(profileIds) {
  assertDataStoreConfigured();

  if (profileIds.length === 0) {
    return [];
  }

  const profiles = await getProfilesByIds(profileIds);
  const studentIdByProfileId = new Map(
    profiles
      .filter((profile) => profile.student_id)
      .map((profile) => [profile.id, profile.student_id])
  );

  const [legacySubjects, importedSubjects] = await Promise.all([
    getLegacySubjectsByProfileIds(profileIds),
    studentIdByProfileId.size
      ? getStudentSubjectsByStudentIds([...new Set(studentIdByProfileId.values())])
      : Promise.resolve([])
  ]);

  const importedByStudentId = new Map();
  importedSubjects.forEach((subject) => {
    const list = importedByStudentId.get(subject.student_id) || [];
    list.push(subject);
    importedByStudentId.set(subject.student_id, list);
  });

  const legacyByProfileId = new Map();
  legacySubjects.forEach((subject) => {
    const list = legacyByProfileId.get(subject.profile_id) || [];
    list.push(subject);
    legacyByProfileId.set(subject.profile_id, list);
  });

  const normalizedRows = [];

  profiles.forEach((profile) => {
    const importedRows = profile.student_id
      ? importedByStudentId.get(profile.student_id) || []
      : [];
    const sourceRows = importedRows.length ? importedRows : legacyByProfileId.get(profile.id) || [];

    sourceRows.forEach((subject) => {
      normalizedRows.push({
        profile_id: profile.id,
        subject_name: subject.subject_name,
        attended: subject.attended,
        total: subject.total,
        updated_at: subject.updated_at || null
      });
    });
  });

  return normalizedRows;
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

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      attendance: calculateAttendancePercentage(profileSubjects),
      subject_count: profileSubjects.length,
      linked_to_import: Boolean(profile.student_id),
      subjects: mapSubjectRows(profileSubjects)
    };
  });
}

async function getCurrentAttendanceSnapshot(profileId) {
  assertPostgresConfigured();

  const pool = getPostgresPool();
  const profileResult = await pool.query(
    `
      select
        p.id,
        p.firebase_uid,
        p.email,
        p.name,
        p.student_id,
        s.enrollment_no,
        s.roll_no,
        s.division,
        s.mentor_name,
        s.latest_import_id,
        i.file_name as latest_import_file_name,
        i.week_label as latest_import_week_label,
        i.report_date as latest_import_report_date,
        i.start_date as latest_import_start_date,
        i.end_date as latest_import_end_date,
        i.created_at as latest_import_created_at
      from attendance_profiles p
      left join attendance_students s on s.id = p.student_id
      left join attendance_imports i on i.id = s.latest_import_id
      where p.id = $1
    `,
    [profileId]
  );

  const profile = profileResult.rows[0];

  if (!profile) {
    throw createRepositoryError('The current profile could not be found.', 404);
  }

  const subjects = profile.student_id
    ? (
        await pool.query(
          `
            select subject_name, attended, total, updated_at
            from attendance_student_subjects
            where student_id = $1
            order by subject_name asc
          `,
          [profile.student_id]
        )
      ).rows
    : (
        await pool.query(
          `
            select subject_name, attended, total, updated_at
            from attendance_subjects
            where profile_id = $1
            order by subject_name asc
          `,
          [profileId]
        )
      ).rows;

  const recentLogs = profile.student_id
    ? (
        await pool.query(
          `
            select subject_name, attendance_date, was_class_held, was_present, updated_at
            from attendance_daily_logs
            where student_id = $1
            order by attendance_date desc, subject_name asc
            limit 20
          `,
          [profile.student_id]
        )
      ).rows
    : [];

  return {
    profile: {
      id: profile.id,
      firebase_uid: profile.firebase_uid,
      email: profile.email,
      name: profile.name,
      student_id: profile.student_id
    },
    linked_student: profile.student_id
      ? {
          id: profile.student_id,
          enrollment_no: profile.enrollment_no,
          roll_no: profile.roll_no,
          division: profile.division,
          mentor_name: profile.mentor_name,
          latest_import: profile.latest_import_id
            ? {
                id: profile.latest_import_id,
                file_name: profile.latest_import_file_name,
                week_label: profile.latest_import_week_label,
                report_date: profile.latest_import_report_date,
                start_date: profile.latest_import_start_date,
                end_date: profile.latest_import_end_date,
                created_at: profile.latest_import_created_at
              }
            : null
        }
      : null,
    subjects: mapSubjectRows(subjects),
    recent_daily_logs: recentLogs
  };
}

async function linkProfileToStudent(profileId, enrollmentNo) {
  assertPostgresConfigured();

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    const studentResult = await client.query(
      `
        select id, enrollment_no, roll_no, division, name, mentor_name, latest_import_id
        from attendance_students
        where enrollment_no = $1
      `,
      [enrollmentNo]
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw createRepositoryError(
        'That enrollment number is not in the imported weekly attendance yet.',
        404
      );
    }

    const conflictResult = await client.query(
      `
        select id
        from attendance_profiles
        where student_id = $1
          and id <> $2
      `,
      [student.id, profileId]
    );

    if (conflictResult.rowCount > 0) {
      throw createRepositoryError(
        'This enrollment number is already linked to another app account.',
        409
      );
    }

    await client.query(
      `
        update attendance_profiles
        set student_id = $2
        where id = $1
      `,
      [profileId, student.id]
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getCurrentAttendanceSnapshot(profileId);
}

async function saveWeeklyImport(importedByProfileId, parsedImport) {
  assertPostgresConfigured();

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    const importResult = await client.query(
      `
        insert into attendance_imports (
          file_name,
          week_label,
          report_date,
          start_date,
          end_date,
          imported_by_profile_id,
          student_count
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, file_name, week_label, report_date, start_date, end_date, created_at
      `,
      [
        parsedImport.file_name,
        parsedImport.week_label,
        parsedImport.report_date,
        parsedImport.start_date,
        parsedImport.end_date,
        importedByProfileId,
        parsedImport.students.length
      ]
    );

    const importRecord = importResult.rows[0];
    const studentPayload = parsedImport.students.map((student) => ({
      enrollment_no: student.enrollment_no,
      roll_no: student.roll_no,
      division: student.division,
      name: student.name,
      mentor_name: student.mentor_name
    }));

    const upsertedStudentsResult = await client.query(
      `
        with incoming as (
          select *
          from json_to_recordset($1::json) as rows(
            enrollment_no text,
            roll_no integer,
            division text,
            name text,
            mentor_name text
          )
        )
        insert into attendance_students (
          enrollment_no,
          roll_no,
          division,
          name,
          mentor_name,
          latest_import_id,
          updated_at
        )
        select
          incoming.enrollment_no,
          incoming.roll_no,
          incoming.division,
          incoming.name,
          incoming.mentor_name,
          $2,
          now()
        from incoming
        on conflict (enrollment_no)
        do update set
          roll_no = excluded.roll_no,
          division = excluded.division,
          name = excluded.name,
          mentor_name = excluded.mentor_name,
          latest_import_id = excluded.latest_import_id,
          updated_at = now()
        returning id, enrollment_no
      `,
      [JSON.stringify(studentPayload), importRecord.id]
    );

    const studentIdByEnrollmentNo = new Map(
      upsertedStudentsResult.rows.map((row) => [row.enrollment_no, row.id])
    );
    const subjectPayload = parsedImport.students.flatMap((student) =>
      student.subjects.map((subject) => ({
        student_id: studentIdByEnrollmentNo.get(student.enrollment_no),
        subject_name: subject.subject_name,
        attended: subject.attended,
        total: subject.total
      }))
    );
    const studentIds = [...new Set(subjectPayload.map((subject) => subject.student_id))];

    await client.query(
      `
        with incoming as (
          select *
          from json_to_recordset($1::json) as rows(
            student_id uuid,
            subject_name text,
            attended integer,
            total integer
          )
        )
        insert into attendance_student_subjects (
          student_id,
          subject_name,
          attended,
          total,
          updated_at
        )
        select
          incoming.student_id,
          incoming.subject_name,
          incoming.attended,
          incoming.total,
          now()
        from incoming
        on conflict (student_id, subject_name)
        do update set
          attended = excluded.attended,
          total = excluded.total,
          updated_at = now()
      `,
      [JSON.stringify(subjectPayload)]
    );

    if (parsedImport.report_date) {
      await client.query(
        `
          delete from attendance_daily_logs
          where student_id = any($1::uuid[])
            and attendance_date <= $2
        `,
        [studentIds, parsedImport.report_date]
      );
    } else {
      await client.query(
        `
          delete from attendance_daily_logs
          where student_id = any($1::uuid[])
        `,
        [studentIds]
      );
    }

    await client.query('commit');

    return {
      import: importRecord,
      student_count: parsedImport.students.length,
      divisions: [...new Set(parsedImport.divisions)]
    };
  } catch (error) {
    await client.query('rollback');
    throw createRepositoryError(`Failed to save the weekly attendance import: ${error.message}`);
  } finally {
    client.release();
  }
}

async function applyDailyAttendance(profileId, attendanceDate, entries) {
  assertPostgresConfigured();

  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('begin');

    const profileResult = await client.query(
      `
        select id, student_id
        from attendance_profiles
        where id = $1
      `,
      [profileId]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      throw createRepositoryError('The current profile could not be found.', 404);
    }

    if (!profile.student_id) {
      throw createRepositoryError(
        'Link your enrollment number to an imported weekly attendance record first.',
        400
      );
    }

    const subjectNames = entries.map((entry) => entry.subject_name);
    const existingLogResult = await client.query(
      `
        select subject_name, was_class_held, was_present
        from attendance_daily_logs
        where student_id = $1
          and attendance_date = $2
          and subject_name = any($3::text[])
      `,
      [profile.student_id, attendanceDate, subjectNames]
    );

    const existingSubjectResult = await client.query(
      `
        select subject_name, attended, total
        from attendance_student_subjects
        where student_id = $1
          and subject_name = any($2::text[])
      `,
      [profile.student_id, subjectNames]
    );

    const logBySubject = new Map(
      existingLogResult.rows.map((row) => [row.subject_name, row])
    );
    const subjectByName = new Map(
      existingSubjectResult.rows.map((row) => [row.subject_name, row])
    );

    for (const entry of entries) {
      const previous = logBySubject.get(entry.subject_name) || {
        was_class_held: false,
        was_present: false
      };
      const currentSubject = subjectByName.get(entry.subject_name) || {
        attended: 0,
        total: 0
      };

      const totalDelta =
        Number(entry.was_class_held) - Number(previous.was_class_held);
      const attendedDelta =
        Number(entry.was_present) - Number(previous.was_present);

      const nextTotal = currentSubject.total + totalDelta;
      const nextAttended = currentSubject.attended + attendedDelta;

      if (nextTotal < 0 || nextAttended < 0 || nextAttended > nextTotal) {
        throw createRepositoryError(
          `The daily update for ${entry.subject_name} would make the totals invalid.`,
          400
        );
      }

      await client.query(
        `
          insert into attendance_student_subjects (
            student_id,
            subject_name,
            attended,
            total,
            updated_at
          )
          values ($1, $2, $3, $4, now())
          on conflict (student_id, subject_name)
          do update set
            attended = excluded.attended,
            total = excluded.total,
            updated_at = now()
        `,
        [profile.student_id, entry.subject_name, nextAttended, nextTotal]
      );

      if (!entry.was_class_held && !entry.was_present) {
        await client.query(
          `
            delete from attendance_daily_logs
            where student_id = $1
              and attendance_date = $2
              and subject_name = $3
          `,
          [profile.student_id, attendanceDate, entry.subject_name]
        );
      } else {
        await client.query(
          `
            insert into attendance_daily_logs (
              student_id,
              subject_name,
              attendance_date,
              was_class_held,
              was_present,
              created_by_profile_id,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, now())
            on conflict (student_id, subject_name, attendance_date)
            do update set
              was_class_held = excluded.was_class_held,
              was_present = excluded.was_present,
              created_by_profile_id = excluded.created_by_profile_id,
              updated_at = now()
          `,
          [
            profile.student_id,
            entry.subject_name,
            attendanceDate,
            entry.was_class_held,
            entry.was_present,
            profileId
          ]
        );
      }
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  return getCurrentAttendanceSnapshot(profileId);
}

module.exports = {
  applyDailyAttendance,
  ensureProfile,
  getAllowedProfileIds,
  getCurrentAttendanceSnapshot,
  getFriendSummaries,
  getProfilesByIds,
  getSubjectsByProfileIds,
  linkProfileToStudent,
  saveWeeklyImport
};
