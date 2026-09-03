-- Enough of Supabase to run the migration chain on stock PostgreSQL.
--
-- The hosted project supplies these roles, schemas, and helper functions
-- before the first migration ever runs, so the chain cannot be applied — or
-- rehearsed — against a plain database without them. Standing them up here
-- makes "does this migration actually apply?" a question that can be answered
-- on a laptop and in CI, instead of only by running it against the client's
-- data and finding out.
--
-- This is a test harness, never a migration: it is applied to a scratch
-- database ahead of supabase/migrations, and nothing here should be taken as
-- a description of the real hosted schema beyond the parts the chain touches.

create extension if not exists pgcrypto;

-- Roles. The chain grants to, revokes from, and writes policies for these by
-- name, so every one must exist before the first grant.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Deliberately NO blanket table privileges for the API roles.
--
-- An earlier version of this file granted them, on the assumption that
-- Supabase hands anon/authenticated full table access and leaves rows to RLS.
-- `supabase start` does not do that for tables created by migrations, and the
-- difference was not academic: it let a pgTAP assertion pass here and fail in
-- CI, which is the exact failure mode a rehearsal harness exists to prevent.
--
-- So the API roles start with nothing and receive only what the migrations
-- grant them explicitly. That makes this shim agree with the `migrations` CI
-- job, and it means a privilege the chain forgets to grant shows up here as a
-- failure rather than as ambient permission inherited from an older project.
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- GoTrue's identity table, reduced to the columns the chain reads: the
-- employee link trigger matches on `email`, and activation is stamped from
-- `last_sign_in_at`.
create schema if not exists auth;
-- The behavior suite seeds this table directly to impersonate real signed-in
-- employees, so it carries the GoTrue columns that seed writes as well as the
-- ones the chain reads.
create table if not exists auth.users(
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
grant usage on schema auth to anon, authenticated, service_role;

-- The request-scoped claims helpers. These read the same
-- `request.jwt.claims` GUC the hosted versions do, which is what lets the
-- pgTAP behavior suite impersonate a signed-in employee with set_config.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon');
$$;

-- Storage. The job-photo policies filter on bucket and path, so the two
-- tables and the two path helpers are all the chain needs.
create schema if not exists storage;
create table if not exists storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table if not exists storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  -- Storage carries both: `owner` is the legacy uuid, `owner_id` the text
  -- column the photo policies actually filter on.
  owner_id text,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;

/** The path split Supabase exposes: 'job-id/photo.jpg' becomes {job-id,photo.jpg}. */
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;

/** The final extension in a storage key, without its dot. */
create or replace function storage.extension(name text)
returns text language sql immutable as $$
  select nullif(split_part(name, '.', array_length(string_to_array(name, '.'), 1)), name);
$$;

-- Realtime's publication. Migrations add tables to it by name; without it
-- every `alter publication` in the chain fails.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
