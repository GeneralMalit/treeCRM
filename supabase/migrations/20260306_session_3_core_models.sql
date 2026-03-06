create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role text not null default 'Customer' check (role in ('CSR', 'Manager', 'Executive', 'Admin', 'Customer')),
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.sync_auth_user_to_public_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text;
  normalized_name text;
begin
  normalized_role := case
    when coalesce(new.raw_user_meta_data ->> 'role', '') in ('CSR', 'Manager', 'Executive', 'Admin', 'Customer')
      then new.raw_user_meta_data ->> 'role'
    else 'Customer'
  end;

  normalized_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');

  insert into public.users (id, email, name, role, created_at)
  values (
    new.id,
    coalesce(new.email, ''),
    normalized_name,
    normalized_role,
    coalesce(new.created_at, timezone('utc', now()))
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role;

  return new;
end;
$$;

create or replace function public.delete_public_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_created_or_updated on auth.users;
create trigger on_auth_user_created_or_updated
after insert or update on auth.users
for each row
execute function public.sync_auth_user_to_public_users();

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
after delete on auth.users
for each row
execute function public.delete_public_user_from_auth();

insert into public.users (id, email, name, role, created_at)
select
  users.id,
  coalesce(users.email, ''),
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'name', '')), ''),
  case
    when coalesce(users.raw_user_meta_data ->> 'role', '') in ('CSR', 'Manager', 'Executive', 'Admin', 'Customer')
      then users.raw_user_meta_data ->> 'role'
    else 'Customer'
  end,
  coalesce(users.created_at, timezone('utc', now()))
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  company text not null,
  contact_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Resolved', 'Dropped')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6B7280',
  affects_node_color boolean not null default false
);

create table if not exists public.case_tags (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (case_id, tag_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  sender_role text not null check (sender_role in ('CSR', 'Manager', 'Executive', 'Admin', 'Customer')),
  message_type text not null default 'text' check (message_type in ('text', 'internal_note', 'system')),
  message_text text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.endorsements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  endorsed_by uuid not null references public.users(id) on delete cascade,
  endorsed_to uuid not null references public.users(id) on delete cascade,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Rejected', 'Cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists cases_customer_id_idx on public.cases (customer_id);
create index if not exists cases_assigned_to_idx on public.cases (assigned_to);
create index if not exists cases_status_idx on public.cases (status);
create index if not exists messages_case_id_idx on public.messages (case_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists endorsements_case_id_idx on public.endorsements (case_id);
create index if not exists endorsements_endorsed_to_idx on public.endorsements (endorsed_to);
create index if not exists notifications_user_id_idx on public.notifications (user_id);

drop trigger if exists set_cases_updated_at on public.cases;
create trigger set_cases_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();
