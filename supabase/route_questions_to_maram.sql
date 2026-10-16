-- Run in the Supabase SQL Editor of Beyond the Title (obndotlxnzkiaalycumh).
-- Retains all existing questions and replies; safe to rerun.
begin;
alter table public.advisor_questions enable row level security;
grant select, insert on public.advisor_questions to authenticated;
-- Only allow consultants to update workflow/reply fields (not question or user_id).
revoke update on public.advisor_questions from authenticated;
grant update(status, admin_reply, replied_at, updated_at) on public.advisor_questions to authenticated;
drop policy if exists "advisor questions own read or admin" on public.advisor_questions;
drop policy if exists "advisor questions own or consultant read" on public.advisor_questions;
create policy "advisor questions own or consultant read"
on public.advisor_questions for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_consultant()));
drop policy if exists "advisor questions own insert" on public.advisor_questions;
create policy "advisor questions own insert"
on public.advisor_questions for insert to authenticated
with check (user_id=(select auth.uid()) and status='new' and admin_reply is null and replied_at is null);
drop policy if exists "advisor questions admin update" on public.advisor_questions;
drop policy if exists "advisor questions consultant update" on public.advisor_questions;
create policy "advisor questions consultant update"
on public.advisor_questions for update to authenticated
using ((select private.is_consultant()))
with check ((select private.is_consultant()));
commit;
