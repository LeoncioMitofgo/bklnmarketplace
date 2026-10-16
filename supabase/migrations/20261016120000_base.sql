-- Base: extensiones, funciones auxiliares y enums de la Fase 1.1.
-- Ver docs/MODELO-DATOS.md §1, §4 y §9.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent no es IMMUTABLE; este envoltorio sí, y permite usarlo en columnas generadas e índices.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Mantiene updated_at en las tablas que lo tienen.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.account_status as enum ('active', 'suspended', 'banned');
create type public.user_role as enum ('user', 'admin');
create type public.price_period as enum ('total', 'month');
create type public.attribute_type as enum ('text', 'number', 'select', 'boolean');
