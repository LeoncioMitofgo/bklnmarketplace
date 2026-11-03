-- Consultar un límite de intentos sin contar uno más. Para la contraseña actual de Mi cuenta: solo
-- cuentan los fallos (quien cambia el email, el teléfono y la contraseña seguidos no debe quedarse
-- bloqueado), pero el límite se mira antes de comprobar la contraseña. Misma ventana que
-- check_rate_limit. Solo el servidor.
create or replace function public.rate_limit_exceeded(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select count >= p_max
     from public.rate_limits
     where key = p_key
       and window_start = to_timestamp(
         floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
       )),
    false
  )
$$;

revoke all on function public.rate_limit_exceeded(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_exceeded(text, integer, integer) to service_role;
