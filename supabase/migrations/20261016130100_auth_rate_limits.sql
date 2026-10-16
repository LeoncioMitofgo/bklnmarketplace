-- Límites de intentos que necesita la autenticación (valores iniciales, editables desde el admin).
update public.app_settings
set value = value || jsonb_build_object(
  'login_attempts_per_15_min_per_ip', 30,
  'signups_per_hour_per_ip', 5,
  'password_resets_per_hour', 3,
  'verification_emails_per_hour', 3
)
where key = 'rate_limits';
