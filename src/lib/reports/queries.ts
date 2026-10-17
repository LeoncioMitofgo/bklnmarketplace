import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Anuncio que se puede denunciar, también si está en revisión: la denuncia que lo oculta invalida
 * la caché y la página se vuelve a pintar, y tiene que seguir en pie para mostrar "Denuncia enviada".
 * Solo datos públicos del anuncio.
 */
export async function getReportableListing(code: string) {
  const { data } = await createAdminClient()
    .from("listings")
    .select("id, code, title, city_id, user_id")
    .eq("code", code)
    .in("status", ["active", "sold", "under_review"])
    .maybeSingle();
  return data;
}
