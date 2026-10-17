import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { ChevronRightIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/auth";
import { formatGqPhone, formatXaf } from "@/lib/format";

// Pagos por confirmar (wireframe 13): solicitudes pendientes, de la más antigua a la más nueva,
// y los últimos cobros registrados. El cobro se registra en la ficha del usuario.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.payments");
  return { title: t("title") };
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminPayments />
    </Suspense>
  );
}

async function AdminPayments() {
  const { supabase } = await requireAdmin("/admin/pagos");
  const [requests, activations, t, tMethods, format] = await Promise.all([
    supabase
      .from("premium_requests")
      .select(
        "id, months, price_xaf, payment_method, created_at, user:profiles!premium_requests_user_id_fkey(id, username, display_name, profile_private(phone))",
      )
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("premium_activations")
      .select(
        "id, months, amount_xaf, method, reference, period_end, created_at, user:profiles!premium_activations_user_id_fkey(id, username), admin:profiles!premium_activations_created_by_fkey(username)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    getTranslations("admin.payments"),
    getTranslations("admin.methods"),
    getFormatter(),
  ]);
  if (requests.error || activations.error) {
    throw new Error(`admin_payments: ${requests.error?.message ?? activations.error?.message}`);
  }
  const now = Date.now();

  return (
    <AdminShell active="payments">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">{t("title")}</h1>
        {requests.data.length === 0 ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.data.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/usuarios/${r.user?.id}#premium`}
                  className="flex items-center gap-3 rounded-card border border-border p-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">
                      {r.user?.display_name}{" "}
                      <span className="font-normal text-text-muted">@{r.user?.username}</span>
                    </span>
                    <span className="text-[15px] font-semibold">
                      {t("summary", { months: r.months, amount: formatXaf(r.price_xaf) })}
                    </span>
                    <span className="text-sm text-text-muted">
                      {tMethods(r.payment_method)} ·{" "}
                      {format.relativeTime(new Date(r.created_at), { now, style: "short" })}
                      {r.user?.profile_private?.phone
                        ? ` · ${formatGqPhone(r.user.profile_private.phone)}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center text-sm font-semibold text-primary">
                    {t("register")}
                    <ChevronRightIcon className="size-5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">{t("recent")}</h2>
        {activations.data.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noActivations")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {activations.data.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-3">
                <span className="font-semibold">
                  {a.user ? (
                    <Link href={`/admin/usuarios/${a.user.id}`} className="text-primary">
                      @{a.user.username}
                    </Link>
                  ) : (
                    t("deletedUser")
                  )}{" "}
                  · {t("summary", { months: a.months, amount: formatXaf(a.amount_xaf) })}
                </span>
                <span className="text-text-muted">
                  {tMethods(a.method)} · {a.reference} ·{" "}
                  {t("until", {
                    date: format.dateTime(new Date(a.period_end), { dateStyle: "short" }),
                  })}
                </span>
                <span className="text-xs text-text-muted">
                  {t("registeredBy", {
                    admin: a.admin?.username ?? "—",
                    date: format.dateTime(new Date(a.created_at), {
                      dateStyle: "short",
                      timeStyle: "short",
                    }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
