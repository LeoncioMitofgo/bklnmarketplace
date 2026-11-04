// Las rutas de cron (vercel.ts → crons) se protegen con CRON_SECRET: Vercel manda
// "Authorization: Bearer <CRON_SECRET>". Sin la variable no hacen nada: así nadie puede lanzarlas
// desde fuera.

/** Respuesta 401 si la petición no trae el secreto; null si puede seguir. */
export function cronUnauthorized(request: Request): Response | null {
  // Recortado: un espacio o un salto de línea al pegar el valor en Vercel no debe romperlo.
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (secret && header === `Bearer ${secret}`) return null;
  // Para entender un 401 en los logs de Vercel, sin enseñar el secreto.
  console.warn("cron_unauthorized", {
    secretConfigured: Boolean(secret),
    authorizationSent: header.startsWith("Bearer "),
  });
  return new Response("Unauthorized", { status: 401 });
}
