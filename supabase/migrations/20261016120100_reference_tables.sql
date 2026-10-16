-- Tablas de configuración y referencia: ciudades, categorías, atributos, planes, precios y ajustes.
-- Lectura pública; la escritura (solo admin) se añade en la migración de usuarios, que define is_admin().
-- Ver docs/MODELO-DATOS.md §3.2.

create table public.cities (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

create table public.categories (
  id integer generated always as identity primary key,
  parent_id integer references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  icon text,
  price_required boolean not null default true,
  price_period public.price_period not null default 'total',
  has_condition boolean not null default true,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);

-- Solo dos niveles: una subcategoría no puede tener hijos.
create or replace function public.categories_check_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null
     and exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'categories_max_depth' using errcode = 'P0001',
      hint = 'Una subcategoría no puede tener subcategorías.';
  end if;
  return new;
end;
$$;

create trigger categories_check_depth
before insert or update of parent_id on public.categories
for each row execute function public.categories_check_depth();

create table public.category_attributes (
  id integer generated always as identity primary key,
  category_id integer not null references public.categories (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  type public.attribute_type not null,
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  unit text,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  sort_order smallint not null default 0,
  unique (category_id, key),
  check (type <> 'select' or options is not null)
);

create table public.plans (
  id text primary key check (id ~ '^[a-z_]+$'),
  max_active_listings integer not null check (max_active_listings > 0),
  max_photos integer not null check (max_photos between 1 and 30),
  listing_duration_days integer not null check (listing_duration_days between 1 and 365),
  auto_renew boolean not null default false,
  has_store boolean not null default false,
  is_featured boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create table public.plan_prices (
  plan_id text not null references public.plans (id) on delete cascade,
  months smallint not null check (months between 1 and 24),
  price_xaf integer not null check (price_xaf >= 0),
  is_active boolean not null default true,
  primary key (plan_id, months)
);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- RLS: lectura pública (app_settings solo las claves públicas).
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.category_attributes enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.app_settings enable row level security;

create policy cities_select_all on public.cities
  for select to anon, authenticated using (true);
create policy categories_select_all on public.categories
  for select to anon, authenticated using (true);
create policy category_attributes_select_all on public.category_attributes
  for select to anon, authenticated using (true);
create policy plans_select_all on public.plans
  for select to anon, authenticated using (true);
create policy plan_prices_select_all on public.plan_prices
  for select to anon, authenticated using (true);
create policy app_settings_select_public on public.app_settings
  for select to anon, authenticated using (is_public);

grant select on
  public.cities, public.categories, public.category_attributes,
  public.plans, public.plan_prices, public.app_settings
to anon, authenticated;
