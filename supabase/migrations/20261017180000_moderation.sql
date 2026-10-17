-- Fase 1.5 · Confianza y moderación: denuncias con auto‑ocultado, registro de moderación,
-- términos prohibidos por palabras completas y apoyo al borrado de cuenta.
-- Especificación: MODELO-DATOS §3.5, §5.3, §5.6, §6 y §11. Decisiones D-053, D-055 y D-056.

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.report_reason as enum (
  'scam', 'prohibited', 'duplicate', 'wrong_category', 'offensive', 'other'
);
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ─── Tablas ──────────────────────────────────────────────────────────────────

-- Denuncia de un anuncio (lleva también al vendedor) o de un usuario desde el chat.
-- Todo es `set null`: la denuncia sobrevive aunque se borre la cuenta o el anuncio (§11).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);

-- Un usuario denuncia cada anuncio una sola vez, y a cada usuario una vez mientras esté abierta.
create unique index reports_listing_reporter_unique on public.reports (listing_id, reporter_id)
  where listing_id is not null;
create unique index reports_user_reporter_open_unique on public.reports (reported_user_id, reporter_id)
  where listing_id is null and status = 'open';
create index reports_open_listing_idx on public.reports (listing_id) where status = 'open';
create index reports_status_created_idx on public.reports (status, created_at desc);

-- Historial de moderación. Sin claves foráneas, para que sobreviva a los borrados.
-- admin_id null = acción automática del sistema (p. ej. auto‑ocultado por denuncias).
create table public.moderation_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create index moderation_log_target_idx on public.moderation_log (target_type, target_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Las denuncias se crean por RPC (report_listing, report_conversation); el admin las resuelve.

alter table public.reports enable row level security;
alter table public.moderation_log enable row level security;

create policy reports_select_own_or_admin on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy reports_update_admin on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy moderation_log_select_admin on public.moderation_log
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.reports, public.moderation_log from anon, authenticated;
grant select on public.reports, public.moderation_log to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.reports to authenticated;

-- ─── Ajustes ─────────────────────────────────────────────────────────────────

update public.app_settings
set value = value || '{"reports_per_day": 20}'::jsonb
where key = 'rate_limits';

-- Lista inicial ampliada (ALCANCE §5.5). Editable; se compara por palabras completas (abajo).
update public.app_settings
set value = '[
  "cocaína", "marihuana", "cannabis", "hachís", "heroína",
  "tramadol", "rivotril", "diazepam", "valium", "codeína",
  "arma de fuego", "armas de fuego", "escopeta", "revólver", "kalashnikov", "ak-47", "munición",
  "billete falso", "billetes falsos", "dinero falso",
  "dni falso", "pasaporte falso", "documento falso", "documentos falsos", "carnet falso",
  "marfil", "pangolín", "chimpancé", "gorila", "piel de leopardo", "tortuga marina", "huevos de tortuga",
  "escort", "prostitución", "servicios sexuales", "masaje erótico", "masajes eróticos"
]'::jsonb
where key = 'banned_terms';

-- ─── Términos prohibidos por palabras completas ─────────────────────────────
-- Antes se buscaba el término dentro del texto, así que "arma" habría saltado con "armario".
-- Ahora el término tiene que aparecer como palabra (o palabras) completa, admitiendo el plural
-- en -s/-es al final: "escopeta" salta con "escopetas" pero no con "escopetazo".
create or replace function public.find_banned_term(p_text text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select term
  from jsonb_array_elements_text(
    coalesce((select value from public.app_settings where key = 'banned_terms'), '[]'::jsonb)
  ) as term
  where public.f_unaccent(lower(coalesce(p_text, ''))) ~ (
    '\m'
    || regexp_replace(
         regexp_replace(public.f_unaccent(lower(btrim(term))), '([^[:alnum:][:space:]])', '\\\1', 'g'),
         '\s+', '\\s+', 'g'
       )
    || '(s|es)?\M'
  )
  limit 1
$$;

-- ─── Auto‑ocultado ───────────────────────────────────────────────────────────
-- Con report_hide_threshold denuncias abiertas de usuarios distintos, el anuncio activo pasa a
-- under_review hasta que lo revise un admin (ALCANCE §5.5, MODELO-DATOS §5.6).
create or replace function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold integer := coalesce(
    (select (value #>> '{}')::int from public.app_settings where key = 'report_hide_threshold'), 3
  );
  v_count integer;
begin
  if new.listing_id is null or new.status <> 'open' then
    return null;
  end if;

  -- Bloquea el anuncio para que dos denuncias simultáneas no se cuenten a la vez.
  perform 1 from public.listings where id = new.listing_id for update;

  select count(distinct reporter_id) into v_count
  from public.reports
  where listing_id = new.listing_id and status = 'open' and reporter_id is not null;

  if v_count >= v_threshold then
    update public.listings set status = 'under_review'
    where id = new.listing_id and status = 'active';
    if found then
      insert into public.moderation_log (admin_id, action, target_type, target_id, reason)
      values (null, 'auto_hide_listing', 'listing', new.listing_id, v_count || ' denuncias abiertas');
    end if;
  end if;
  return null;
end;
$$;

create trigger reports_after_insert
after insert on public.reports
for each row execute function public.reports_after_insert();

-- ─── RPC de denuncia ─────────────────────────────────────────────────────────

-- Límite diario de denuncias por usuario (app_settings.rate_limits.reports_per_day).
create or replace function public.report_rate_limit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := (
    select (value ->> 'reports_per_day')::int from public.app_settings where key = 'rate_limits'
  );
begin
  if v_max is not null
     and not public.check_rate_limit('reports:' || p_user_id::text, v_max, 86400) then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;
end;
$$;

-- Denunciar un anuncio. Devuelve 'created', 'already' (ya lo había denunciado) o 'hidden'
-- (esta denuncia lo ha ocultado: el servidor invalida entonces la caché de las páginas públicas).
create or replace function public.report_listing(
  p_listing_id uuid,
  p_reason public.report_reason,
  p_details text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing record;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  perform public.chat_assert_can_write(v_uid);

  select id, user_id, status into v_listing from public.listings where id = p_listing_id;
  if not found or v_listing.status not in ('active', 'sold', 'under_review') then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;
  if v_listing.user_id = v_uid then
    raise exception 'own_listing' using errcode = 'P0001';
  end if;
  if char_length(v_details) > 1000 or (p_reason = 'other' and v_details is null) then
    raise exception 'report_invalid' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reports where listing_id = p_listing_id and reporter_id = v_uid) then
    return 'already';
  end if;
  perform public.report_rate_limit(v_uid);

  insert into public.reports (reporter_id, listing_id, reported_user_id, reason, details)
  values (v_uid, p_listing_id, v_listing.user_id, p_reason, v_details)
  on conflict do nothing;

  return case
    when (select status from public.listings where id = p_listing_id) = 'under_review'
         and v_listing.status = 'active' then 'hidden'
    else 'created'
  end;
end;
$$;

-- Denunciar a la otra persona de una conversación (ALCANCE §4.5), y bloquearla si se pide.
-- Devuelve 'created' o 'already' (ya había una denuncia abierta suya contra esa persona).
create or replace function public.report_conversation(
  p_conversation_id uuid,
  p_reason public.report_reason,
  p_details text default null,
  p_block boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_result text := 'created';
begin
  perform public.chat_assert_can_write(v_uid);

  select case when buyer_id = v_uid then seller_id else buyer_id end into v_other
  from public.conversations
  where id = p_conversation_id and v_uid in (buyer_id, seller_id);
  if not found then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if v_other is null then
    raise exception 'recipient_deleted' using errcode = 'P0001';
  end if;
  if p_reason not in ('scam', 'offensive', 'prohibited', 'other')
     or char_length(v_details) > 1000
     or (p_reason = 'other' and v_details is null) then
    raise exception 'report_invalid' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.reports
    where reported_user_id = v_other and reporter_id = v_uid and listing_id is null and status = 'open'
  ) then
    v_result := 'already';
  else
    perform public.report_rate_limit(v_uid);
    insert into public.reports (reporter_id, reported_user_id, conversation_id, reason, details)
    values (v_uid, v_other, p_conversation_id, p_reason, v_details)
    on conflict do nothing;
  end if;

  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (v_uid, v_other)
    on conflict do nothing;
  end if;
  return v_result;
end;
$$;

-- ─── Borrado de cuenta (§11) ────────────────────────────────────────────────
-- Ficheros de Storage de un usuario (fotos de sus anuncios y de su perfil), para que el servidor
-- los borre con la API de Storage después de eliminar la cuenta. Solo la ejecuta el servidor.
create or replace function public.account_storage_objects(p_user_id uuid)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('listing-images', 'profile-media')
    and o.name like p_user_id::text || '/%'
$$;

-- ─── Permisos de las funciones ──────────────────────────────────────────────

revoke all on function public.reports_after_insert() from public, anon, authenticated;
revoke all on function public.report_rate_limit(uuid) from public, anon, authenticated;
revoke all on function public.report_listing(uuid, public.report_reason, text) from public, anon;
revoke all on function public.report_conversation(uuid, public.report_reason, text, boolean) from public, anon;
grant execute on function public.report_listing(uuid, public.report_reason, text) to authenticated;
grant execute on function public.report_conversation(uuid, public.report_reason, text, boolean) to authenticated;
revoke all on function public.account_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.account_storage_objects(uuid) to service_role;
