create extension if not exists pgcrypto;

create table if not exists attendance_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  name text not null,
  created_at timestamptz not null default now()
);

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

create table if not exists friendships (
  owner_profile_id uuid not null references attendance_profiles(id) on delete cascade,
  friend_profile_id uuid not null references attendance_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_profile_id, friend_profile_id),
  check (owner_profile_id <> friend_profile_id)
);

create index if not exists idx_attendance_subjects_profile_id
  on attendance_subjects (profile_id);

create index if not exists idx_friendships_owner_profile_id
  on friendships (owner_profile_id);
