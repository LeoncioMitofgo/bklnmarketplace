-- Fase 1.4 · Contacto: conversaciones, mensajes, bloqueos, tiempo real y botón de WhatsApp.
-- Especificación: MODELO-DATOS §3.4, §5.5, §7 (chat-images), §8 (Realtime), §10 y §11.

-- ─── Tablas ──────────────────────────────────────────────────────────────────

-- Una conversación por (anuncio, comprador). Si se borra una cuenta o un anuncio, la conversación
-- se conserva para la otra parte ("Usuario eliminado", "Anuncio eliminado"; D-030).
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  -- Null hasta el primer mensaje: la bandeja no muestra conversaciones vacías.
  last_message_at timestamptz,
  -- Primeros 100 caracteres del último mensaje; null si fue solo una foto.
  last_message_preview text,
  last_sender_id uuid references public.profiles (id) on delete set null,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_parties check (buyer_id is distinct from seller_id or buyer_id is null),
  constraint conversations_listing_buyer_unique unique (listing_id, buyer_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text check (body is null or (char_length(body) <= 2000 and btrim(body) <> '')),
  -- Ruta en el bucket privado chat-images: {conversation_id}/{uuid}.{webp|jpg}
  image_path text,
  created_at timestamptz not null default now(),
  constraint messages_has_content check (body is not null or image_path is not null)
);

create index messages_conversation_idx on public.messages (conversation_id, id desc);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Conversaciones y mensajes solo se leen; se crean por RPC (start_conversation, send_message).

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;

create policy conversations_select_participants on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

create policy messages_select_participants on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)
  ));

create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.conversations, public.messages, public.blocks from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

-- ─── Ajustes ─────────────────────────────────────────────────────────────────

update public.app_settings
set value = value || '{"messages_per_minute": 30}'::jsonb
where key = 'rate_limits';

-- ─── Comprobaciones comunes ─────────────────────────────────────────────────

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create or replace function public.chat_assert_can_write(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and status <> 'active')
     or exists (select 1 from public.profile_private where user_id = p_user_id and suspended_until > now()) then
    raise exception 'account_restricted' using errcode = 'P0001';
  end if;
end;
$$;

-- Límite de ritmo leído de app_settings.rate_limits (más estricto para cuentas recientes si hay clave *_new_account).
create or replace function public.chat_rate_limit(p_user_id uuid, p_scope text, p_key text, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits jsonb := (select value from public.app_settings where key = 'rate_limits');
  v_is_new boolean;
  v_max integer;
begin
  select created_at > now() - make_interval(days => coalesce((v_limits ->> 'new_account_days')::int, 7))
  into v_is_new
  from public.profiles where id = p_user_id;

  v_max := coalesce(
    case when v_is_new then (v_limits ->> (p_key || '_new_account'))::int end,
    (v_limits ->> p_key)::int
  );
  if v_max is not null
     and not public.check_rate_limit(p_scope || ':' || p_user_id::text, v_max, p_window_seconds) then
    raise exception 'chat_rate_limited' using errcode = 'P0001';
  end if;
end;
$$;

-- ─── Conversaciones ──────────────────────────────────────────────────────────

-- Devuelve la conversación del usuario con este anuncio o la crea (MODELO-DATOS §5.5).
create or replace function public.start_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_status public.listing_status;
  v_id uuid;
begin
  perform public.chat_assert_can_write(v_uid);

  select c.id into v_id
  from public.conversations c
  where c.listing_id = p_listing_id and c.buyer_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  select l.user_id, l.status into v_seller, v_status
  from public.listings l where l.id = p_listing_id;
  if v_seller is null or v_status <> 'active' then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;
  if v_seller = v_uid then
    raise exception 'own_listing' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(v_uid, v_seller) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;
  perform public.chat_rate_limit(v_uid, 'conversations', 'conversations_per_hour', 3600);

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, v_uid, v_seller)
  on conflict on constraint conversations_listing_buyer_unique
    do update set listing_id = excluded.listing_id
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text default null,
  p_image_path text default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_message public.messages;
begin
  perform public.chat_assert_can_write(v_uid);

  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found or (v_conv.buyer_id is distinct from v_uid and v_conv.seller_id is distinct from v_uid) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  v_other := case when v_conv.buyer_id = v_uid then v_conv.seller_id else v_conv.buyer_id end;
  if v_other is null then
    raise exception 'recipient_deleted' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(v_uid, v_other) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;

  if v_body is null and p_image_path is null then
    raise exception 'message_empty' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;
  if p_image_path is not null and (
    p_image_path not like p_conversation_id::text || '/%'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'chat-images' and o.name = p_image_path)
  ) then
    raise exception 'image_invalid' using errcode = 'P0001';
  end if;

  perform public.chat_rate_limit(v_uid, 'messages', 'messages_per_minute', 60);

  insert into public.messages (conversation_id, sender_id, body, image_path)
  values (p_conversation_id, v_uid, v_body, p_image_path)
  returning * into v_message;
  return v_message;
end;
$$;

-- Tras cada mensaje: actualiza la bandeja y avisa en tiempo real (MODELO-DATOS §8).
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_recipient uuid;
begin
  update public.conversations c
  set last_message_at = new.created_at,
      last_message_preview = left(new.body, 100),
      last_sender_id = new.sender_id,
      buyer_last_read_at = case when c.buyer_id = new.sender_id then new.created_at else c.buyer_last_read_at end,
      seller_last_read_at = case when c.seller_id = new.sender_id then new.created_at else c.seller_last_read_at end
  where c.id = new.conversation_id
  returning * into v_conv;

  v_recipient := case when v_conv.buyer_id = new.sender_id then v_conv.seller_id else v_conv.buyer_id end;

  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'conversation_id', new.conversation_id,
      'sender_id', new.sender_id,
      'body', new.body,
      'image_path', new.image_path,
      'created_at', new.created_at
    ),
    'message',
    'conversation:' || new.conversation_id::text,
    true
  );
  if v_recipient is not null then
    perform realtime.send(
      jsonb_build_object('conversation_id', new.conversation_id),
      'inbox',
      'user:' || v_recipient::text,
      true
    );
  end if;
  return null;
end;
$$;

create trigger messages_after_insert
after insert on public.messages
for each row execute function public.messages_after_insert();

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  update public.conversations c
  set buyer_last_read_at = case when c.buyer_id = v_uid then v_now else c.buyer_last_read_at end,
      seller_last_read_at = case when c.seller_id = v_uid then v_now else c.seller_last_read_at end
  where c.id = p_conversation_id and v_uid in (c.buyer_id, c.seller_id);

  if found then
    perform realtime.send(
      jsonb_build_object('reader_id', v_uid, 'read_at', v_now),
      'read',
      'conversation:' || p_conversation_id::text,
      true
    );
  end if;
end;
$$;

-- Mensajes sin leer de todas mis conversaciones (contador de la barra inferior).
create or replace function public.unread_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
    and m.sender_id is distinct from (select auth.uid())
    and m.created_at > coalesce(
      case when c.buyer_id = (select auth.uid()) then c.buyer_last_read_at else c.seller_last_read_at end,
      '-infinity'::timestamptz
    );
$$;

-- Bandeja (o una conversación con p_conversation_id) con la otra persona y el anuncio.
-- security definer: el anuncio puede no ser ya visible (vendido hace tiempo, pausado, eliminado)
-- y la conversación tiene que seguir mostrando su estado (ALCANCE §4.5).
create or replace function public.my_conversations(
  p_role text default null,
  p_conversation_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  role text,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_response_time_minutes integer,
  other_is_premium boolean,
  listing_id uuid,
  listing_code text,
  listing_title text,
  listing_status public.listing_status,
  listing_price_xaf bigint,
  listing_is_negotiable boolean,
  listing_category_id integer,
  listing_city_id smallint,
  cover_path text,
  cover_format text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_is_me boolean,
  unread_count integer,
  other_last_read_at timestamptz,
  blocked_by_me boolean,
  blocked_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case when c.buyer_id = me.uid then 'buyer' else 'seller' end,
    o.id,
    o.username,
    o.display_name,
    o.response_time_minutes,
    coalesce(o.premium_until > now(), false),
    l.id,
    l.code,
    case when l.status in ('blocked', 'under_review', 'deleted') then null else l.title end,
    l.status,
    l.price_xaf,
    coalesce(l.is_negotiable, false),
    l.category_id,
    l.city_id,
    cover.storage_path,
    cover.format,
    c.last_message_at,
    c.last_message_preview,
    c.last_sender_id = me.uid,
    (
      select count(*)::int from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from me.uid
        and m.created_at > coalesce(
          case when c.buyer_id = me.uid then c.buyer_last_read_at else c.seller_last_read_at end,
          '-infinity'::timestamptz
        )
    ),
    case when c.buyer_id = me.uid then c.seller_last_read_at else c.buyer_last_read_at end,
    exists (select 1 from public.blocks b where b.blocker_id = me.uid and b.blocked_id = o.id),
    exists (select 1 from public.blocks b where b.blocker_id = o.id and b.blocked_id = me.uid)
  from (select auth.uid() as uid) me
  join public.conversations c on me.uid in (c.buyer_id, c.seller_id)
  left join public.profiles o
    on o.id = case when c.buyer_id = me.uid then c.seller_id else c.buyer_id end
  left join public.listings l on l.id = c.listing_id
  left join lateral (
    select i.storage_path, i.format
    from public.listing_images i
    where i.listing_id = l.id and l.status not in ('blocked', 'under_review', 'deleted')
    order by i.position
    limit 1
  ) cover on true
  where (
      (p_conversation_id is null and c.last_message_at is not null)
      or c.id = p_conversation_id
    )
    and (
      p_role is null
      or (p_role = 'buyer' and c.buyer_id = me.uid)
      or (p_role = 'seller' and c.seller_id = me.uid)
    )
  order by c.last_message_at desc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ─── WhatsApp (ALCANCE §5.4) ─────────────────────────────────────────────────

-- ¿Mostrar el botón? Solo con sesión, si el vendedor lo activó y no es tu anuncio.
create or replace function public.listing_whatsapp_enabled(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.listings l
    join public.profile_private pp on pp.user_id = l.user_id
    where l.id = p_listing_id
      and l.status = 'active'
      and pp.show_whatsapp
      and (select auth.uid()) is not null
      and l.user_id <> (select auth.uid())
  );
$$;

-- El teléfono del vendedor, solo al pulsar el botón y con un tope diario (evita recolectar teléfonos).
create or replace function public.whatsapp_contact(p_listing_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_phone text;
  v_show boolean;
begin
  perform public.chat_assert_can_write(v_uid);

  select l.user_id, pp.phone, pp.show_whatsapp into v_seller, v_phone, v_show
  from public.listings l
  join public.profile_private pp on pp.user_id = l.user_id
  where l.id = p_listing_id and l.status = 'active';
  if v_seller is null or not v_show or v_seller = v_uid then
    raise exception 'whatsapp_unavailable' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(v_uid, v_seller) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;
  perform public.chat_rate_limit(v_uid, 'whatsapp', 'whatsapp_reveals_per_day', 86400);
  return v_phone;
end;
$$;

-- ─── Tiempo de respuesta (MODELO-DATOS §10) ─────────────────────────────────

-- Mediana, en los últimos 90 días, del tiempo entre el primer mensaje del comprador y la primera
-- respuesta del vendedor. Null si tiene menos de 3 conversaciones respondidas.
create or replace function public.compute_response_times()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with firsts as (
    select
      c.seller_id,
      fb.asked_at,
      (
        select min(m.created_at) from public.messages m
        where m.conversation_id = c.id and m.sender_id = c.seller_id and m.created_at > fb.asked_at
      ) as replied_at
    from public.conversations c
    cross join lateral (
      select min(m.created_at) as asked_at from public.messages m
      where m.conversation_id = c.id and m.sender_id = c.buyer_id
    ) fb
    where c.seller_id is not null and fb.asked_at > now() - interval '90 days'
  ),
  stats as (
    select
      seller_id,
      round(percentile_cont(0.5) within group (
        order by extract(epoch from (replied_at - asked_at)) / 60
      ))::int as minutes
    from firsts
    where replied_at is not null
    group by seller_id
    having count(*) >= 3
  )
  update public.profiles p
  set response_time_minutes = s.minutes
  from (
    select p2.id, st.minutes
    from public.profiles p2
    left join stats st on st.seller_id = p2.id
    where st.minutes is not null or p2.response_time_minutes is not null
  ) s
  where p.id = s.id and p.response_time_minutes is distinct from s.minutes;
end;
$$;

select cron.schedule('chat-response-times-daily', '30 3 * * *', $$select public.compute_response_times();$$);

-- ─── Fotos del chat (bucket privado, MODELO-DATOS §7) ───────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Solo los participantes pueden leer (y firmar URLs de) las fotos de su conversación.
-- Se sube con URLs firmadas que crea el servidor: los usuarios no escriben en Storage (D-039).
create policy chat_images_select_participants on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );

-- ─── Tiempo real: canales privados (MODELO-DATOS §8) ────────────────────────

-- conversation:{id} solo para sus participantes; user:{id} solo para ese usuario.
-- Los clientes no pueden emitir: no hay política de insert.
create policy chat_receive_broadcasts on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (select realtime.topic()) = 'user:' || (select auth.uid())::text
      or exists (
        select 1 from public.conversations c
        where (select realtime.topic()) = 'conversation:' || c.id::text
          and (select auth.uid()) in (c.buyer_id, c.seller_id)
      )
    )
  );

-- ─── Permisos de funciones ───────────────────────────────────────────────────

revoke all on function
  public.is_blocked_between(uuid, uuid),
  public.chat_assert_can_write(uuid),
  public.chat_rate_limit(uuid, text, text, integer),
  public.messages_after_insert(),
  public.compute_response_times(),
  public.start_conversation(uuid),
  public.send_message(uuid, text, text),
  public.mark_conversation_read(uuid),
  public.unread_count(),
  public.my_conversations(text, uuid, integer),
  public.listing_whatsapp_enabled(uuid),
  public.whatsapp_contact(uuid)
from public, anon, authenticated;

grant execute on function
  public.start_conversation(uuid),
  public.send_message(uuid, text, text),
  public.mark_conversation_read(uuid),
  public.unread_count(),
  public.my_conversations(text, uuid, integer),
  public.listing_whatsapp_enabled(uuid),
  public.whatsapp_contact(uuid)
to authenticated;
