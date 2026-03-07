grant select, insert, update, delete on table public.internal_messages to authenticated;

alter table public.internal_messages enable row level security;

drop policy if exists internal_messages_select_participants on public.internal_messages;
create policy internal_messages_select_participants
  on public.internal_messages
  for select
  to authenticated
  using (
    public.is_employee(auth.uid())
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

drop policy if exists internal_messages_insert_sender_employee on public.internal_messages;
create policy internal_messages_insert_sender_employee
  on public.internal_messages
  for insert
  to authenticated
  with check (
    public.is_employee(auth.uid())
    and sender_id = auth.uid()
    and sender_id <> recipient_id
    and exists (
      select 1
      from public.users recipient_user
      where recipient_user.id = recipient_id
        and recipient_user.role in ('CSR', 'Manager', 'Executive', 'Admin')
    )
  );

drop policy if exists internal_messages_manage_admin_only on public.internal_messages;
create policy internal_messages_manage_admin_only
  on public.internal_messages
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists internal_messages_delete_admin_only on public.internal_messages;
create policy internal_messages_delete_admin_only
  on public.internal_messages
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));
