-- Beyond the Title | Supabase schema
create extension if not exists pgcrypto;
create extension if not exists vector;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'candidate'
    check (role in ('candidate','employer','admin','consultant')),
  city text,
  headline text,
  skills text[],
  created_at timestamptz default now()
);

create table if not exists private.staff_email_roles (
  email text primary key,
  role text not null check (role in ('admin','consultant')),
  created_at timestamptz not null default now()
);

revoke all on schema private from public;
revoke all on table private.staff_email_roles from public, anon, authenticated;

create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  body text not null,
  status text not null default 'draft'
    check(status in ('draft','approved','paused')),
  source_role text not null default 'general'
    check(source_role in ('general','consultant','admin')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge(id) on delete cascade,
  content text not null,
  embedding vector(1536)
);

create table if not exists public.consultant_feedback (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null default 'suggestion'
    check(feedback_type in ('suggestion','observation','data','correction','feature_request')),
  title text not null,
  body text not null,
  priority text not null default 'normal'
    check(priority in ('low','normal','high')),
  status text not null default 'new'
    check(status in ('new','reviewed','accepted','rejected','implemented')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references auth.users(id),
  title text not null,
  company text not null,
  location text,
  description text,
  requirements text,
  status text not null default 'draft'
    check(status in ('draft','published','closed')),
  created_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text,
  status text default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.cv_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  file_path text,
  analysis jsonb,
  created_at timestamptz default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id),
  user_id uuid references auth.users(id),
  status text default 'submitted',
  created_at timestamptz default now(),
  unique(job_id,user_id)
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=(select auth.uid()) and role='admin'
  )
$$;

create or replace function private.is_consultant()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=(select auth.uid()) and role='consultant'
  )
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.is_consultant() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_consultant() to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $$
declare
  assigned_role text;
begin
  select ser.role into assigned_role
  from private.staff_email_roles ser
  where lower(ser.email)=lower(new.email)
  limit 1;

  insert into public.profiles(id,full_name,role)
  values(
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name',''),
    coalesce(assigned_role,'candidate')
  )
  on conflict(id) do update
  set full_name=coalesce(public.profiles.full_name,excluded.full_name),
      role=case
        when assigned_role is not null then assigned_role
        else public.profiles.role
      end;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.knowledge enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.consultant_feedback enable row level security;
alter table public.jobs enable row level security;
alter table public.courses enable row level security;
alter table public.cv_reports enable row level security;
alter table public.applications enable row level security;

revoke all on table public.profiles from anon,authenticated;
revoke all on table public.knowledge from anon,authenticated;
revoke all on table public.knowledge_chunks from anon,authenticated;
revoke all on table public.consultant_feedback from anon,authenticated;
revoke all on table public.jobs from anon,authenticated;
revoke all on table public.courses from anon,authenticated;
revoke all on table public.cv_reports from anon,authenticated;
revoke all on table public.applications from anon,authenticated;

grant select,insert,update,delete on public.profiles to authenticated;
grant select on public.knowledge to anon;
grant select,insert,update,delete on public.knowledge to authenticated;
grant select,insert,update,delete on public.knowledge_chunks to authenticated;
grant select,insert,update,delete on public.consultant_feedback to authenticated;
grant select on public.jobs to anon;
grant select,insert,update,delete on public.jobs to authenticated;
grant select on public.courses to anon;
grant select,insert,update,delete on public.courses to authenticated;
grant select,insert,update,delete on public.cv_reports to authenticated;
grant select,insert,update,delete on public.applications to authenticated;

create policy "profile read own or admin"
on public.profiles for select to authenticated
using (id=(select auth.uid()) or private.is_admin());

create policy "profile insert own candidate"
on public.profiles for insert to authenticated
with check (id=(select auth.uid()) and role='candidate');

create policy "profile update own candidate"
on public.profiles for update to authenticated
using (id=(select auth.uid()) and role='candidate')
with check (id=(select auth.uid()) and role='candidate');

create policy "profile admin update"
on public.profiles for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "approved knowledge public read"
on public.knowledge for select to anon,authenticated
using (status='approved');

create policy "knowledge admin read"
on public.knowledge for select to authenticated
using (private.is_admin());

create policy "knowledge admin insert"
on public.knowledge for insert to authenticated
with check (
  private.is_admin()
  and created_by=(select auth.uid())
  and source_role='admin'
);

create policy "knowledge admin update"
on public.knowledge for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "knowledge admin delete"
on public.knowledge for delete to authenticated
using (private.is_admin());

create policy "knowledge consultant read own"
on public.knowledge for select to authenticated
using (
  private.is_consultant()
  and created_by=(select auth.uid())
);

create policy "knowledge consultant insert draft"
on public.knowledge for insert to authenticated
with check (
  private.is_consultant()
  and created_by=(select auth.uid())
  and status='draft'
  and source_role='consultant'
);

create policy "knowledge consultant update own draft"
on public.knowledge for update to authenticated
using (
  private.is_consultant()
  and created_by=(select auth.uid())
  and status='draft'
)
with check (
  private.is_consultant()
  and created_by=(select auth.uid())
  and status='draft'
  and source_role='consultant'
);

create policy "knowledge consultant delete own draft"
on public.knowledge for delete to authenticated
using (
  private.is_consultant()
  and created_by=(select auth.uid())
  and status='draft'
);

create policy "knowledge chunks admin"
on public.knowledge_chunks for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "consultant feedback read own or admin"
on public.consultant_feedback for select to authenticated
using (
  consultant_id=(select auth.uid())
  or private.is_admin()
);

create policy "consultant feedback consultant insert"
on public.consultant_feedback for insert to authenticated
with check (
  consultant_id=(select auth.uid())
  and private.is_consultant()
  and status='new'
);

create policy "consultant feedback admin update"
on public.consultant_feedback for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "consultant feedback admin delete"
on public.consultant_feedback for delete to authenticated
using (private.is_admin());

create policy "jobs public published"
on public.jobs for select to anon,authenticated
using (status='published');

create policy "jobs owner or admin read"
on public.jobs for select to authenticated
using (
  employer_id=(select auth.uid())
  or private.is_admin()
);

create policy "jobs employer insert"
on public.jobs for insert to authenticated
with check (
  employer_id=(select auth.uid())
  or private.is_admin()
);

create policy "jobs employer update"
on public.jobs for update to authenticated
using (
  employer_id=(select auth.uid())
  or private.is_admin()
)
with check (
  employer_id=(select auth.uid())
  or private.is_admin()
);

create policy "jobs employer delete"
on public.jobs for delete to authenticated
using (
  employer_id=(select auth.uid())
  or private.is_admin()
);

create policy "courses public"
on public.courses for select to anon,authenticated
using (status='published');

create policy "courses admin"
on public.courses for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "reports private"
on public.cv_reports for select to authenticated
using (
  user_id=(select auth.uid())
  or private.is_admin()
);

create policy "reports insert own"
on public.cv_reports for insert to authenticated
with check (user_id=(select auth.uid()));

create policy "applications own"
on public.applications for select to authenticated
using (
  user_id=(select auth.uid())
  or private.is_admin()
  or exists(
    select 1 from public.jobs
    where jobs.id=job_id
      and jobs.employer_id=(select auth.uid())
  )
);

create policy "applications own insert"
on public.applications for insert to authenticated
with check (user_id=(select auth.uid()));

create index if not exists idx_consultant_feedback_consultant_id
  on public.consultant_feedback(consultant_id);
create index if not exists idx_consultant_feedback_reviewed_by
  on public.consultant_feedback(reviewed_by);
create index if not exists idx_knowledge_created_by
  on public.knowledge(created_by);
create index if not exists idx_knowledge_approved_by
  on public.knowledge(approved_by);

-- IMPORTANT:
-- Keep real staff emails out of this public repository.
-- Seed private.staff_email_roles directly in the Supabase SQL editor.


-- Functional test flows
alter table public.profiles add column if not exists experience_years integer;
alter table public.profiles add column if not exists target_field text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.cv_reports add column if not exists file_name text;
alter table public.cv_reports add column if not exists status text not null default 'ready';

create table if not exists public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  source_type text not null default 'test_advisor',
  created_at timestamptz not null default now()
);
alter table public.advisor_messages enable row level security;
grant select,insert on public.advisor_messages to authenticated;
drop policy if exists "advisor own read" on public.advisor_messages;
create policy "advisor own read" on public.advisor_messages for select to authenticated
using (user_id=(select auth.uid()) or private.is_admin());
drop policy if exists "advisor own insert" on public.advisor_messages;
create policy "advisor own insert" on public.advisor_messages for insert to authenticated
with check (user_id=(select auth.uid()));

create table if not exists public.company_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  work_email text not null,
  job_title text not null,
  requirements text,
  submitted_by uuid references auth.users(id) on delete set null,
  status text not null default 'new' check(status in ('new','reviewed','converted','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.company_requests enable row level security;
grant insert on public.company_requests to anon,authenticated;
grant select,update on public.company_requests to authenticated;
drop policy if exists "company request public insert" on public.company_requests;
create policy "company request public insert" on public.company_requests for insert to anon,authenticated
with check (status='new');
drop policy if exists "company request admin read" on public.company_requests;
create policy "company request admin read" on public.company_requests for select to authenticated
using (private.is_admin());
drop policy if exists "company request admin update" on public.company_requests;
create policy "company request admin update" on public.company_requests for update to authenticated
using (private.is_admin()) with check (private.is_admin());

create or replace function private.is_employer()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='employer')
$$;
revoke all on function private.is_employer() from public,anon;
grant execute on function private.is_employer() to authenticated;

drop policy if exists "jobs employer insert" on public.jobs;
create policy "jobs employer insert" on public.jobs for insert to authenticated
with check (private.is_admin() or (private.is_employer() and employer_id=(select auth.uid())));
drop policy if exists "jobs employer update" on public.jobs;
create policy "jobs employer update" on public.jobs for update to authenticated
using (private.is_admin() or (private.is_employer() and employer_id=(select auth.uid())))
with check (private.is_admin() or (private.is_employer() and employer_id=(select auth.uid())));
drop policy if exists "jobs employer delete" on public.jobs;
create policy "jobs employer delete" on public.jobs for delete to authenticated
using (private.is_admin() or (private.is_employer() and employer_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cv-files','cv-files',false,5242880,array[
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "cv upload own folder" on storage.objects;
create policy "cv upload own folder" on storage.objects for insert to authenticated
with check(bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cv read own folder" on storage.objects;
create policy "cv read own folder" on storage.objects for select to authenticated
using(bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cv update own folder" on storage.objects;
create policy "cv update own folder" on storage.objects for update to authenticated
using(bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "cv delete own folder" on storage.objects;
create policy "cv delete own folder" on storage.objects for delete to authenticated
using(bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

create index if not exists idx_advisor_messages_user_id on public.advisor_messages(user_id);
create index if not exists idx_company_requests_status on public.company_requests(status);
