import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { ChevronRightIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/auth";
import { formatNumber } from "@/lib/format";

// Resumen del panel: colas pendientes y métricas básicas (ALCANCE §4.11).

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
  const [{ data, error }, t] = await Promise.all([
    supabase.rpc("admin_metrics"),
    getTranslations("admin.home"),
  ]);
  if (error || !data) throw new Error(`admin_metrics: ${error?.message}`);
  const m = data as Metrics;

  const queues = [
    { href: "/admin/pagos", label: t("pendingRequests"), value: m.pending_requests },
    { href: "/admin/denuncias", label: t("openReports"), value: m.open_reports },
    { href: "/admin/denuncias", label: t("underReview"), value: m.under_review },
  ];
  const stats = [
    {
      label: t("users"),
      value: m.users_total,
      detail: t("recent", { week: m.users_7d, month: m.users_30d }),
    },
    {
      label: t("listings"),
      value: m.listings_active,
      detail: t("published", { week: m.listings_7d, month: m.listings_30d }),
    },
    {
      label: t("conversations"),
      value: m.conversations_30d,
      detail: t("lastWeek", { count: m.conversations_7d }),
    },
    { label: t("premium"), value: m.premium_active },
  ];

  return (
    <AdminShell active="home">
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-extrabold">{t("title")}</h1>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {queues.map((q) => (
            <li key={q.label}>
              <Link href={q.href} className="flex min-h-14 items-center justify-between gap-3 px-4">
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
        <ul className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <li key={s.label} className="flex flex-col gap-1 rounded-card bg-surface p-4">
              <span className="text-xs text-text-muted">{s.label}</span>
              <span className="font-display text-2xl font-extrabold">{formatNumber(s.value)}</span>
              {s.detail ? <span className="text-xs text-text-muted">{s.detail}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
