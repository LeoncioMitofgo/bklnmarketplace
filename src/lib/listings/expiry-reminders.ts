import "server-only";
import { sendEmail } from "@/lib/email/send";
import { listingExpiryMessage } from "@/lib/email/templates";
import { getRenewWindowDays } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// Emails de anuncio por caducar y caducado (ALCANCE §4.6), desde el cron diario (/api/cron/daily).
// Un solo email por vendedor y día, con todos sus anuncios. notification_log evita repetir un anuncio
// en el mismo periodo (la referencia es el anuncio y su fecha de caducidad, D-074).

const DAY = 86_400_000;
/** Se avisa de lo que caducó en los dos últimos días: cubre un día en que el cron no corra. */
const EXPIRED_LOOKBACK_DAYS = 2;
/** Resend deja 2 envíos por segundo en el plan gratuito. */
const SEND_GAP_MS = 600;

type Due = { id: string; userId: string; title: string; expiresAt: string };
type Kind = "listing_expiring" | "listing_expired";

const ref = (l: Due) => `${l.id}:${l.expiresAt.slice(0, 10)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendListingExpiryEmails(): Promise<{ users: number; sent: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const days = await getRenewWindowDays();
  const [expiring, expired, plans] = await Promise.all([
    admin
      .from("listings")
      .select("id, user_id, title, expires_at, owner:profiles!listings_user_id_fkey(premium_until)")
      .eq("status", "active")
      .gt("expires_at", new Date(now).toISOString())
      .lte("expires_at", new Date(now + days * DAY).toISOString()),
    admin
      .from("listings")
      .select("id, user_id, title, expires_at")
      .eq("status", "expired")
      .gt("expires_at", new Date(now - EXPIRED_LOOKBACK_DAYS * DAY).toISOString()),
    admin.from("plans").select("id, auto_renew").eq("id", "premium").single(),
  ]);
  if (expiring.error || expired.error || plans.error) {
    throw new Error(`listing_expiry: ${(expiring.error ?? expired.error ?? plans.error)?.message}`);
  }

  // Los de Premium se renuevan solos si siguen siéndolo al caducar (renew_premium_listings).
  const autoRenews = (premiumUntil: string | null | undefined, expiresAt: string) =>
    plans.data.auto_renew && !!premiumUntil && premiumUntil > expiresAt;
  const byUser = new Map<string, Record<Kind, Due[]>>();
  const add = (
    kind: Kind,
    l: { id: string; user_id: string; title: string | null; expires_at: string | null },
  ) => {
    if (!l.title || !l.expires_at) return;
    const entry = byUser.get(l.user_id) ?? { listing_expiring: [], listing_expired: [] };
    entry[kind].push({ id: l.id, userId: l.user_id, title: l.title, expiresAt: l.expires_at });
    byUser.set(l.user_id, entry);
  };
  for (const l of expiring.data) {
    if (!autoRenews(l.owner?.premium_until, l.expires_at ?? "")) add("listing_expiring", l);
  }
  for (const l of expired.data) add("listing_expired", l);

  let sent = 0;
  for (const [userId, due] of byUser) {
    const [{ data: auth }, { data: settings }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profile_private")
        .select("email_verified_at, notify_email")
        .eq("user_id", userId)
        .single(),
      admin.from("profiles").select("display_name").eq("id", userId).single(),
    ]);
    const email = auth.user?.email;
    // Ni cuentas de demostración (D-047) ni emails sin confirmar: rebotarían.
    if (!email || auth.user?.user_metadata?.demo || !settings?.email_verified_at) continue;
    if (!settings.notify_email) continue;

    // Primero se apunta: lo que ya estaba (otro día u otro cron a la vez) no se repite.
    const rows = (Object.keys(due) as Kind[]).flatMap((kind) =>
      due[kind].map((l) => ({ user_id: userId, kind, ref: ref(l), channel: "email" as const })),
    );
    const { data: logged, error } = await admin
      .from("notification_log")
      .upsert(rows, { onConflict: "user_id,kind,ref,channel", ignoreDuplicates: true })
      .select("kind, ref");
    if (error) {
      console.error("listing_expiry_log", error.message);
      continue;
    }
    const isNew = (kind: Kind) => (l: Due) =>
      logged.some((r) => r.kind === kind && r.ref === ref(l));
    const fresh = {
      expiring: due.listing_expiring.filter(isNew("listing_expiring")).map((l) => l.title),
      expired: due.listing_expired.filter(isNew("listing_expired")).map((l) => l.title),
    };
    if (!fresh.expiring.length && !fresh.expired.length) continue;

    if (sent) await pause(SEND_GAP_MS);
    try {
      await sendEmail(
        await listingExpiryMessage(email, profile?.display_name ?? "", { ...fresh, days }),
      );
      sent++;
    } catch (sendError) {
      // Que lo intente mañana: se quita lo apuntado.
      console.error(
        "listing_expiry_send",
        sendError instanceof Error ? sendError.message : sendError,
      );
      await admin
        .from("notification_log")
        .delete()
        .eq("user_id", userId)
        .eq("channel", "email")
        .in(
          "ref",
          logged.map((r) => r.ref),
        );
    }
  }
  return { users: byUser.size, sent };
}
