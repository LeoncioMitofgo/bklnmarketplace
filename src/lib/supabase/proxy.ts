import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Refresca la sesión de Supabase en cada petición con sesión y dice si hay una sesión válida.
 * Los visitantes sin cookies de Supabase (la mayoría) no pagan nada.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; signedIn: boolean }> {
  let response = NextResponse.next({ request });

  const hasAuthCookie = request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
  if (!hasAuthCookie || !hasSupabaseEnv()) {
    return { response, signedIn: false };
  }

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cabeceras anti-caché: una respuesta con cookies de sesión nunca debe quedarse en la CDN.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Valida el JWT (en local, con las claves asimétricas del proyecto) y lo renueva si va a caducar.
  const { data } = await supabase.auth.getClaims();

  return { response, signedIn: Boolean(data?.claims?.sub) };
}
