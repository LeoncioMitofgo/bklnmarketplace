-- ¿Hay ya una cuenta con este email? Para cambiar el email desde Mi cuenta: la API de admin de
-- Supabase Auth devuelve un error genérico (500) si el email existe, así que se comprueba antes
-- para dar un mensaje claro. Solo la puede ejecutar el servidor: no debe servir para averiguar emails.
create or replace function public.email_taken(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)))
$$;

revoke all on function public.email_taken(text) from public, anon, authenticated;
grant execute on function public.email_taken(text) to service_role;
