-- D-079 · Anuncios por encargo: lo que el vendedor trae cuando se lo piden (de fuera o de un proveedor).
-- Especificación: MODELO-DATOS §3.3 (listings), §4 (enums), §5.8 (RPC) y §9 (listing_cards).
-- Solo añade: una columna con su enum, la vista de tarjetas y tres RPC que devuelven la columna.

-- ─── Columna ─────────────────────────────────────────────────────────────────

create type public.order_lead_time as enum ('under_week', 'weeks_1_2', 'weeks_2_4', 'over_month');

alter table public.listings add column order_lead_time public.order_lead_time;

comment on column public.listings.order_lead_time is
  'Null: el vendedor lo tiene ya. Con valor: por encargo, con el plazo aproximado de entrega (D-079).';

-- Es una columna de contenido: la cambia el dueño como el resto (MODELO-DATOS §6).
grant insert (order_lead_time), update (order_lead_time) on public.listings to authenticated;

-- ─── Tarjetas ────────────────────────────────────────────────────────────────

-- La columna nueva va al final: create or replace view solo deja añadir columnas detrás.
create or replace view public.listing_cards
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
  coalesce(p.premium_until > now(), false) as seller_is_premium,
  l.order_lead_time
from public.listings l
join public.profiles p on p.id = l.user_id
left join lateral (
  select i.storage_path, i.format
  from public.listing_images i
  where i.listing_id = l.id
  order by i.position
  limit 1
) cover on true;

-- ─── Búsqueda ────────────────────────────────────────────────────────────────

-- Cambia lo que devuelve, así que hay que borrarla y crearla de nuevo (igual que en 20261016150000,
-- más order_lead_time).
drop function public.search_listings(
  text, integer, smallint, bigint, bigint, public.item_condition, jsonb, jsonb, text, integer
);

create function public.search_listings(
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
  order_lead_time public.order_lead_time,
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
      l.order_lead_time,
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
    rk.order_lead_time,
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

revoke all on function
  public.search_listings(text, integer, smallint, bigint, bigint, public.item_condition, jsonb, jsonb, text, integer)
from public, anon, authenticated;

grant execute on function
  public.search_listings(text, integer, smallint, bigint, bigint, public.item_condition, jsonb, jsonb, text, integer)
to anon, authenticated;

-- ─── Conversaciones ──────────────────────────────────────────────────────────

-- El chat de un encargo lleva su propio aviso de seguridad: hace falta saber si el anuncio lo es.
-- Igual que en 20261017120000, más listing_order_lead_time.
drop function public.my_conversations(text, uuid, integer);

create function public.my_conversations(
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
  listing_order_lead_time public.order_lead_time,
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
    l.order_lead_time,
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

revoke all on function public.my_conversations(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.my_conversations(text, uuid, integer) to authenticated;
