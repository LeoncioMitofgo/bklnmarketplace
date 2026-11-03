import { sendPremiumExpiringReminders } from "@/lib/push/reminders";

// Cron diario de Vercel (vercel.ts → crons). Vercel manda "Authorization: Bearer <CRON_SECRET>".
// Sin CRON_SECRET en las variables no hace nada: así nadie puede lanzarlo desde fuera.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const premium = await sendPremiumExpiringReminders();
  return Response.json({ premium });
}
