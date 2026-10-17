import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Pantallas que exigen sesión. Sin ella se va a /entrar aquí, antes de montar la página (D-054):
 * si la redirección la hiciera la página, Next 16 la deja montada en segundo plano y, al volver
 * tras entrar, repetía la redirección. Las páginas lo siguen comprobando por si acaso.
 */
function requiresSession(pathname: string): boolean {
  return (
    /^\/(cuenta|favoritos|mis-anuncios|mensajes|publicar)(\/|$)/.test(pathname) ||
    /^\/anuncio\/[^/]+\/denunciar$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  if (signedIn || !requiresSession(request.nextUrl.pathname)) return response;

  const back = new URL(request.nextUrl);
  back.searchParams.delete("_rsc");
  const login = new URL("/entrar", request.nextUrl);
  login.searchParams.set("next", `${back.pathname}${back.search}`);
  const redirect = NextResponse.redirect(login);
  // Si la sesión no se pudo renovar, Supabase borra sus cookies: que se borren también aquí.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Todo menos estáticos, imágenes e iconos.
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)",
  ],
};
