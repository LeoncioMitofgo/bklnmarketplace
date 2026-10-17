import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { CheckIcon } from "@/components/icons";
import { PremiumRequestForm } from "@/components/premium/request-form";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { formatGqPhone, formatXaf } from "@/lib/format";
import { cancelPremiumRequest } from "@/lib/premium/actions";
import {
  getPremiumOffer,
  MVP_PAYMENT_METHODS,
  type PaymentMethod,
  type PremiumOffer,
} from "@/lib/premium/offer";
import { bestValue, pricePerMonth, savingsXaf } from "@/lib/premium/pricing";
import { createClient } from "@/lib/supabase/server";

// Hazte Premium (wireframe 12, ALCANCE §5.3): comparativa, periodos, formas de pago y solicitud.
// La oferta es pública y se cachea; el estado del usuario (Premium, solicitud) va en <Suspense>.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("premium");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: "/premium" },
  };
}

/** Plan y solicitud pendiente del usuario (memorizado: lo usan dos secciones). */
const loadMine = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase.from("profiles").select("username, premium_until").eq("id", user.id).single(),
    supabase
      .from("premium_requests")
      .select("months, price_xaf, payment_method")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);
  if (!profile) return null;
  const until = profile.premium_until ? new Date(profile.premium_until) : null;
  return {
    username: profile.username,
    premiumUntil: until && until.getTime() > Date.now() ? until : null,
    request,
  };
});

export default async function PremiumPage() {
  const [offer, t] = await Promise.all([getPremiumOffer(), getTranslations("premium")]);
  return (
    <main className="flex flex-col gap-7 px-4 pt-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-[15px] leading-relaxed text-text-muted">{t("subtitle")}</p>
      </header>
      <Suspense fallback={null}>
        <MyStatus offer={offer} />
      </Suspense>
      <ComparisonTable offer={offer} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("choose.title")}</h2>
        <Suspense fallback={<div className="h-72 rounded-card bg-surface" aria-hidden="true" />}>
          <Chooser offer={offer} />
        </Suspense>
      </section>
      <HowToPay offer={offer} />
    </main>
  );
}

async function MyStatus({ offer }: { offer: PremiumOffer }) {
  const [mine, t, format] = await Promise.all([
    loadMine(),
    getTranslations("premium"),
    getFormatter(),
  ]);
  if (!mine) return null;
  const { request } = mine;

  return (
    <>
      {mine.premiumUntil ? (
        <Alert tone="success">
          {t("active", { date: format.dateTime(mine.premiumUntil, { dateStyle: "short" }) })}
        </Alert>
      ) : null}
      {request ? (
        <section className="flex flex-col gap-3 rounded-card border-2 border-accent p-4">
          <h2 className="font-sans text-base font-bold">{t("pending.title")}</h2>
          <p className="text-[15px] font-semibold">
            {t("pending.summary", {
              months: t("choose.months", { count: request.months }),
              amount: formatXaf(request.price_xaf),
              method: t(`methods.${request.payment_method}.title`),
            })}
          </p>
          {request.payment_method === "money_transfer_agency" ? (
            <>
              <p className="text-sm leading-relaxed">
                {t("pending.agency", {
                  amount: formatXaf(request.price_xaf),
                  beneficiary: offer.office.agency_beneficiary,
                })}
              </p>
              <a
                href={`https://wa.me/${offer.office.payments_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                  t("pending.whatsappText", {
                    username: mine.username,
                    amount: formatXaf(request.price_xaf),
                    months: t("choose.months", { count: request.months }),
                  }),
                )}`}
                className={buttonClasses("primary")}
              >
                {t("pending.whatsapp")}
              </a>
            </>
          ) : (
            <p className="text-sm leading-relaxed">
              {t("pending.office", {
                amount: formatXaf(request.price_xaf),
                username: mine.username,
                address: offer.office.address,
                hours: offer.office.hours,
              })}
            </p>
          )}
          <form action={cancelPremiumRequest}>
            <button type="submit" className="min-h-11 text-sm font-semibold text-text-muted">
              {t("pending.cancel")}
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

async function ComparisonTable({ offer }: { offer: PremiumOffer }) {
  const t = await getTranslations("premium.compare");
  const { normal, premium } = offer;
  const flag = (value: boolean) =>
    value ? (
      <>
        <CheckIcon className="mx-auto size-5 text-success" />
        <span className="sr-only">{t("yes")}</span>
      </>
    ) : (
      <span className="text-text-muted">{t("no")}</span>
    );
  const rows: { label: string; normal: React.ReactNode; premium: React.ReactNode }[] = [
    {
      label: t("listings"),
      normal: normal.max_active_listings,
      premium: premium.max_active_listings,
    },
    { label: t("photos"), normal: normal.max_photos, premium: premium.max_photos },
    {
      label: t("duration"),
      normal: t("days", { count: normal.listing_duration_days }),
      premium: t("days", { count: premium.listing_duration_days }),
    },
    {
      label: t("renew"),
      normal: normal.auto_renew ? t("renewAuto") : t("renewManual"),
      premium: premium.auto_renew ? t("renewAuto") : t("renewManual"),
    },
    { label: t("featured"), normal: flag(normal.is_featured), premium: flag(premium.is_featured) },
    { label: t("badge"), normal: flag(false), premium: flag(true) },
    { label: t("store"), normal: flag(normal.has_store), premium: flag(premium.has_store) },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{t("title")}</h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-1/2 py-2 text-left font-normal text-text-muted">
              <span className="sr-only">{t("feature")}</span>
            </th>
            <th scope="col" className="py-2 text-center font-semibold">
              {t("normal")}
            </th>
            <th scope="col" className="py-2 text-center">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-text">
                {t("premium")}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <th scope="row" className="py-2.5 pr-2 text-left font-normal leading-snug">
                {row.label}
              </th>
              <td className="py-2.5 text-center">{row.normal}</td>
              <td className="py-2.5 text-center font-semibold">{row.premium}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function Chooser({ offer }: { offer: PremiumOffer }) {
  const [mine, t] = await Promise.all([loadMine(), getTranslations("premium")]);
  const best = bestValue(offer.prices);
  const periods = offer.prices.map((p) => {
    const saving = savingsXaf(offer.prices, p.months);
    return {
      value: String(p.months),
      title: `${t("choose.months", { count: p.months })} · ${formatXaf(p.price_xaf)}`,
      detail:
        p.months > 1
          ? `${t("choose.perMonth", { price: formatXaf(pricePerMonth(p)) })}${
              saving > 0 ? ` · ${t("choose.saving", { amount: formatXaf(saving) })}` : ""
            }`
          : undefined,
      badge: p.months === best?.months && p.months > 1 ? t("choose.best") : undefined,
    };
  });

  if (!mine) {
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {periods.map((p) => (
            <li
              key={p.value}
              className="flex flex-col gap-0.5 rounded-control border border-border p-3"
            >
              <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {p.title}
                {p.badge ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
                    {p.badge}
                  </span>
                ) : null}
              </span>
              {p.detail ? <span className="text-xs text-text-muted">{p.detail}</span> : null}
            </li>
          ))}
        </ul>
        <Link href="/entrar?next=/premium" className={buttonClasses("accent")}>
          {t("choose.login")}
        </Link>
      </div>
    );
  }

  const methods = MVP_PAYMENT_METHODS.map((m: PaymentMethod) => ({
    value: m,
    title: t(`methods.${m}.title`),
    detail: t(`methods.${m}.hint`),
  }));

  return (
    <PremiumRequestForm
      periods={periods}
      methods={methods}
      defaults={{
        months: mine.request ? String(mine.request.months) : undefined,
        method: mine.request?.payment_method,
      }}
      labels={{
        period: t("choose.period"),
        method: t("choose.method"),
        submit: mine.request ? t("choose.change") : t("choose.submit"),
        submitting: t("choose.submitting"),
        errors: {
          months_required: t("errors.months_required"),
          method_required: t("errors.method_required"),
          premium_invalid: t("errors.premium_invalid"),
          account_restricted: t("errors.account_restricted"),
          unexpected: t("errors.unexpected"),
        },
      }}
    />
  );
}

async function HowToPay({ offer }: { offer: PremiumOffer }) {
  const t = await getTranslations("premium.pay");
  const { office } = offer;
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <h2 className="text-lg font-extrabold">{t("title")}</h2>
      <div className="flex flex-col gap-1">
        <h3 className="font-sans text-[15px] font-bold">{t("officeTitle")}</h3>
        <p className="text-sm leading-relaxed">
          {t("officeText", { name: office.name, address: office.address, hours: office.hours })}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-sans text-[15px] font-bold">{t("agencyTitle")}</h3>
        <p className="text-sm leading-relaxed">
          {t("agencyText", {
            beneficiary: office.agency_beneficiary,
            phone: formatGqPhone(office.payments_whatsapp),
          })}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-text-muted">{t("manual")}</p>
    </section>
  );
}
