-- Fase 1.6 (segunda parte) · Tienda Premium /t/<slug>: rutas del logo y la portada, y botón de
-- WhatsApp de la tienda. La tabla stores y su RLS ya existen (1.1): solo se ve si el dueño es
-- Premium y no está baneado, y sus datos se conservan si caduca (ALCANCE §5.3).
-- Especificación: ALCANCE §4.8, MODELO-DATOS §3.1 y §7. Decisión D-059.

-- logo_path y cover_path apuntan a fotos del propio dueño en profile-media, cada vez con un nombre
-- nuevo para que la CDN no sirva la anterior: {user_id}/logo-{uuid}.{webp|jpg} y cover-…
create or replace function public.stores_check_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.logo_path is not null
     and new.logo_path !~ ('^' || new.user_id::text || '/logo-[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'store_media_invalid' using errcode = 'P0001';
  end if;
  if new.cover_path is not null
     and new.cover_path !~ ('^' || new.user_id::text || '/cover-[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'store_media_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger stores_check_media
before insert or update of logo_path, cover_path on public.stores
for each row execute function public.stores_check_media();

-- Tienda visible: dueño Premium y no baneado (lo mismo que la RLS de stores).
create or replace function public.store_is_visible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    join public.profiles p on p.id = s.user_id
    where s.user_id = p_user_id and p.premium_until > now() and p.status <> 'banned'
  );
$$;

-- ¿Enseñar el botón de WhatsApp en la tienda? Con sesión, si el dueño lo activó y no es uno mismo.
create or replace function public.store_whatsapp_enabled(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and p_user_id <> (select auth.uid())
    and public.store_is_visible(p_user_id)
    and exists (select 1 from public.profile_private where user_id = p_user_id and show_whatsapp);
$$;

-- El teléfono del dueño de la tienda, solo al pulsar el botón: mismas reglas y mismo tope diario
-- que el WhatsApp de la ficha (D-050).
create or replace function public.store_whatsapp_contact(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
begin
  perform public.chat_assert_can_write(v_uid);
  if not public.store_whatsapp_enabled(p_user_id) then
    raise exception 'whatsapp_unavailable' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(v_uid, p_user_id) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;
  perform public.chat_rate_limit(v_uid, 'whatsapp', 'whatsapp_reveals_per_day', 86400);
  select phone into v_phone from public.profile_private where user_id = p_user_id;
  return v_phone;
end;
$$;

revoke all on function public.stores_check_media() from public, anon, authenticated;
revoke all on function public.store_is_visible(uuid) from public, anon, authenticated;
revoke all on function public.store_whatsapp_enabled(uuid) from public, anon;
revoke all on function public.store_whatsapp_contact(uuid) from public, anon;
grant execute on function public.store_whatsapp_enabled(uuid) to authenticated;
grant execute on function public.store_whatsapp_contact(uuid) to authenticated;
