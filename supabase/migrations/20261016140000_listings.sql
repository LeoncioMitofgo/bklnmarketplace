-- Anuncios: tablas, fotos, estados por RPC, límites del plan y tareas programadas.
-- Ver docs/MODELO-DATOS.md §3.3, §5.3, §5.4, §6, §7, §9 y §10; ALCANCE §4.4 y §5.1–5.5.
-- Los errores de negocio se lanzan con errcode P0001 y un mensaje-clave (listing_*) que la app traduce.

create type public.listing_status as enum (
  'draft', 'active', 'paused', 'sold', 'expired', 'under_review', 'blocked', 'deleted'
);
create type public.item_condition as enum ('new', 'used');

-- ─── Auxiliares ──────────────────────────────────────────────────────────────

-- Código público de 8 caracteres para la URL, sin caracteres que se confundan (0/o, 1/l/i).
create or replace function public.generate_listing_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Primer término prohibido (app_settings.banned_terms) que aparece en el texto, o null.
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
  where public.f_unaccent(lower(coalesce(p_text, ''))) like '%' || public.f_unaccent(lower(term)) || '%'
  limit 1
$$;

-- ─── Anuncios ────────────────────────────────────────────────────────────────

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_listing_code(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category_id integer references public.categories (id) on delete restrict,
  root_category_id integer references public.categories (id) on delete restrict,
  city_id smallint references public.cities (id) on delete restrict,
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 80),
  -- Nulos permitidos mientras es borrador; publish_listing exige que estén completos.
  title text check (title is null or char_length(btrim(title)) between 5 and 80),
  description text check (description is null or char_length(description) <= 4000),
  price_xaf bigint check (price_xaf is null or price_xaf >= 0),
  is_negotiable boolean not null default false,
  condition public.item_condition,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  status public.listing_status not null default 'draft',
  moderation_reason text,
  view_count integer not null default 0,
  first_published_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('spanish'::regconfig, public.f_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, public.f_unaccent(coalesce(description, ''))), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_root_published_idx on public.listings (status, root_category_id, published_at desc);
create index listings_status_category_published_idx on public.listings (status, category_id, published_at desc);
create index listings_status_city_idx on public.listings (status, city_id);
create index listings_user_status_idx on public.listings (user_id, status);
create index listings_active_expires_idx on public.listings (expires_at) where status = 'active';
create index listings_search_idx on public.listings using gin (search_vector);
create index listings_title_trgm_idx on public.listings
  using gin (public.f_unaccent(lower(coalesce(title, ''))) extensions.gin_trgm_ops);
create index listings_attributes_idx on public.listings using gin (attributes jsonb_path_ops);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

-- La categoría debe ser una subcategoría; root_category_id se deriva de ella.
create or replace function public.listings_set_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is null then
    new.root_category_id := null;
    return new;
  end if;
  if exists (select 1 from public.categories c where c.parent_id = new.category_id) then
    raise exception 'listing_category_not_leaf' using errcode = 'P0001';
  end if;
  select coalesce(c.parent_id, c.id) into new.root_category_id
  from public.categories c where c.id = new.category_id;
  return new;
end;
$$;

create trigger listings_set_category
before insert or update of category_id on public.listings
for each row execute function public.listings_set_category();

-- Al editar un anuncio ya publicado se vuelven a comprobar los términos prohibidos.
create or replace function public.listings_check_banned_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active'
     and public.find_banned_term(coalesce(new.title, '') || ' ' || coalesce(new.description, '')) is not null then
    raise exception 'listing_banned_term' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger listings_check_banned_terms
before update of title, description on public.listings
for each row execute function public.listings_check_banned_terms();

-- ─── Fotos ───────────────────────────────────────────────────────────────────

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Base {user_id}/{listing_id}/{id}; ficheros {base}-l.{format} (grande) y {base}-t.{format} (miniatura).
  storage_path text not null,
  format text not null default 'webp' check (format in ('webp', 'jpg')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint listing_images_position_unique unique (listing_id, position) deferrable initially immediate
);

-- Al añadir una foto: va al final, la ruta debe ser la del dueño y no se pasa del límite del plan.
create or replace function public.listing_images_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_count integer;
begin
  select user_id into v_owner from public.listings where id = new.listing_id;
  if new.storage_path <> v_owner::text || '/' || new.listing_id::text || '/' || new.id::text then
    raise exception 'listing_image_bad_path' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.listing_images where listing_id = new.listing_id;
  if v_count >= (public.current_plan(v_owner)).max_photos then
    raise exception 'listing_photo_limit' using errcode = 'P0001';
  end if;

  select coalesce(max(position) + 1, 0) into new.position
  from public.listing_images where listing_id = new.listing_id;
  return new;
end;
$$;

create trigger listing_images_before_insert
before insert on public.listing_images
for each row execute function public.listing_images_before_insert();

-- Un anuncio publicado no puede quedarse sin fotos.
create or replace function public.listing_images_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
       select 1 from public.listings l
       where l.id = old.listing_id and l.status in ('active', 'paused', 'sold', 'expired')
     )
     and (select count(*) from public.listing_images where listing_id = old.listing_id) <= 1 then
    raise exception 'listing_photo_required' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger listing_images_before_delete
before delete on public.listing_images
for each row execute function public.listing_images_before_delete();

-- ─── RLS y permisos ──────────────────────────────────────────────────────────

alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

create policy listings_select_public on public.listings
  for select to anon, authenticated
  using (status = 'active' or (status = 'sold' and sold_at > now() - interval '30 days'));

create policy listings_select_own on public.listings
  for select to authenticated
  using (user_id = (select auth.uid()) and status <> 'deleted');

create policy listings_select_admin on public.listings
  for select to authenticated
  using ((select public.is_admin()));

create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'draft');

-- El dueño edita el contenido (columnas limitadas por GRANT); el estado solo cambia por RPC.
create policy listings_update_own on public.listings
  for update to authenticated
  using (user_id = (select auth.uid()) and status in ('draft', 'active', 'paused', 'sold', 'expired'))
  with check (user_id = (select auth.uid()));

create policy listing_images_select on public.listing_images
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_images.listing_id));

create policy listing_images_insert_own on public.listing_images
  for insert to authenticated
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and l.user_id = (select auth.uid())
      and l.status in ('draft', 'active', 'paused', 'sold', 'expired')
  ));

create policy listing_images_delete_own on public.listing_images
  for delete to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.user_id = (select auth.uid())
  ));

revoke insert, update, delete on public.listings, public.listing_images from anon, authenticated;
grant select on public.listings, public.listing_images to anon, authenticated;
grant insert (category_id, city_id, neighborhood, title, description, price_xaf, is_negotiable, condition, attributes)
  on public.listings to authenticated;
grant update (category_id, city_id, neighborhood, title, description, price_xaf, is_negotiable, condition, attributes)
  on public.listings to authenticated;
grant insert (id, listing_id, storage_path, format, width, height) on public.listing_images to authenticated;
grant delete on public.listing_images to authenticated;

-- ─── Storage: fotos de anuncios ─────────────────────────────────────────────
-- Público para leer (CDN). Se sube con URLs firmadas que crea el servidor y borra el servidor:
-- no hacen falta políticas de escritura para los usuarios.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- ─── Cambios de estado (ALCANCE §5.1, MODELO-DATOS §5.3) ────────────────────

-- Comprobaciones comunes antes de que un anuncio pase a activo.
create or replace function public.listing_assert_can_activate(p_user_id uuid, p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active integer;
begin
  if exists (select 1 from public.profiles where id = p_user_id and status <> 'active')
     or exists (select 1 from public.profile_private where user_id = p_user_id and suspended_until > now()) then
    raise exception 'account_restricted' using errcode = 'P0001';
  end if;

  select count(*) into v_active
  from public.listings
  where user_id = p_user_id and status = 'active' and id <> p_listing_id;
  if v_active >= (public.current_plan(p_user_id)).max_active_listings then
    raise exception 'listing_limit_reached' using errcode = 'P0001';
  end if;
end;
$$;

-- Bloquea la fila del anuncio del usuario actual o lanza listing_not_found.
create or replace function public.listing_for_owner(p_listing_id uuid)
returns public.listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings;
begin
  select * into v from public.listings
  where id = p_listing_id and user_id = (select auth.uid()) and status <> 'deleted'
  for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.publish_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings := public.listing_for_owner(p_listing_id);
  v_category public.categories;
  v_limits jsonb;
  v_new_account boolean;
  v_today integer;
  v_max_today integer;
begin
  if v.status <> 'draft' then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.profile_private where user_id = v.user_id and email_verified_at is not null
  ) then
    raise exception 'email_not_verified' using errcode = 'P0001';
  end if;

  perform public.listing_assert_can_activate(v.user_id, v.id);

  if v.category_id is null or v.city_id is null or v.title is null
     or coalesce(btrim(v.description), '') = '' then
    raise exception 'listing_incomplete' using errcode = 'P0001';
  end if;
  select * into v_category from public.categories where id = v.category_id;
  if v_category.price_required and v.price_xaf is null then
    raise exception 'listing_price_required' using errcode = 'P0001';
  end if;
  if v_category.has_condition and v.condition is null then
    raise exception 'listing_condition_required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.listing_images where listing_id = v.id) then
    raise exception 'listing_photo_required' using errcode = 'P0001';
  end if;
  if public.find_banned_term(v.title || ' ' || v.description) is not null then
    raise exception 'listing_banned_term' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.listings o
    where o.user_id = v.user_id and o.id <> v.id and o.status = 'active'
      and o.category_id = v.category_id
      and extensions.similarity(lower(o.title), lower(v.title)) > 0.8
  ) then
    raise exception 'listing_duplicate' using errcode = 'P0001';
  end if;

  -- Ritmo de publicación (más estricto para cuentas nuevas).
  select value into v_limits from public.app_settings where key = 'rate_limits';
  select p.created_at > now() - make_interval(days => (v_limits ->> 'new_account_days')::int)
    into v_new_account
  from public.profiles p where p.id = v.user_id;
  select count(*) into v_today
  from public.listings
  where user_id = v.user_id and first_published_at > now() - interval '1 day';
  -- (En PL/pgSQL un CASE dentro de "IF … THEN" corta la condición en su primer THEN: va aparte.)
  v_max_today := case when v_new_account then (v_limits ->> 'listings_per_day_new_account')::int
                      else (v_limits ->> 'listings_per_day')::int end;
  if v_today >= v_max_today then
    raise exception 'listing_daily_limit' using errcode = 'P0001';
  end if;

  update public.listings
  set status = 'active',
      published_at = now(),
      first_published_at = coalesce(first_published_at, now()),
      expires_at = now() + make_interval(days => (public.current_plan(v.user_id)).listing_duration_days),
      moderation_reason = null
  where id = v.id;
end;
$$;

create or replace function public.pause_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings := public.listing_for_owner(p_listing_id);
begin
  if v.status <> 'active' then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  update public.listings set status = 'paused' where id = v.id;
end;
$$;

-- Pausado o vendido → activo. Si ya pasó su fecha de caducidad, cuenta como renovación.
create or replace function public.reactivate_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings := public.listing_for_owner(p_listing_id);
  v_renew boolean;
begin
  if v.status not in ('paused', 'sold') then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  perform public.listing_assert_can_activate(v.user_id, v.id);
  if public.find_banned_term(coalesce(v.title, '') || ' ' || coalesce(v.description, '')) is not null then
    raise exception 'listing_banned_term' using errcode = 'P0001';
  end if;

  v_renew := v.expires_at is null or v.expires_at <= now();
  update public.listings
  set status = 'active',
      sold_at = null,
      published_at = case when v_renew then now() else published_at end,
      expires_at = case when v_renew
        then now() + make_interval(days => (public.current_plan(v.user_id)).listing_duration_days)
        else expires_at end
  where id = v.id;
end;
$$;

create or replace function public.mark_listing_sold(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings := public.listing_for_owner(p_listing_id);
begin
  if v.status not in ('active', 'paused') then
    raise exception 'listing_invalid_transition' using errcode = 'P0001';
  end if;
  update public.listings set status = 'sold', sold_at = now() where id = v.id;
end;
$$;

-- Caducado, o activo en sus últimos renew_window_days → activo con la duración completa del plan.
create or replace function public.renew_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.listings := public.listing_for_owner(p_listing_id);
  v_window integer := coalesce(
    (select (value #>> '{}')::int from public.app_settings where key = 'renew_window_days'), 3
  );
begin
  if v.status = 'expired' then
    perform public.listing_assert_can_activate(v.user_id, v.id);
  elsif not (v.status = 'active' and v.expires_at <= now() + make_interval(days => v_window)) then
    raise exception 'listing_renew_not_allowed' using errcode = 'P0001';
  end if;

  update public.listings
  set status = 'active',
      published_at = now(),
      expires_at = now() + make_interval(days => (public.current_plan(v.user_id)).listing_duration_days)
  where id = v.id;
end;
$$;

-- Borrado lógico. Las fotos de Storage las limpia una tarea programada.
create or replace function public.delete_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings
  set status = 'deleted', deleted_at = now()
  where id = p_listing_id
    and status <> 'deleted'
    and (user_id = (select auth.uid()) or (select public.is_admin()));
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- La portada es la foto con menor posición: intercambia posiciones con la actual.
create or replace function public.set_listing_cover(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_position smallint;
  v_cover_id uuid;
  v_cover_position smallint;
begin
  select li.listing_id, li.position into v_listing_id, v_position
  from public.listing_images li
  join public.listings l on l.id = li.listing_id
  where li.id = p_image_id and l.user_id = (select auth.uid()) and l.status <> 'deleted';
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0001';
  end if;

  select id, position into v_cover_id, v_cover_position
  from public.listing_images where listing_id = v_listing_id
  order by position limit 1;
  if v_cover_id = p_image_id then
    return;
  end if;

  update public.listing_images
  set position = case when id = p_image_id then v_cover_position else v_position end
  where id in (p_image_id, v_cover_id);
end;
$$;

-- ─── Tareas programadas (MODELO-DATOS §10) ─────────────────────────────────

-- Premium: alarga los anuncios activos que caducan en menos de 24 h.
create or replace function public.renew_premium_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.listings l
  set expires_at = greatest(l.expires_at, now()) + make_interval(days => pl.listing_duration_days)
  from public.profiles p, public.plans pl
  where p.id = l.user_id
    and p.premium_until > now()
    and pl.id = 'premium' and pl.auto_renew
    and l.status = 'active'
    and l.expires_at < now() + interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.listings set status = 'expired'
  where status = 'active' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Si un usuario tiene más anuncios activos que su plan (p. ej. al caducar Premium), pausa los más antiguos.
create or replace function public.enforce_plan_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with ranked as (
    select l.id,
           row_number() over (partition by l.user_id order by l.published_at desc nulls last, l.id) as rn,
           pl.max_active_listings
    from public.listings l
    join public.profiles p on p.id = l.user_id
    join public.plans pl on pl.id = case when p.premium_until > now() then 'premium' else 'normal' end
    where l.status = 'active'
  )
  update public.listings set status = 'paused'
  where id in (select id from ranked where rn > max_active_listings);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'listings-expiry-hourly',
  '5 * * * *',
  $$select public.renew_premium_listings(); select public.expire_listings();$$
);
select cron.schedule('listings-plan-limits-daily', '15 3 * * *', $$select public.enforce_plan_limits();$$);

-- ─── Permisos de funciones ───────────────────────────────────────────────────

revoke all on function
  public.find_banned_term(text),
  public.listing_assert_can_activate(uuid, uuid),
  public.listing_for_owner(uuid),
  public.renew_premium_listings(),
  public.expire_listings(),
  public.enforce_plan_limits(),
  public.listing_images_before_insert(),
  public.listing_images_before_delete()
from public, anon, authenticated;

revoke all on function
  public.publish_listing(uuid),
  public.pause_listing(uuid),
  public.reactivate_listing(uuid),
  public.mark_listing_sold(uuid),
  public.renew_listing(uuid),
  public.delete_listing(uuid),
  public.set_listing_cover(uuid)
from public, anon;

grant execute on function
  public.publish_listing(uuid),
  public.pause_listing(uuid),
  public.reactivate_listing(uuid),
  public.mark_listing_sold(uuid),
  public.renew_listing(uuid),
  public.delete_listing(uuid),
  public.set_listing_cover(uuid)
to authenticated;
