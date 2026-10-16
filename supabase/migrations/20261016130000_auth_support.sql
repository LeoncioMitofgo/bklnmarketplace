-- Soporte de autenticación: verificación de email propia (D-020) y límite de intentos.
-- Las dos tablas tienen RLS sin políticas: solo el servidor (service_role) las toca.
-- Ver docs/MODELO-DATOS.md §3.7 y §5.1; ALCANCE §5.7.

-- ─── Límite de intentos ──────────────────────────────────────────────────────

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Ventana fija: cuenta un intento y devuelve true si sigue dentro del límite.
-- Las claves llegan ya hasheadas desde el servidor (no se guardan teléfonos ni emails en claro).
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- ─── Verificación de email ───────────────────────────────────────────────────

create table public.email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_verification_tokens_user_id_idx on public.email_verification_tokens (user_id);

alter table public.email_verification_tokens enable row level security;

-- Marca el email como verificado si el token existe, no se ha usado, no ha caducado
-- y el email sigue siendo el actual de la cuenta. Devuelve el user_id o null.
create or replace function public.consume_email_verification_token(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  update public.email_verification_tokens
  set used_at = now()
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  returning user_id, email into v_user_id, v_email;

  if v_user_id is null then
    return null;
  end if;

  if not exists (
    select 1 from auth.users u where u.id = v_user_id and lower(u.email) = lower(v_email)
  ) then
    return null;
  end if;

  update public.profile_private
  set email_verified_at = now()
  where user_id = v_user_id;

  return v_user_id;
end;
$$;

-- ─── Permisos ────────────────────────────────────────────────────────────────

revoke all on public.rate_limits from anon, authenticated;
revoke all on public.email_verification_tokens from anon, authenticated;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

revoke all on function public.consume_email_verification_token(text) from public, anon, authenticated;
grant execute on function public.consume_email_verification_token(text) to service_role;
