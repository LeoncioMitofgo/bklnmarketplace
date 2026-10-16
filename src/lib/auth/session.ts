import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string };

/**
 * Usuario de la sesión actual o null. Verifica el JWT en local (getClaims) y se
 * memoriza por petición. Lee cookies: úsalo dentro de un <Suspense> o en Server Actions.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
});
