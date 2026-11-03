import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getPremiumOffer } from "@/lib/premium/offer";
import { PREMIUM_REMINDER_DAYS } from "@/lib/push/reminders";

const DAY = 86400000;
/** Durante cuánto tiempo, después de caducar, se explica lo que ha pasado. */
const EXPIRED_NOTICE_DAYS = 30;

/**
 * Aviso de Premium (ALCANCE §5.3): "caduca en N días" en la última semana y, con `showExpired`,
 * qué pasa cuando ya ha caducado. Va dentro de un <Suspense> de sesión (usa la hora actual).
 */
export async function PremiumNotice({
  premiumUntil,
  showExpired = false,
}: {
  premiumUntil: string | null;
  showExpired?: boolean;
}) {
  if (!premiumUntil) return null;
  const until = Date.parse(premiumUntil);
  const now = Date.now();
  const expiring = until > now && until - now <= PREMIUM_REMINDER_DAYS * DAY;
  const expired = showExpired && until <= now && now - until <= EXPIRED_NOTICE_DAYS * DAY;
  if (!expiring && !expired) return null;

  const [t, format, offer] = await Promise.all([
    getTranslations("premiumNotice"),
    getFormatter(),
    getPremiumOffer(),
  ]);
  const date = format.dateTime(new Date(until), { dateStyle: "short" });

  return (
    <div className="flex flex-col gap-2 rounded-card border-2 border-accent px-4 py-3">
      <p className="text-sm leading-relaxed">
        {expiring
          ? t("expiring", { count: Math.ceil((until - now) / DAY), date })
          : t("expired", { date, max: offer.normal.max_active_listings })}
      </p>
      <Link href="/premium" className="self-start text-sm font-bold text-primary">
        {t("renew")}
      </Link>
    </div>
  );
}
