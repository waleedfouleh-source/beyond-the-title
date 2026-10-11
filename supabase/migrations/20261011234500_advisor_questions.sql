-- Human-reviewed advisor questions and private replies.
create table if not exists public.advisor_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 3000),
  status text not null default 'new' check (status in ('new','in_review','answered')),
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 3000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_advisor_questions_status_created
  on public.advisor_questions(status, created_at desc);
create index if not exists idx_advisor_questions_user_created
  on public.advisor_questions(user_id, created_at desc);

alter table public.advisor_questions enable row level security;
grant select, insert, update on public.advisor_questions to authenticated;

drop policy if exists "advisor questions own read or admin" on public.advisor_questions;
create policy "advisor questions own read or admin"
on public.advisor_questions for select to authenticated
using (user_id=(select auth.uid()) or private.is_admin());

drop policy if exists "advisor questions own insert" on public.advisor_questions;
create policy "advisor questions own insert"
on public.advisor_questions for insert to authenticated
with check (user_id=(select auth.uid()) and status='new' and admin_reply is null and replied_at is null);

drop policy if exists "advisor questions admin update" on public.advisor_questions;
create policy "advisor questions admin update"
on public.advisor_questions for update to authenticated
using (private.is_admin())
with check (private.is_admin());
