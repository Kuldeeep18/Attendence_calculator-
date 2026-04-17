create extension if not exists pgcrypto;

create table if not exists attendance_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  name text not null,
  student_id uuid unique,
  created_at timestamptz not null default now()
);

alter table attendance_profiles
  add column if not exists student_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_profiles_student_id_key'
  ) then
    alter table attendance_profiles
      add constraint attendance_profiles_student_id_key unique (student_id);
  end if;
end $$;

create table if not exists attendance_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  week_label text,
  report_date date,
  start_date date,
  end_date date,
  imported_by_profile_id uuid references attendance_profiles(id) on delete set null,
  student_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists attendance_students (
  id uuid primary key default gen_random_uuid(),
  enrollment_no text not null unique,
  roll_no integer,
  division text,
  name text not null,
  mentor_name text,
  total_attended integer,
  total_conducted integer,
  overall_percentage numeric(5,2),
  latest_import_id uuid references attendance_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table attendance_students
  add column if not exists total_attended integer,
  add column if not exists total_conducted integer,
  add column if not exists overall_percentage numeric(5,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_students_total_attended_check'
  ) then
    alter table attendance_students
      add constraint attendance_students_total_attended_check
      check (total_attended is null or total_attended >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_students_total_conducted_check'
  ) then
    alter table attendance_students
      add constraint attendance_students_total_conducted_check
      check (total_conducted is null or total_conducted >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_students_overall_percentage_check'
  ) then
    alter table attendance_students
      add constraint attendance_students_overall_percentage_check
      check (
        overall_percentage is null
        or (overall_percentage >= 0 and overall_percentage <= 100)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_students_totals_consistency_check'
  ) then
    alter table attendance_students
      add constraint attendance_students_totals_consistency_check
      check (
        total_attended is null
        or total_conducted is null
        or total_attended <= total_conducted
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_profiles_student_id_fkey'
  ) then
    alter table attendance_profiles
      add constraint attendance_profiles_student_id_fkey
      foreign key (student_id)
      references attendance_students(id)
      on delete set null;
  end if;
end $$;

create table if not exists attendance_subjects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references attendance_profiles(id) on delete cascade,
  subject_name text not null,
  attended integer not null check (attended >= 0),
  total integer not null check (total >= 0),
  updated_at timestamptz not null default now(),
  unique (profile_id, subject_name),
  check (attended <= total)
);

create table if not exists attendance_student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references attendance_students(id) on delete cascade,
  subject_name text not null,
  attended integer not null check (attended >= 0),
  total integer not null check (total >= 0),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_name),
  check (attended <= total)
);

create table if not exists attendance_daily_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references attendance_students(id) on delete cascade,
  subject_name text not null,
  attendance_date date not null,
  was_class_held boolean not null default false,
  was_present boolean not null default false,
  created_by_profile_id uuid references attendance_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_name, attendance_date),
  check (not was_present or was_class_held)
);

create table if not exists attendance_daily_lecture_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references attendance_students(id) on delete cascade,
  subject_name text not null,
  attendance_date date not null,
  held_lectures integer not null check (held_lectures >= 0),
  attended_lectures integer not null check (attended_lectures >= 0),
  proxy_lectures integer not null default 0 check (proxy_lectures >= 0),
  created_by_profile_id uuid references attendance_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_name, attendance_date),
  check (attended_lectures <= held_lectures),
  check (proxy_lectures <= attended_lectures)
);

create table if not exists friendships (
  owner_profile_id uuid not null references attendance_profiles(id) on delete cascade,
  friend_profile_id uuid not null references attendance_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_profile_id, friend_profile_id),
  check (owner_profile_id <> friend_profile_id)
);

create index if not exists idx_attendance_subjects_profile_id
  on attendance_subjects (profile_id);

create index if not exists idx_attendance_students_division
  on attendance_students (division);

create index if not exists idx_attendance_students_latest_import_id
  on attendance_students (latest_import_id);

create index if not exists idx_attendance_student_subjects_student_id
  on attendance_student_subjects (student_id);

create index if not exists idx_attendance_daily_logs_student_id
  on attendance_daily_logs (student_id);

create index if not exists idx_attendance_daily_lecture_logs_student_id
  on attendance_daily_lecture_logs (student_id);

create index if not exists idx_friendships_owner_profile_id
  on friendships (owner_profile_id);
