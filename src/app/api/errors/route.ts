import { z } from "zod";
import { captureError } from "@/lib/monitoring/sentry";

// Errores del navegador (components/monitoring/error-reporter.tsx) hacia Sentry (D-072).
// Solo desde nuestras páginas y con tamaño acotado; lo que no cuadre se descarta sin más.

const schema = z.object({
  type: z.string().max(100),
  message: z.string().max(1000),
  stack: z.string().max(5000).optional(),
  path: z.string().max(500).startsWith("/"),
});

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try {
    return origin !== null && new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  await captureError({
    source: "client",
    ...parsed.data,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });
  return new Response(null, { status: 204 });
}
