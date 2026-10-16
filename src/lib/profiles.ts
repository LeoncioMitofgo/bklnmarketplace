import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** Etiqueta de caché del perfil público; invalidarla al editar el perfil. */
export const profileTag = (username: string) => `profile:${username}`;

/** Perfil público por username (sin teléfono ni email: no están en `profiles`). */
export async function getPublicProfile(username: string) {
  "use cache";
  cacheTag(profileTag(username));
  cacheLife("hours");

  const { data } = await createPublicClient()
    .from("profiles")
    .select(
      "id, username, display_name, avatar_path, bio, created_at, premium_until, response_time_minutes, city:cities(name)",
    )
    .eq("username", username)
    .maybeSingle();

  return data;
}
