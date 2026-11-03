import { sendPremiumExpiringReminders } from "@/lib/push/reminders";

// Cron diario de Vercel (vercel.ts → crons). Vercel manda "Authorization: Bearer <CRON_SECRET>".
// Sin CRON_SECRET en las variables no hace nada: así nadie puede lanzarlo desde fuera.

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
  const premium = await sendPremiumExpiringReminders();
  return Response.json({ premium });
}
