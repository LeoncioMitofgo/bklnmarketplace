-- Fase 1.6 (primera parte) · Premium y administración: solicitudes y cobros de Premium,
-- acciones de moderación del admin, lectura de chats denunciados y métricas.
-- Especificación: ALCANCE §4.9, §4.11 y §5.3; MODELO-DATOS §3.6, §5.3, §5.7 y §6. Decisión D-057.

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.payment_method as enum (
  'cash_office', 'money_transfer_agency', 'bank_transfer', 'rosa_money'
);
create type public.premium_request_status as enum ('pending', 'completed', 'cancelled');

-- ─── Tablas ──────────────────────────────────────────────────────────────────

-- Solicitud del usuario antes de pagar. Como mucho una pendiente por usuario.
create table public.premium_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  months smallint not null check (months between 1 and 24),
  -- Copia del precio en el momento de la solicitud.
  price_xaf integer not null check (price_xaf >= 0),
  payment_method public.payment_method not null,
  status public.premium_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.profiles (id) on delete set null
);

create unique index premium_requests_one_pending on public.premium_requests (user_id)
  where status = 'pending';
create index premium_requests_pending_idx on public.premium_requests (created_at)
  where status = 'pending';

-- Cada cobro registrado. Se conserva siempre (contabilidad), aunque se borre la cuenta.
create table public.premium_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  request_id uuid references public.premium_requests (id) on delete set null,
  months smallint not null check (months between 1 and 24),
  amount_xaf integer not null check (amount_xaf >= 0),
  method public.payment_method not null,
  -- Recibo o código del envío, normalizado: mayúsculas y sin espacios.
  reference text not null check (reference ~ '^[A-Z0-9/._-]{1,60}$'),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  created_by uuid references public.profiles (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  -- Cada recibo o código solo se usa una vez (D-025).
  constraint premium_activations_reference_unique unique (method, reference)
);

create index premium_activations_user_idx on public.premium_activations (user_id, created_at desc);
create index premium_activations_created_idx on public.premium_activations (created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Las dos tablas se escriben solo por RPC.

alter table public.premium_requests enable row level security;
alter table public.premium_activations enable row level security;

create policy premium_requests_select_own_or_admin on public.premium_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy premium_activations_select_own_or_admin on public.premium_activations
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.premium_requests, public.premium_activations from anon, authenticated;
grant select on public.premium_requests, public.premium_activations to authenticated;

-- El admin lee las conversaciones denunciadas, sus mensajes y sus fotos (MODELO-DATOS §6).
create policy conversations_select_admin_reported on public.conversations
  for select to authenticated
  using (
    (select public.is_admin())
    and exists (select 1 from public.reports r where r.conversation_id = conversations.id)
  );

create policy messages_select_admin_reported on public.messages
  for select to authenticated
  using (
    (select public.is_admin())
    and exists (select 1 from public.reports r where r.conversation_id = messages.conversation_id)
  );

create policy chat_images_select_admin_reported on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (select public.is_admin())
    and exists (
      select 1 from public.reports r
      where r.conversation_id::text = (storage.foldername(name))[1]
    )
  );

-- ─── Solicitud de Premium (usuario) ──────────────────────────────────────────

-- Crea la solicitud pendiente o cambia la que ya había (periodo y forma de pago).
-- En el MVP solo se paga en la oficina o por agencia (D-025).
create or replace function public.request_premium(p_months smallint, p_method public.payment_method)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_id uuid;
begin
  perform public.chat_assert_can_write(v_uid);
  if p_method not in ('cash_office', 'money_transfer_agency') then
    raise exception 'premium_invalid' using errcode = 'P0001';
  end if;
  select price_xaf into v_price
  from public.plan_prices
  where plan_id = 'premium' and months = p_months and is_active;
  if not found then
    raise exception 'premium_invalid' using errcode = 'P0001';
  end if;

  update public.premium_requests
  set months = p_months, price_xaf = v_price, payment_method = p_method, created_at = now()
  where user_id = v_uid and status = 'pending'
  returning id into v_id;
  if v_id is null then
    insert into public.premium_requests (user_id, months, price_xaf, payment_method)
    values (v_uid, p_months, v_price, p_method)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.cancel_premium_request()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.premium_requests
  set status = 'cancelled', handled_at = now()
  where user_id = auth.uid() and status = 'pending';
$$;

-- ─── Acciones del admin ──────────────────────────────────────────────────────

create or replace function public.admin_assert()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  return auth.uid();
end;
$$;

-- Registra el cobro y activa o amplía Premium (MODELO-DATOS §5.7). Con Premium activo, el periodo
-- nuevo empieza al final del actual. Cierra la solicitud pendiente del usuario, si la hay.
create or replace function public.admin_activate_premium(
  p_user_id uuid,
  p_months smallint,
  p_amount_xaf integer,
  p_method public.payment_method,
  p_reference text,
  p_notes text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
  v_reference text := upper(regexp_replace(coalesce(p_reference, ''), '\s', '', 'g'));
  v_start timestamptz;
  v_end timestamptz;
  v_request uuid;
begin
  if p_months not between 1 and 24 or p_amount_xaf < 0 or v_reference !~ '^[A-Z0-9/._-]{1,60}$' then
    raise exception 'premium_invalid' using errcode = 'P0001';
  end if;
  select greatest(now(), coalesce(premium_until, now())) into v_start
  from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.premium_activations where method = p_method and reference = v_reference) then
    raise exception 'premium_reference_used' using errcode = 'P0001';
  end if;
  v_end := v_start + make_interval(months => p_months);

  update public.premium_requests
  set status = 'completed', handled_at = now(), handled_by = v_admin
  where user_id = p_user_id and status = 'pending'
  returning id into v_request;

  insert into public.premium_activations (
    user_id, request_id, months, amount_xaf, method, reference, period_start, period_end, created_by, notes
  ) values (
    p_user_id, v_request, p_months, p_amount_xaf, p_method, v_reference, v_start, v_end, v_admin,
    nullif(btrim(coalesce(p_notes, '')), '')
  );
  update public.profiles set premium_until = v_end where id = p_user_id;

  insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
  values (v_admin, 'activate_premium', 'user', p_user_id,
          p_months || ' meses · ' || p_amount_xaf || ' FCFA · ' || p_method || ' · ' || v_reference);
  return v_end;
end;
$$;

-- Bloquea un anuncio con motivo (lo ve el vendedor) y cierra sus denuncias abiertas.
create or replace function public.admin_block_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  update public.listings set status = 'blocked', moderation_reason = v_reason
  where id = p_listing_id and status in ('active', 'paused', 'sold', 'expired', 'under_review');
  if not found then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  update public.reports
  set status = 'resolved', resolved_by = v_admin, resolved_at = now(), resolution_note = v_reason
  where listing_id = p_listing_id and status = 'open';
  insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
  values (v_admin, 'block_listing', 'listing', p_listing_id, v_reason);
end;
$$;

-- Devuelve a activo un anuncio en revisión o bloqueado y descarta sus denuncias abiertas.
-- Si ya pasó su fecha de caducidad, el cron lo caduca en la siguiente hora.
create or replace function public.admin_restore_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  update public.listings set status = 'active', moderation_reason = null
  where id = p_listing_id and status in ('under_review', 'blocked');
  if not found then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  update public.reports
  set status = 'dismissed', resolved_by = v_admin, resolved_at = now(), resolution_note = v_reason
  where listing_id = p_listing_id and status = 'open';
  insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
  values (v_admin, 'restore_listing', 'listing', p_listing_id, v_reason);
end;
$$;

-- Cierra una denuncia sin tocar el anuncio (resuelta o descartada).
create or replace function public.admin_close_report(
  p_report_id uuid,
  p_status public.report_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
begin
  if p_status = 'open' then
    raise exception 'report_invalid' using errcode = 'P0001';
  end if;
  update public.reports
  set status = p_status, resolved_by = v_admin, resolved_at = now(),
      resolution_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_report_id and status = 'open';
  if not found then
    raise exception 'report_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Suspende a un usuario unos días (no puede publicar, escribir ni denunciar). 0 días = quitarla.
create or replace function public.admin_suspend_user(p_user_id uuid, p_days integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_days not between 0 and 365 or v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_user_id = v_admin or exists (select 1 from public.profile_private where user_id = p_user_id and role = 'admin') then
    raise exception 'target_is_admin' using errcode = 'P0001';
  end if;
  update public.profile_private
  set suspended_until = case when p_days = 0 then null else now() + make_interval(days => p_days) end
  where user_id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
  values (v_admin, case when p_days = 0 then 'unsuspend_user' else 'suspend_user' end, 'user', p_user_id,
          case when p_days = 0 then v_reason else p_days || ' días · ' || v_reason end);
end;
$$;

-- Banea (o quita el baneo). Al banear se bloquean sus anuncios visibles y se cierran las denuncias
-- contra él. El acceso en Supabase Auth lo corta el servidor (auth.admin, ban_duration).
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.admin_assert();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_user_id = v_admin or exists (select 1 from public.profile_private where user_id = p_user_id and role = 'admin') then
    raise exception 'target_is_admin' using errcode = 'P0001';
  end if;
  update public.profiles set status = case when p_banned then 'banned' else 'active' end::public.account_status
  where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if p_banned then
    update public.listings set status = 'blocked', moderation_reason = v_reason
    where user_id = p_user_id and status in ('active', 'paused', 'under_review');
    update public.reports
    set status = 'resolved', resolved_by = v_admin, resolved_at = now(), resolution_note = v_reason
    where (reported_user_id = p_user_id or listing_id in (select id from public.listings where user_id = p_user_id))
      and status = 'open';
  end if;
  insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
  values (v_admin, case when p_banned then 'ban_user' else 'unban_user' end, 'user', p_user_id, v_reason);
end;
$$;

-- ─── Lecturas del admin ──────────────────────────────────────────────────────

-- Usuarios con sus datos privados (email de auth.users incluido): búsqueda o uno por id.
create or replace function public.admin_users(
  p_query text default null,
  p_user_id uuid default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  username text,
  display_name text,
  email text,
  phone text,
  status public.account_status,
  role public.user_role,
  premium_until timestamptz,
  suspended_until timestamptz,
  email_verified_at timestamptz,
  created_at timestamptz,
  active_listings bigint,
  open_reports bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  perform public.admin_assert();
  return query
  select p.id, p.username, p.display_name, u.email::text, pp.phone, p.status, pp.role,
         p.premium_until, pp.suspended_until, pp.email_verified_at, p.created_at,
         (select count(*) from public.listings l where l.user_id = p.id and l.status = 'active'),
         (select count(*) from public.reports r
          where r.status = 'open' and (r.reported_user_id = p.id))
  from public.profiles p
  join public.profile_private pp on pp.user_id = p.id
  join auth.users u on u.id = p.id
  where (p_user_id is null or p.id = p_user_id)
    and (
      v_query is null
      or p.username ilike '%' || v_query || '%'
      or p.display_name ilike '%' || v_query || '%'
      or u.email ilike '%' || v_query || '%'
      or (char_length(v_digits) >= 4 and pp.phone like '%' || v_digits || '%')
    )
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

-- Métricas básicas (ALCANCE §4.11) y contadores de las colas del panel.
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'pending_requests', (select count(*) from public.premium_requests where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'under_review', (select count(*) from public.listings where status = 'under_review'),
    'premium_active', (select count(*) from public.profiles where premium_until > now()),
    'users_total', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'listings_active', (select count(*) from public.listings where status = 'active'),
    'listings_7d', (select count(*) from public.listings where first_published_at > now() - interval '7 days'),
    'listings_30d', (select count(*) from public.listings where first_published_at > now() - interval '30 days'),
    'conversations_7d', (select count(*) from public.conversations
                         where last_message_at is not null and created_at > now() - interval '7 days'),
    'conversations_30d', (select count(*) from public.conversations
                          where last_message_at is not null and created_at > now() - interval '30 days')
  );
end;
$$;

-- ─── Permisos de las funciones ──────────────────────────────────────────────

revoke all on function public.request_premium(smallint, public.payment_method) from public, anon;
revoke all on function public.cancel_premium_request() from public, anon;
grant execute on function public.request_premium(smallint, public.payment_method) to authenticated;
grant execute on function public.cancel_premium_request() to authenticated;

revoke all on function public.admin_assert() from public, anon, authenticated;
revoke all on function public.admin_activate_premium(uuid, smallint, integer, public.payment_method, text, text) from public, anon;
revoke all on function public.admin_block_listing(uuid, text) from public, anon;
revoke all on function public.admin_restore_listing(uuid, text) from public, anon;
revoke all on function public.admin_close_report(uuid, public.report_status, text) from public, anon;
revoke all on function public.admin_suspend_user(uuid, integer, text) from public, anon;
revoke all on function public.admin_set_banned(uuid, boolean, text) from public, anon;
revoke all on function public.admin_users(text, uuid, integer) from public, anon;
revoke all on function public.admin_metrics() from public, anon;
grant execute on function public.admin_activate_premium(uuid, smallint, integer, public.payment_method, text, text) to authenticated;
grant execute on function public.admin_block_listing(uuid, text) to authenticated;
grant execute on function public.admin_restore_listing(uuid, text) to authenticated;
grant execute on function public.admin_close_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.admin_suspend_user(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, text) to authenticated;
grant execute on function public.admin_users(text, uuid, integer) to authenticated;
grant execute on function public.admin_metrics() to authenticated;
