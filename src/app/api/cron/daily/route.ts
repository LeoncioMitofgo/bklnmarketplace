import { sendListingExpiryEmails } from "@/lib/listings/expiry-reminders";
import { sendPremiumExpiringReminders } from "@/lib/push/reminders";
import { cleanupStorage } from "@/lib/storage/cleanup";

// Cron diario de Vercel (vercel.ts → crons). Vercel manda "Authorization: Bearer <CRON_SECRET>".
// Sin CRON_SECRET en las variables no hace nada: así nadie puede lanzarlo desde fuera.
// Tareas: aviso de Premium por caducar (push), emails de anuncios por caducar y limpieza de Storage.
// Con ?dry=1 solo calcula la limpieza de Storage, sin borrar ni avisar: para revisarla a mano.

export async function GET(request: Request) {
  // Recortado: un espacio o un salto de línea al pegar el valor en Vercel no debe romperlo.
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    // Para entender un 401 en los logs de Vercel, sin enseñar el secreto.
    console.warn("cron_unauthorized", {
      secretConfigured: Boolean(secret),
      authorizationSent: header.startsWith("Bearer "),
    });
    return new Response("Unauthorized", { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  if (params.get("dry") === "1") {
    return Response.json({ storage: await cleanupStorage({ dryRun: true }) });
  }
  // ?only=premium|listings|storage lanza una sola tarea: las pruebas e2e, para no tocar lo demás.
  const only = params.get("only");
  const run = (job: string) => !only || only === job;
  const premium = run("premium") ? await sendPremiumExpiringReminders() : undefined;
  const listings = run("listings") ? await sendListingExpiryEmails() : undefined;
  const storage = run("storage") ? await cleanupStorage() : undefined;
  return Response.json({ premium, listings, storage });
}
