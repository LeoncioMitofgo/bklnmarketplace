import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPremiumExpiring } from "./notify";

// Avisos programados que lanza el cron diario (/api/cron/daily). notification_log evita repetirlos.

/** Días antes de que caduque Premium en los que se avisa (ALCANCE §5.3). */
export const PREMIUM_REMINDER_DAYS = 7;

/**
 * Avisa por push a quien tiene Premium y le caduca en los próximos 7 días, una vez por periodo
 * (la referencia es la fecha de fin). Se apunta aunque no tenga avisos activados, para no volver a
 * mirarlo cada día.
 */
export async function sendPremiumExpiringReminders(): Promise<{ due: number; pushed: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const limit = new Date(now.getTime() + PREMIUM_REMINDER_DAYS * 86400000);
  const { data: users, error } = await admin
    .from("profiles")
    .select("id, premium_until")
    .gt("premium_until", now.toISOString())
    .lte("premium_until", limit.toISOString());
  if (error) throw new Error(`premium_reminders: ${error.message}`);

  let due = 0;
  let pushed = 0;
  for (const user of users ?? []) {
    if (!user.premium_until) continue;
    const ref = user.premium_until.slice(0, 10);
    // Primero se apunta: si ya estaba (otro cron a la vez o un día anterior), no se envía.
    const { error: logError } = await admin
      .from("notification_log")
      .insert({ user_id: user.id, kind: "premium_expiring", ref, channel: "push" });
    if (logError) {
      if (logError.code !== "23505") console.error("premium_reminders_log", logError.message);
      continue;
    }
    due++;
    if (await notifyPremiumExpiring(user.id, user.premium_until)) pushed++;
  }
  return { due, pushed };
}
