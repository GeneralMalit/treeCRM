alter table public.cases
  add column if not exists customer_satisfaction_rating smallint,
  add column if not exists customer_satisfaction_submitted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_customer_satisfaction_rating_range'
  ) then
    alter table public.cases
      add constraint cases_customer_satisfaction_rating_range
      check (
        customer_satisfaction_rating is null
        or customer_satisfaction_rating between 1 and 5
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_customer_satisfaction_submitted_requires_rating'
  ) then
    alter table public.cases
      add constraint cases_customer_satisfaction_submitted_requires_rating
      check (
        customer_satisfaction_submitted_at is null
        or customer_satisfaction_rating between 1 and 5
      );
  end if;
end $$;

create index if not exists cases_customer_satisfaction_rating_idx
  on public.cases (customer_satisfaction_rating)
  where customer_satisfaction_rating is not null;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
before update on public.system_settings
for each row
execute function public.set_updated_at();

insert into public.system_settings (key, value, description)
values
  (
    'availability_refresh_minutes',
    '15'::jsonb,
    'How often employee availability indicators should refresh.'
  ),
  (
    'default_case_priority',
    '"Medium"'::jsonb,
    'Default priority used when creating new customer tickets.'
  ),
  (
    'priority_style_map',
    jsonb_build_object(
      'High', jsonb_build_object('label', 'High', 'color', '#B91C1C', 'background', '#FEF2F2'),
      'Medium', jsonb_build_object('label', 'Medium', 'color', '#B45309', 'background', '#FFFBEB'),
      'Low', jsonb_build_object('label', 'Low', 'color', '#1D4ED8', 'background', '#EFF6FF')
    ),
    'Display labels and colors for case priority badges.'
  )
on conflict (key) do nothing;

create or replace function public.auth_role(user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = user_id
  limit 1;
$$;

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role(user_id) = 'Admin', false);
$$;

create or replace function public.is_employee(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_role(user_id) in ('CSR', 'Manager', 'Executive', 'Admin'), false);
$$;

grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.cases to authenticated;
grant select, insert, update, delete on table public.tags to authenticated;
grant select, insert, update, delete on table public.case_tags to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.endorsements to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.system_settings to authenticated;

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.cases enable row level security;
alter table public.tags enable row level security;
alter table public.case_tags enable row level security;
alter table public.messages enable row level security;
alter table public.endorsements enable row level security;
alter table public.notifications enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists users_select_self_or_employee on public.users;
create policy users_select_self_or_employee
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_employee(auth.uid())
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all
  on public.users
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists customers_select_owner_or_employee on public.customers;
create policy customers_select_owner_or_employee
  on public.customers
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_employee(auth.uid())
  );

drop policy if exists customers_insert_owner_or_employee on public.customers;
create policy customers_insert_owner_or_employee
  on public.customers
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_employee(auth.uid())
  );

drop policy if exists customers_update_owner_or_employee on public.customers;
create policy customers_update_owner_or_employee
  on public.customers
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_employee(auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_employee(auth.uid())
  );

drop policy if exists customers_delete_admin_only on public.customers;
create policy customers_delete_admin_only
  on public.customers
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists cases_select_visible_scope on public.cases;
create policy cases_select_visible_scope
  on public.cases
  for select
  to authenticated
  using (
    public.is_employee(auth.uid())
    or exists (
      select 1
      from public.customers customer
      where customer.id = customer_id
        and customer.user_id = auth.uid()
    )
  );

drop policy if exists cases_insert_owner_or_employee on public.cases;
create policy cases_insert_owner_or_employee
  on public.cases
  for insert
  to authenticated
  with check (
    public.is_employee(auth.uid())
    or exists (
      select 1
      from public.customers customer
      where customer.id = customer_id
        and customer.user_id = auth.uid()
    )
  );

drop policy if exists cases_update_employee_only on public.cases;
create policy cases_update_employee_only
  on public.cases
  for update
  to authenticated
  using (public.is_employee(auth.uid()))
  with check (public.is_employee(auth.uid()));

drop policy if exists cases_delete_admin_only on public.cases;
create policy cases_delete_admin_only
  on public.cases
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists tags_select_authenticated on public.tags;
create policy tags_select_authenticated
  on public.tags
  for select
  to authenticated
  using (true);

drop policy if exists tags_manage_admin_only on public.tags;
create policy tags_manage_admin_only
  on public.tags
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists case_tags_select_visible_scope on public.case_tags;
create policy case_tags_select_visible_scope
  on public.case_tags
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cases case_row
      join public.customers customer on customer.id = case_row.customer_id
      where case_row.id = case_id
        and (
          customer.user_id = auth.uid()
          or public.is_employee(auth.uid())
        )
    )
  );

drop policy if exists case_tags_manage_employee_only on public.case_tags;
create policy case_tags_manage_employee_only
  on public.case_tags
  for all
  to authenticated
  using (public.is_employee(auth.uid()))
  with check (public.is_employee(auth.uid()));

drop policy if exists messages_select_visible_scope on public.messages;
create policy messages_select_visible_scope
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cases case_row
      join public.customers customer on customer.id = case_row.customer_id
      where case_row.id = case_id
        and (
          customer.user_id = auth.uid()
          or public.is_employee(auth.uid())
        )
    )
    and (
      message_type <> 'internal_note'
      or public.is_employee(auth.uid())
    )
  );

drop policy if exists messages_insert_customer_or_employee on public.messages;
create policy messages_insert_customer_or_employee
  on public.messages
  for insert
  to authenticated
  with check (
    (
      sender_role = 'Customer'
      and sender_id = auth.uid()
      and message_type = 'text'
      and exists (
        select 1
        from public.cases case_row
        join public.customers customer on customer.id = case_row.customer_id
        where case_row.id = case_id
          and customer.user_id = auth.uid()
      )
    )
    or (
      public.is_employee(auth.uid())
      and sender_id = auth.uid()
      and sender_role = public.auth_role(auth.uid())
      and exists (
        select 1
        from public.cases case_row
        where case_row.id = case_id
      )
    )
  );

drop policy if exists messages_manage_admin_only on public.messages;
create policy messages_manage_admin_only
  on public.messages
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists endorsements_select_employee_only on public.endorsements;
create policy endorsements_select_employee_only
  on public.endorsements
  for select
  to authenticated
  using (public.is_employee(auth.uid()));

drop policy if exists endorsements_insert_employee_only on public.endorsements;
create policy endorsements_insert_employee_only
  on public.endorsements
  for insert
  to authenticated
  with check (
    public.is_employee(auth.uid())
    and endorsed_by = auth.uid()
  );

drop policy if exists endorsements_update_employee_scope on public.endorsements;
create policy endorsements_update_employee_scope
  on public.endorsements
  for update
  to authenticated
  using (
    public.is_admin(auth.uid())
    or endorsed_by = auth.uid()
    or endorsed_to = auth.uid()
  )
  with check (public.is_employee(auth.uid()));

drop policy if exists endorsements_delete_admin_only on public.endorsements;
create policy endorsements_delete_admin_only
  on public.endorsements
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists notifications_select_owner_or_admin on public.notifications;
create policy notifications_select_owner_or_admin
  on public.notifications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists notifications_insert_employee_only on public.notifications;
create policy notifications_insert_employee_only
  on public.notifications
  for insert
  to authenticated
  with check (public.is_employee(auth.uid()));

drop policy if exists notifications_update_owner_or_admin on public.notifications;
create policy notifications_update_owner_or_admin
  on public.notifications
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists notifications_delete_owner_or_admin on public.notifications;
create policy notifications_delete_owner_or_admin
  on public.notifications
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists system_settings_select_authenticated on public.system_settings;
create policy system_settings_select_authenticated
  on public.system_settings
  for select
  to authenticated
  using (true);

drop policy if exists system_settings_manage_admin_only on public.system_settings;
create policy system_settings_manage_admin_only
  on public.system_settings
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
