import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo menos estáticos, imágenes e iconos.
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)",
  ],
};
