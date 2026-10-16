-- Fase 1.3 · Catálogo público: tarjetas, búsqueda, vistas y favoritos.
-- Especificación: MODELO-DATOS §3.3 (favorites), §5.8 (RPC), §6 (RLS) y §9 (listing_cards).

-- ─── Vistas de un anuncio ────────────────────────────────────────────────────

-- Contar una vista no es editar el anuncio: no cambia updated_at.
drop trigger listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row
when (old.view_count is not distinct from new.view_count)
execute function public.set_updated_at();

-- Suma una vista a un anuncio activo. Las del propio vendedor no cuentan.
create or replace function public.register_listing_view(p_listing_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listings
  set view_count = view_count + 1
  where id = p_listing_id
    and status = 'active'
    and user_id is distinct from (select auth.uid());
$$;

-- ─── Tarjetas de anuncio ─────────────────────────────────────────────────────

-- Lo que necesita una tarjeta de los listados: anuncio + portada + insignia Premium del vendedor.
-- security_invoker: se aplica la RLS de quien consulta (un visitante solo ve activos y vendidos recientes).
create view public.listing_cards
with (security_invoker = true)
as
select
  l.id,
  l.code,
  l.user_id,
  l.status,
  l.title,
  l.price_xaf,
  l.is_negotiable,
  l.condition,
  l.category_id,
  l.root_category_id,
  l.city_id,
  l.neighborhood,
  l.published_at,
  l.sold_at,
  cover.storage_path as cover_path,
  cover.format as cover_format,
  coalesce(p.premium_until > now(), false) as seller_is_premium
from public.listings l
join public.profiles p on p.id = l.user_id
left join lateral (
  select i.storage_path, i.format
  from public.listing_images i
  where i.listing_id = l.id
  order by i.position
  limit 1
) cover on true;

revoke all on public.listing_cards from anon, authenticated;
grant select on public.listing_cards to anon, authenticated;

-- ─── Búsqueda ────────────────────────────────────────────────────────────────

-- Búsqueda de anuncios activos con filtros y orden (ARQUITECTURA §5.4).
-- · Texto: palabras con prefijo (español + unaccent) o, para las erratas, similitud de trigramas con el título.
-- · p_category_id: categoría principal o subcategoría.
-- · p_attributes: coincidencia exacta de atributos de lista o sí/no, p. ej. {"brand": "Toyota"}.
-- · p_ranges: rangos de atributos numéricos, p. ej. {"year": [2015, null]}.
-- · Orden: relevance (Premium primero a igualdad de relevancia), recent, price_asc o price_desc.
-- · "Ver más" pide un p_limit mayor (D-041); total_count es el total de resultados.
create or replace function public.search_listings(
  p_query text default null,
  p_category_id integer default null,
  p_city_id smallint default null,
  p_price_min bigint default null,
  p_price_max bigint default null,
  p_condition public.item_condition default null,
  p_attributes jsonb default null,
  p_ranges jsonb default null,
  p_sort text default 'relevance',
  p_limit integer default 20
)
returns table (
  id uuid,
  code text,
  title text,
  price_xaf bigint,
  is_negotiable boolean,
  condition public.item_condition,
  category_id integer,
  city_id smallint,
  neighborhood text,
  published_at timestamptz,
  cover_path text,
  cover_format text,
  seller_is_premium boolean,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_query text := nullif(left(btrim(public.f_unaccent(lower(coalesce(p_query, '')))), 100), '');
  v_tsquery tsquery;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
begin
  if v_query is not null then
    select to_tsquery('spanish', string_agg(words.w || ':*', ' & '))
    into v_tsquery
    from (
      select w
      from regexp_split_to_table(v_query, '[^a-z0-9]+') as w
      where w <> ''
      limit 8
    ) as words;

    -- Solo palabras vacías ("de", "la"…): se busca únicamente por trigramas.
    if v_tsquery is not null and numnode(v_tsquery) = 0 then
      v_tsquery := null;
    end if;
  end if;

  return query
  with matched as (
    select
      l.id,
      l.code,
      l.title,
      l.price_xaf,
      l.is_negotiable,
      l.condition,
      l.category_id,
      l.city_id,
      l.neighborhood,
      l.published_at,
      coalesce(p.premium_until > now(), false) as seller_is_premium,
      case when v_tsquery is null then 0 else ts_rank(l.search_vector, v_tsquery) end as rank
    from public.listings l
    join public.profiles p on p.id = l.user_id
    where l.status = 'active'
      and (p_category_id is null or l.category_id = p_category_id or l.root_category_id = p_category_id)
      and (p_city_id is null or l.city_id = p_city_id)
      and (p_price_min is null or l.price_xaf >= p_price_min)
      and (p_price_max is null or l.price_xaf <= p_price_max)
      and (p_condition is null or l.condition = p_condition)
      and (p_attributes is null or l.attributes @> p_attributes)
      and (p_ranges is null or not exists (
        select 1
        from jsonb_each(p_ranges) as r
        where case
          when jsonb_typeof(l.attributes -> r.key) is distinct from 'number' then true
          else (jsonb_typeof(r.value -> 0) = 'number'
                and (l.attributes ->> r.key)::numeric < (r.value ->> 0)::numeric)
            or (jsonb_typeof(r.value -> 1) = 'number'
                and (l.attributes ->> r.key)::numeric > (r.value ->> 1)::numeric)
        end
      ))
      and (
        v_query is null
        or (v_tsquery is not null and l.search_vector @@ v_tsquery)
        or v_query operator(extensions.<%) public.f_unaccent(lower(coalesce(l.title, '')))
      )
  ),
  ranked as (
    select
      m.*,
      count(*) over () as total_count,
      row_number() over (
        order by
          case when p_sort = 'price_asc' then m.price_xaf end asc nulls last,
          case when p_sort = 'price_desc' then m.price_xaf end desc nulls last,
          case when p_sort = 'relevance' then m.rank end desc,
          case when p_sort = 'relevance' then m.seller_is_premium end desc,
          m.published_at desc,
          m.id
      ) as ord
    from matched m
  )
  select
    rk.id,
    rk.code,
    rk.title,
    rk.price_xaf,
    rk.is_negotiable,
    rk.condition,
    rk.category_id,
    rk.city_id,
    rk.neighborhood,
    rk.published_at,
    cover.storage_path,
    cover.format,
    rk.seller_is_premium,
    rk.total_count
  from ranked rk
  left join lateral (
    select i.storage_path, i.format
    from public.listing_images i
    where i.listing_id = rk.id
    order by i.position
    limit 1
  ) cover on true
  where rk.ord <= v_limit
  order by rk.ord;
end;
$$;

-- ─── Favoritos ───────────────────────────────────────────────────────────────

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Solo se guardan anuncios activos.
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.listings l
      where l.id = favorites.listing_id and l.status = 'active'
    )
  );

create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.favorites from anon, authenticated;
grant select, delete on public.favorites to authenticated;
grant insert (listing_id) on public.favorites to authenticated;

-- Favoritos del usuario con su disponibilidad (ALCANCE §4.7: si se vende o caduca, se indica).
-- Es security definer porque la RLS de listings ya no deja ver los pausados o caducados de otros.
-- De los bloqueados, en revisión o eliminados no se devuelve el contenido.
create or replace function public.my_favorites(p_limit integer default 100)
returns table (
  listing_id uuid,
  code text,
  availability text,
  title text,
  price_xaf bigint,
  is_negotiable boolean,
  category_id integer,
  city_id smallint,
  neighborhood text,
  published_at timestamptz,
  cover_path text,
  cover_format text,
  favorited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.code,
    case l.status
      when 'active' then 'active'
      when 'sold' then 'sold'
      when 'paused' then 'paused'
      when 'expired' then 'expired'
      else 'unavailable'
    end,
    case when v.visible then l.title end,
    case when v.visible then l.price_xaf end,
    l.is_negotiable,
    l.category_id,
    l.city_id,
    case when v.visible then l.neighborhood end,
    l.published_at,
    cover.storage_path,
    cover.format,
    f.created_at
  from public.favorites f
  join public.listings l on l.id = f.listing_id
  cross join lateral (
    select l.status in ('active', 'sold', 'paused', 'expired') as visible
  ) v
  left join lateral (
    select i.storage_path, i.format
    from public.listing_images i
    where i.listing_id = l.id and v.visible
    order by i.position
    limit 1
  ) cover on true
  where f.user_id = (select auth.uid())
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- ─── Permisos de funciones ───────────────────────────────────────────────────

revoke all on function
  public.register_listing_view(uuid),
  public.search_listings(text, integer, smallint, bigint, bigint, public.item_condition, jsonb, jsonb, text, integer),
  public.my_favorites(integer)
from public, anon, authenticated;

grant execute on function
  public.register_listing_view(uuid),
  public.search_listings(text, integer, smallint, bigint, bigint, public.item_condition, jsonb, jsonb, text, integer)
to anon, authenticated;

grant execute on function public.my_favorites(integer) to authenticated;
