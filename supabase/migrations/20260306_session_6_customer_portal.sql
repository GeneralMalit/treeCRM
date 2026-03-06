alter table public.cases
  add column if not exists category text not null default 'General',
  add column if not exists attachments jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_attachments_must_be_array'
  ) then
    alter table public.cases
      add constraint cases_attachments_must_be_array
      check (jsonb_typeof(attachments) = 'array');
  end if;
end $$;

create index if not exists cases_category_idx on public.cases (category);
