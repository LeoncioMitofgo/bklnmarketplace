-- El trigger de términos prohibidos se ejecuta con el rol del usuario, que no puede llamar a
-- find_banned_term (su lista no es pública). Con SECURITY DEFINER el trigger sí puede consultarla.
alter function public.listings_check_banned_terms() security definer;

revoke all on function public.listings_check_banned_terms() from public, anon, authenticated;
revoke all on function public.listings_set_category() from public, anon, authenticated;
