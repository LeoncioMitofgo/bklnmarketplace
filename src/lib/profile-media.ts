// Fotos de perfil (y, más adelante, logo y portada de la tienda) en el bucket público profile-media.

export const PROFILE_MEDIA_BUCKET = "profile-media";

/** {user_id}/avatar-{uuid}.{webp|jpg}: debe coincidir con el trigger profiles_check_avatar. */
export const AVATAR_PATH = /^[0-9a-f-]{36}\/avatar-[0-9a-f-]{36}\.(webp|jpg)$/;

export function profileMediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PROFILE_MEDIA_BUCKET}/${path}`;
}
