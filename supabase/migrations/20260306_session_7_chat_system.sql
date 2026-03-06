create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  message_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint internal_messages_sender_recipient_check check (sender_id <> recipient_id)
);

create index if not exists internal_messages_sender_id_idx
  on public.internal_messages (sender_id);

create index if not exists internal_messages_recipient_id_idx
  on public.internal_messages (recipient_id);

create index if not exists internal_messages_created_at_idx
  on public.internal_messages (created_at);

create index if not exists internal_messages_participants_created_at_idx
  on public.internal_messages (sender_id, recipient_id, created_at);
