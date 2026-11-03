-- Fase 1.6 (segunda parte) · Editar el perfil: bucket de fotos de perfil y comprobación de la ruta.
-- Especificación: MODELO-DATOS §3.1 (avatar_path) y §7 (profile-media). Decisión D-058.

-- ─── Storage: fotos de perfil (y, más adelante, logo y portada de la tienda) ─
-- Público para leer. Como en las fotos de anuncios (D-039), se sube con URLs firmadas que crea el
-- servidor: los usuarios no tienen permisos de escritura. WebP, o JPEG en Safari.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- El usuario puede escribir avatar_path (permiso por columna), así que la base de datos comprueba
-- que apunta a una foto suya: {user_id}/avatar-{uuid}.{webp|jpg}. Cada foto nueva lleva un nombre
-- nuevo, para que la CDN no siga sirviendo la anterior.
create or replace function public.profiles_check_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_path is not null
     and new.avatar_path !~ ('^' || new.id::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'avatar_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_check_avatar
before insert or update of avatar_path on public.profiles
for each row execute function public.profiles_check_avatar();

revoke all on function public.profiles_check_avatar() from public, anon, authenticated;
