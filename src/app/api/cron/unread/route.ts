import { sendUnreadMessageEmails } from "@/lib/chat/unread-emails";
import { cronUnauthorized } from "@/lib/cron";

// Emails de mensajes sin leer (D-076), protegido con CRON_SECRET (lib/cron.ts). Con el plan Pro,
// Vercel lo lanza cada 15 minutos (vercel.ts). En Hobby no se puede programar más de una vez al día,
// así que hasta entonces no está en crons y solo se lanza a mano.

export async function GET(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;
  return Response.json({ unread: await sendUnreadMessageEmails() });
}
