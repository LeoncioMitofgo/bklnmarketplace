"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda o quita un favorito. Funciona también sin JavaScript (formulario normal).
 * Sin sesión, manda a entrar y vuelve a `returnTo` (ALCANCE §4.3).
 */
export async function toggleFavorite(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listingId") ?? "");
  const returnTo = safeNextPath(formData.get("returnTo"), "/favoritos");
  const save = formData.get("save") === "1";

  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(returnTo)}`);

  const supabase = await createClient();
  if (save) {
    const { error } = await supabase.from("favorites").insert({ listing_id: listingId });
    // 23505: ya estaba guardado. Lo demás (anuncio que ya no está activo) se ignora sin romper la página.
    if (error && error.code !== "23505")
      console.error("favorite_insert", error.code, error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (error) console.error("favorite_delete", error.code, error.message);
  }
  refresh();
}
