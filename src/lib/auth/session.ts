import "server-only";
import { io } from "next/cache";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string };

/**
 * Usuario de la sesión actual o null. Verifica el JWT en local (getClaims) y se
 * memoriza por petición. Lee cookies: úsalo dentro de un <Suspense> o en Server Actions.
 *
 * io(): getClaims mira la caducidad del token con la hora actual. Con la precarga parcial de
 * Next 16, el "App Shell" de una ruta se prerenderiza con las cookies y ahí la hora está
 * prohibida; io() deja lo que depende de la sesión fuera de esa precarga (se ve el esqueleto)
 * y no cambia nada en una visita o navegación normal.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await io();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
});
