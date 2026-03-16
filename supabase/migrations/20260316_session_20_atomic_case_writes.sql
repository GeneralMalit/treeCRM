create or replace function public.create_ticket_with_bootstrap_messages(
  p_customer_id uuid,
  p_assigned_to uuid,
  p_title text,
  p_description text,
  p_category text,
  p_attachments jsonb,
  p_priority text,
  p_customer_user_id uuid,
  p_system_message_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_case public.cases%rowtype;
  normalized_description text := trim(coalesce(p_description, ''));
  normalized_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
begin
  if jsonb_typeof(normalized_attachments) <> 'array' then
    raise exception 'ATTACHMENTS_INVALID';
  end if;

  insert into public.cases (
    customer_id,
    assigned_to,
    title,
    description,
    category,
    attachments,
    status,
    priority
  )
  values (
    p_customer_id,
    p_assigned_to,
    p_title,
    coalesce(p_description, ''),
    p_category,
    normalized_attachments,
    'Open',
    p_priority
  )
  returning * into inserted_case;

  insert into public.messages (
    case_id,
    sender_id,
    sender_role,
    message_type,
    message_text
  )
  values (
    inserted_case.id,
    null,
    'Customer',
    'system',
    p_system_message_text
  );

  if normalized_description <> '' then
    insert into public.messages (
      case_id,
      sender_id,
      sender_role,
      message_type,
      message_text
    )
    values (
      inserted_case.id,
      p_customer_user_id,
      'Customer',
      'text',
      normalized_description
    );
  end if;

  return to_jsonb(inserted_case);
end;
$$;

create or replace function public.append_customer_case_message_atomic(
  p_case_id uuid,
  p_customer_id uuid,
  p_sender_id uuid,
  p_message_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_message public.messages%rowtype;
  touched_case uuid;
  normalized_message_text text := trim(coalesce(p_message_text, ''));
begin
  if normalized_message_text = '' then
    raise exception 'MESSAGE_EMPTY';
  end if;

  insert into public.messages (
    case_id,
    sender_id,
    sender_role,
    message_type,
    message_text
  )
  values (
    p_case_id,
    p_sender_id,
    'Customer',
    'text',
    normalized_message_text
  )
  returning * into inserted_message;

  update public.cases
  set updated_at = timezone('utc', now())
  where id = p_case_id
    and customer_id = p_customer_id
  returning id into touched_case;

  if touched_case is null then
    raise exception 'CASE_TOUCH_CONFLICT';
  end if;

  return to_jsonb(inserted_message);
end;
$$;

create or replace function public.append_csr_case_message_atomic(
  p_case_id uuid,
  p_assigned_to uuid,
  p_sender_id uuid,
  p_message_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_message public.messages%rowtype;
  touched_case uuid;
  normalized_message_text text := trim(coalesce(p_message_text, ''));
begin
  if normalized_message_text = '' then
    raise exception 'MESSAGE_EMPTY';
  end if;

  insert into public.messages (
    case_id,
    sender_id,
    sender_role,
    message_type,
    message_text
  )
  values (
    p_case_id,
    p_sender_id,
    'CSR',
    'text',
    normalized_message_text
  )
  returning * into inserted_message;

  update public.cases
  set updated_at = timezone('utc', now())
  where id = p_case_id
    and assigned_to = p_assigned_to
  returning id into touched_case;

  if touched_case is null then
    raise exception 'CASE_TOUCH_CONFLICT';
  end if;

  return to_jsonb(inserted_message);
end;
$$;

grant execute on function public.create_ticket_with_bootstrap_messages(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  uuid,
  text
) to service_role;

grant execute on function public.append_customer_case_message_atomic(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

grant execute on function public.append_csr_case_message_atomic(
  uuid,
  uuid,
  uuid,
  text
) to service_role;
