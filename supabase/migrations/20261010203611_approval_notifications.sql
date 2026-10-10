create table public.approval_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('consultant_feedback','knowledge','company_request','job','course')),
  entity_id uuid not null,
  event_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_notifications_once_per_event unique (recipient_id, entity_type, entity_id, event_type)
);
create index approval_notifications_recipient_created_idx
  on public.approval_notifications (recipient_id, created_at desc);
alter table public.approval_notifications enable row level security;
revoke all on table public.approval_notifications from anon, authenticated;
grant select, insert on table public.approval_notifications to authenticated;
grant update (read_at) on table public.approval_notifications to authenticated;
create policy "recipients read own approval notifications"
  on public.approval_notifications for select to authenticated
  using (recipient_id = (select auth.uid()) or private.is_admin());
create policy "admins send approval notifications"
  on public.approval_notifications for insert to authenticated
  with check (
    private.is_admin()
    and sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
  );
create policy "recipients mark own approval notifications read"
  on public.approval_notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));