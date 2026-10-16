-- Usuarios: perfil público, datos privados y tienda Premium; registro, login por identificador y plan efectivo.
-- Ver docs/MODELO-DATOS.md §3.1, §5.1, §5.2 y §6; ALCANCE §5.7; D-012, D-020.

-- ─── Tablas ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9._]{2,19}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 50),
  avatar_path text,
  city_id smallint references public.cities (id) on delete set null,
  bio text check (bio is null or char_length(bio) <= 300),
  premium_until timestamptz,
  response_time_minutes integer check (response_time_minutes is null or response_time_minutes >= 0),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Datos que nunca son públicos. RLS filtra filas, no columnas: por eso van aparte.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null unique check (phone ~ '^\+240[0-9]{9}$'),
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  show_whatsapp boolean not null default false,
  role public.user_role not null default 'user',
  suspended_until timestamptz,
  notify_push boolean not null default true,
  notify_email boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Tienda Premium (1:1). Los datos se conservan si caduca Premium; solo se dejan de mostrar.
create table public.stores (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{2,39}$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (description is null or char_length(description) <= 1000),
  logo_path text,
  cover_path text,
  address text check (address is null or char_length(address) <= 200),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_private_set_updated_at
before update on public.profile_private
for each row execute function public.set_updated_at();

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

-- ─── Funciones auxiliares ────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_private
    where user_id = (select auth.uid()) and role = 'admin'
  )
$$;

create or replace function public.is_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select premium_until > now() from public.profiles where id = p_user_id),
    false
  )
$$;

-- Plan efectivo: Premium si premium_until > now(), si no Normal (D-027).
create or replace function public.current_plan(p_user_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.plans p
  where p.id = case when public.is_premium(p_user_id) then 'premium' else 'normal' end
$$;

create or replace function public.is_reserved_username(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.value ? lower(p_username) from public.app_settings s where s.key = 'reserved_usernames'),
    false
  )
$$;

-- Usernames siempre en minúsculas y nunca reservados (al registrarse y al cambiarlo).
create or replace function public.profiles_check_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.username = lower(btrim(new.username));
  if public.is_reserved_username(new.username) then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_check_username
before insert or update of username on public.profiles
for each row execute function public.profiles_check_username();

-- ─── Registro y cambios en auth.users ───────────────────────────────────────

-- Crea perfil + datos privados a partir de los metadatos del registro.
-- El servidor valida antes (mensajes claros); esto es la red de seguridad: si falla, falla el registro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
  v_display_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  v_phone text := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
begin
  if v_username is null or v_display_name is null or v_phone is null then
    raise exception 'signup_metadata_missing' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display_name);

  insert into public.profile_private (user_id, phone)
  values (new.id, v_phone);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Si cambia el email, hay que volver a verificarlo (D-020).
create or replace function public.handle_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profile_private
    set email_verified_at = null
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_auth_email_change();

-- Login por usuario, email o teléfono (D-012): devuelve el email para signInWithPassword.
-- SOLO el servidor (service_role) puede llamarla: el email nunca llega al navegador.
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_identifier, ''));
  v_email text;
begin
  if v = '' then
    return null;
  end if;

  if position('@' in v) > 0 then
    return lower(v);
  end if;

  if v ~ '^[0-9 +]+$' then
    v := regexp_replace(v, '[^0-9]', '', 'g');
    if v like '00240%' then
      v := substr(v, 6);
    elsif length(v) = 12 and v like '240%' then
      v := substr(v, 4);
    end if;
    if v !~ '^[0-9]{9}$' then
      return null;
    end if;
    select u.email into v_email
    from public.profile_private pp
    join auth.users u on u.id = pp.user_id
    where pp.phone = '+240' || v;
    return v_email;
  end if;

  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(v);
  return v_email;
end;
$$;

-- ─── Permisos de funciones ───────────────────────────────────────────────────

revoke all on function public.resolve_login_email(text) from public, anon, authenticated;
grant execute on function public.resolve_login_email(text) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_auth_email_change() from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_premium(uuid) to anon, authenticated;
grant execute on function public.current_plan(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.stores enable row level security;

-- profiles: público salvo baneados; cada uno edita lo suyo (columnas limitadas por GRANT).
create policy profiles_select on public.profiles
  for select to anon, authenticated
  using (status <> 'banned' or id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- profile_private: solo el dueño y el admin.
create policy profile_private_select on public.profile_private
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy profile_private_update_own on public.profile_private
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- stores: visible si el dueño es Premium y no está baneado; solo un Premium crea o edita la suya.
create policy stores_select on public.stores
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.profiles p
      where p.id = stores.user_id and p.premium_until > now() and p.status <> 'banned'
    )
  );

create policy stores_insert_premium on public.stores
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_premium((select auth.uid())));

create policy stores_update_premium on public.stores
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_premium((select auth.uid())))
  with check (user_id = (select auth.uid()));

create policy stores_delete_own on public.stores
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Permisos por columna: el usuario no puede tocar premium_until, status, role, email_verified_at…
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.profile_private from anon, authenticated;
revoke insert, update, delete on public.stores from anon;

grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_path, city_id, bio) on public.profiles to authenticated;

grant select on public.profile_private to authenticated;
grant update (show_whatsapp, notify_push, notify_email) on public.profile_private to authenticated;

grant select on public.stores to anon, authenticated;
grant insert, update, delete on public.stores to authenticated;

-- ─── Escritura de las tablas de referencia: solo admin ─────────────────────

create policy cities_admin_write on public.cities
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin_write on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy category_attributes_admin_write on public.category_attributes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plans_admin_write on public.plans
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plan_prices_admin_write on public.plan_prices
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy app_settings_admin_all on public.app_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant insert, update, delete on
  public.cities, public.categories, public.category_attributes,
  public.plans, public.plan_prices, public.app_settings
to authenticated;
