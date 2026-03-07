alter table public.users
  add column if not exists manager_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_manager_id_fkey'
  ) then
    alter table public.users
      add constraint users_manager_id_fkey
      foreign key (manager_id)
      references public.users (id)
      on delete set null;
  end if;
end $$;

create index if not exists users_manager_id_idx on public.users (manager_id);
