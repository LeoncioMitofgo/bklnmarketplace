import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/admin/status-badge";
import { ChevronRightIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/auth";

// Cola de denuncias abiertas: anuncios (agrupadas por anuncio, los ocultos primero) y personas
// denunciadas desde el chat (una por denuncia, con acceso a la conversación).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminReports />
    </Suspense>
  );
}

async function AdminReports() {
  const { supabase } = await requireAdmin("/admin/denuncias");
  const [{ data, error }, t, tReasons, format] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, reason, created_at, listing_id, listing:listings!reports_listing_id_fkey(id, title, status), reported:profiles!reports_reported_user_id_fkey(display_name, username)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(300),
    getTranslations("admin.reports"),
    getTranslations("admin.reasons"),
    getFormatter(),
  ]);
  if (error) throw new Error(`admin_reports: ${error.message}`);
  const now = Date.now();

  type Group = {
    id: string;
    title: string;
    status: string;
    count: number;
    reasons: Set<string>;
    last: string;
  };
  const byListing = new Map<string, Group>();
  const people = [];
  for (const report of data) {
    if (report.listing_id && report.listing) {
      const group = byListing.get(report.listing_id) ?? {
        id: report.listing_id,
        title: report.listing.title ?? t("untitled"),
        status: report.listing.status,
        count: 0,
        reasons: new Set<string>(),
        last: report.created_at,
      };
      group.count++;
      group.reasons.add(tReasons(report.reason));
      byListing.set(report.listing_id, group);
    } else if (!report.listing_id) {
      people.push(report);
    }
  }
  const listings = [...byListing.values()].sort(
    (a, b) =>
      Number(b.status === "under_review") - Number(a.status === "under_review") ||
      b.count - a.count,
  );

  return (
    <AdminShell active="reports">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">{t("listingsTitle")}</h1>
        {listings.length === 0 ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/denuncias/anuncio/${g.id}`}
                  className="flex items-center gap-3 rounded-card border border-border p-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">{g.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge status={g.status} label={t(`status.${g.status}`)} />
                      <span>{t("count", { count: g.count })}</span>
                    </span>
                    <span className="text-sm text-text-muted">
                      {[...g.reasons].join(" · ")} ·{" "}
                      {format.relativeTime(new Date(g.last), { now, style: "short" })}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("peopleTitle")}</h2>
        {people.length === 0 ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            {t("emptyPeople")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {people.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/denuncias/${r.id}`}
                  className="flex items-center gap-3 rounded-card border border-border p-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">
                      {r.reported
                        ? `${r.reported.display_name} (@${r.reported.username})`
                        : t("deletedUser")}
                    </span>
                    <span className="text-sm text-text-muted">
                      {tReasons(r.reason)} ·{" "}
                      {format.relativeTime(new Date(r.created_at), { now, style: "short" })}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
