import { cronUnauthorized } from "@/lib/cron";
import { sendListingExpiryEmails } from "@/lib/listings/expiry-reminders";
import { sendPremiumExpiringReminders } from "@/lib/push/reminders";
import { cleanupStorage } from "@/lib/storage/cleanup";

// Cron diario de Vercel (vercel.ts → crons), protegido con CRON_SECRET (lib/cron.ts).
// Tareas: aviso de Premium por caducar (push), emails de anuncios por caducar y limpieza de Storage.
// Con ?dry=1 solo calcula la limpieza de Storage, sin borrar ni avisar: para revisarla a mano.

export async function GET(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;
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
