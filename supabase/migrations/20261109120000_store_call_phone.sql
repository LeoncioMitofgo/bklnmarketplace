-- Teléfono para llamadas de las tiendas Premium, llamadas contadas y cuentas de demostración (D-081).
-- Especificación: ALCANCE §4.8 y §5.4, MODELO-DATOS §3.1 y §7.

-- ─── Teléfono para llamadas ──────────────────────────────────────────────────
-- Lo pone el dueño de la tienda para que se vea: en la tienda y en sus anuncios, también sin sesión y
-- en los buscadores. No es el teléfono de la cuenta (profile_private.phone), que sigue siendo privado;
-- puede ser el mismo número. La tienda ya es pública (RLS de stores: dueño Premium y no baneado).
alter table public.stores
  add column call_phone text check (call_phone is null or call_phone ~ '^\+240[0-9]{9}$');

-- ─── Llamadas ────────────────────────────────────────────────────────────────
-- Cada pulsación de «Llamar» cuenta como un contacto en las métricas de validación (ALCANCE §9).
-- Sin políticas: se escribe solo con register_call y la lee el panel con la clave de servicio.
create table public.call_clicks (
  id bigint generated always as identity primary key,
  store_user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  created_at timestamptz not null default now()
);

create index call_clicks_created_at_idx on public.call_clicks (created_at);

alter table public.call_clicks enable row level security;

-- Apunta una llamada a la tienda (y al anuncio, si se llamó desde su ficha). No cuenta las del propio
-- dueño ni las de tiendas que no se ven o no tienen teléfono para llamadas.
create or replace function public.register_call(p_store_user_id uuid, p_listing_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.call_clicks (store_user_id, listing_id)
  select
    s.user_id,
    (
      select l.id from public.listings l
      where l.id = p_listing_id and l.user_id = s.user_id and l.status = 'active'
    )
  from public.stores s
  where s.user_id = p_store_user_id
    and s.call_phone is not null
    and public.store_is_visible(s.user_id)
    and s.user_id is distinct from (select auth.uid());
$$;

revoke all on function public.register_call(uuid, uuid) from public;
grant execute on function public.register_call(uuid, uuid) to anon, authenticated;

-- ─── Cuentas de demostración ─────────────────────────────────────────────────
-- Hasta el lanzamiento (D-066) conviven con las tiendas fundadoras. Las tiendas reales y sus anuncios
-- ya se dejan indexar (D-081); las de demostración no. Se marcaban solo en user_metadata (D-047), que
-- no se puede leer desde las páginas públicas. No está en los grants de update de profiles: el
-- usuario no la cambia.
alter table public.profiles add column is_demo boolean not null default false;

update public.profiles p
set is_demo = true
from auth.users u
where u.id = p.id and u.raw_user_meta_data ->> 'demo' = 'true';
