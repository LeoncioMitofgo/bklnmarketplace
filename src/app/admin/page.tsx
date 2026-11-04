import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminColumns, AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { ChevronRightIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/auth";
import { getValidationMetrics } from "@/lib/admin/validation-metrics";
import { formatNumber, responseTimeParts } from "@/lib/format";

// Resumen del panel: colas pendientes, métricas básicas (ALCANCE §4.11) y las de validación (§9, D-072).

// Visitas y búsquedas: las cuenta Vercel Web Analytics (ARQUITECTURA §2), no nuestra base de datos.
const ANALYTICS_URL = "https://vercel.com/bkln-software/bkln_marketplace/analytics";

type Stat = { label: string; value: string; detail?: string };

type Metrics = Record<
  | "pending_requests"
  | "open_reports"
  | "under_review"
  | "premium_active"
  | "users_total"
  | "users_7d"
  | "users_30d"
  | "listings_active"
  | "listings_7d"
  | "listings_30d"
  | "conversations_7d"
  | "conversations_30d",
  number
>;

export default function AdminHomePage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const { supabase } = await requireAdmin("/admin");
  const [{ data, error }, v, t] = await Promise.all([
    supabase.rpc("admin_metrics"),
    getValidationMetrics(),
    getTranslations("admin.home"),
  ]);
  if (error || !data) throw new Error(`admin_metrics: ${error?.message}`);
  const m = data as Metrics;

  const queues = [
    { href: "/admin/pagos", label: t("pendingRequests"), value: m.pending_requests },
    { href: "/admin/denuncias", label: t("openReports"), value: m.open_reports },
    { href: "/admin/denuncias", label: t("underReview"), value: m.under_review },
  ];
  const stats: Stat[] = [
    {
      label: t("users"),
      value: formatNumber(m.users_total),
      detail: t("recent", { week: m.users_7d, month: m.users_30d }),
    },
    {
      label: t("listings"),
      value: formatNumber(m.listings_active),
      detail: t("published", { week: m.listings_7d, month: m.listings_30d }),
    },
    {
      label: t("conversations"),
      value: formatNumber(m.conversations_30d),
      detail: t("lastWeek", { count: m.conversations_7d }),
    },
    { label: t("premium"), value: formatNumber(m.premium_active) },
  ];
  const response =
    v.medianResponseMinutes === null ? null : responseTimeParts(v.medianResponseMinutes);
  const validation: Stat[] = [
    {
      label: t("withMessage"),
      value:
        v.listingsWithMessagePct === null ? "—" : t("percent", { value: v.listingsWithMessagePct }),
      detail: t("withMessageDetail", { with: v.listingsWithMessage, total: v.listingsPublished }),
    },
    {
      label: t("responseTime"),
      value: response ? t(`responseUnits.${response.unit}`, { count: response.count }) : "—",
      detail: t("responseTimeDetail", { count: v.sellersWithResponseTime }),
    },
    {
      label: t("active"),
      value: formatNumber(v.activeUsers),
      detail: t("activeDetail", {
        returning: v.returningUsers,
        new: v.activeUsers - v.returningUsers,
      }),
    },
    {
      label: t("premiumMonth"),
      value: formatNumber(v.premiumActivations),
      detail: t("premiumMonthDetail", { count: v.premiumRequests }),
    },
  ];

  return (
    <AdminShell active="home">
      <AdminColumns>
        <section className="flex flex-col gap-2">
          <h1 className="text-xl font-extrabold">{t("title")}</h1>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {queues.map((q) => (
              <li key={q.label}>
                <Link
                  href={q.href}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 hover:bg-surface"
                >
                  <span className="text-[15px]">{q.label}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-bold ${
                        q.value > 0 ? "bg-accent text-text" : "bg-surface text-text-muted"
                      }`}
                    >
                      {formatNumber(q.value)}
                    </span>
                    <ChevronRightIcon className="size-5 text-text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">{t("metrics")}</h2>
          <Stats items={stats} className="grid grid-cols-2 gap-3" />
        </section>
      </AdminColumns>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("validation")}</h2>
        <p className="text-sm text-text-muted">{t("validationHint")}</p>
        <Stats items={validation} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />
        <a
          href={ANALYTICS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center text-sm font-semibold text-primary"
        >
          {t("visits")}
        </a>
      </section>
    </AdminShell>
  );
}

function Stats({ items, className }: { items: Stat[]; className: string }) {
  return (
    <ul className={className}>
      {items.map((s) => (
        <li key={s.label} className="flex flex-col gap-1 rounded-card bg-surface p-4">
          <span className="text-xs text-text-muted">{s.label}</span>
          <span className="font-display text-2xl font-extrabold">{s.value}</span>
          {s.detail ? <span className="text-xs text-text-muted">{s.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}
