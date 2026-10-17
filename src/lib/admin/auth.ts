import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Para las páginas del panel: sin sesión, a entrar; sin rol de admin, "no existe" (no se anuncia
 * que hay un panel). Las RPC de admin vuelven a comprobarlo en la base de datos.
 */
export async function requireAdmin(next: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();
  return { user, supabase };
}
