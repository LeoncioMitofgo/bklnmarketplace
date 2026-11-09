import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { profileTag } from "@/lib/profiles";
import { createPublicClient } from "@/lib/supabase/public";

// Tienda pública (ALCANCE §4.8). La RLS de stores solo la devuelve si el dueño es Premium y no
// está baneado: si caduca Premium, la página da "no existe" pero los datos se conservan.

/** Etiqueta de caché de la tienda; invalidarla al editarla. */
export const storeTag = (slug: string) => `store:${slug}`;

export async function getPublicStore(slug: string) {
  "use cache";
  cacheTag(storeTag(slug));
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("stores")
    .select(
      "user_id, slug, name, description, logo_path, cover_path, address, opening_hours, call_phone, updated_at, owner:profiles!stores_user_id_fkey(username, display_name, avatar_path, created_at, premium_until, response_time_minutes, is_demo, city:cities(name))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`public_store: ${error.message}`);
  if (!data?.owner) return null;
  // Activar o caducar Premium, banear o cambiar el perfil invalidan la etiqueta del perfil.
  cacheTag(profileTag(data.owner.username));
  return { ...data, owner: data.owner, fetchedAt: Date.now() };
}

export type PublicStore = NonNullable<Awaited<ReturnType<typeof getPublicStore>>>;

/** Tiendas visibles, para el sitemap. `is_demo`: antes del lanzamiento solo van las reales (D-081). */
export async function getSitemapStores() {
  "use cache";
  cacheTag("stores");
  cacheLife("hours");

  const { data } = await createPublicClient()
    .from("stores")
    .select("user_id, slug, updated_at, owner:profiles!stores_user_id_fkey(is_demo)");
  return (data ?? []).map(({ owner, ...store }) => ({ ...store, isDemo: owner?.is_demo ?? true }));
}
