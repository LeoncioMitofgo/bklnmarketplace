import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { PremiumActivateForm } from "@/components/admin/premium-form";
import { TextAreaField } from "@/components/admin/text-area-field";
import { UserBadges } from "@/components/admin/user-badges";
import { inputClasses } from "@/components/ui/field";
import { setBanned, suspendUser } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { formatGqPhone, formatXaf } from "@/lib/format";
import { getPremiumOffer, MVP_PAYMENT_METHODS } from "@/lib/premium/offer";

// Ficha de un usuario en el panel (ALCANCE §4.11): datos, Premium (activar o ampliar con el cobro),
// anuncios, suspender o banear, e historial de moderación.

const SUSPENSION_DAYS = [1, 3, 7, 30];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.user");
  return { title: t("title") };
}

export default function AdminUserPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminUser params={params} />
    </Suspense>
  );
}

async function AdminUser({ params }: Pick<PageProps<"/admin/usuarios/[id]">, "params">) {
  const { id } = await params;
  const { supabase } = await requireAdmin(`/admin/usuarios/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [users, request, activations, listings, log, offer, t, tMethods, tStatus, format] =
    await Promise.all([
      supabase.rpc("admin_users", { p_user_id: id }),
      supabase
        .from("premium_requests")
        .select("months, price_xaf, payment_method, created_at")
        .eq("user_id", id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("premium_activations")
        .select("id, months, amount_xaf, method, reference, period_start, period_end, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("listings").select("status").eq("user_id", id).neq("status", "deleted"),
      supabase
        .from("moderation_log")
        .select("id, action, reason, created_at")
        .eq("target_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      getPremiumOffer(),
      getTranslations("admin.user"),
      getTranslations("admin.methods"),
      getTranslations("admin.reports.status"),
      getFormatter(),
    ]);
  const user = users.data?.[0];
  if (!user) notFound();

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" });
  const now = Date.now();
  const premiumActive = user.premium_until !== null && Date.parse(user.premium_until) > now;
  const suspended = user.suspended_until !== null && Date.parse(user.suspended_until) > now;
  const isAdmin = user.role === "admin";
  const counts = new Map<string, number>();
  for (const l of listings.data ?? []) counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
  const pending = request.data;

  return (
    <AdminShell active="users">
      <Link href="/admin/usuarios" className="-mb-2 text-sm font-semibold text-primary">
        {t("back")}
      </Link>

      <section className="flex flex-col gap-1.5">
        <h1 className="text-xl font-extrabold">{user.display_name}</h1>
        <p className="text-sm text-text-muted">@{user.username}</p>
        <UserBadges user={user} />
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-text-muted">{t("email")}</dt>
          <dd className="break-all">
            {user.email} {user.email_verified_at ? "✓" : `(${t("unverified")})`}
          </dd>
          <dt className="text-text-muted">{t("phone")}</dt>
          <dd>
            <a href={`tel:${user.phone}`} className="text-primary">
              {formatGqPhone(user.phone)}
            </a>
            {" · "}
            <a href={`https://wa.me/${user.phone.replace(/\D/g, "")}`} className="text-primary">
              WhatsApp
            </a>
          </dd>
          <dt className="text-text-muted">{t("since")}</dt>
          <dd>{date(user.created_at)}</dd>
        </dl>
        {user.status !== "banned" ? (
          <Link href={`/u/${user.username}`} className="text-sm font-semibold text-primary">
            {t("publicProfile")}
          </Link>
        ) : null}
      </section>

      <section
        id="premium"
        className="flex scroll-mt-4 flex-col gap-3 rounded-card border border-border p-4"
      >
        <h2 className="text-lg font-extrabold">{t("premiumTitle")}</h2>
        <p className="text-sm">
          {premiumActive && user.premium_until
            ? t("premiumUntil", { date: date(user.premium_until) })
            : t("premiumNone")}
        </p>
        {pending ? (
          <p className="rounded-control border-2 border-accent px-3.5 py-3 text-sm font-semibold">
            {t("pending", {
              months: pending.months,
              amount: formatXaf(pending.price_xaf),
              method: tMethods(pending.payment_method),
              date: date(pending.created_at),
            })}
          </p>
        ) : null}
        <PremiumActivateForm
          userId={user.id}
          username={user.username}
          premiumUntil={premiumActive ? user.premium_until : null}
          prices={offer.prices.map((p) => ({ ...p, label: t("months", { count: p.months }) }))}
          methods={MVP_PAYMENT_METHODS.map((m) => ({ value: m, label: tMethods(m) }))}
          defaults={{
            months: pending?.months ?? offer.prices[0]?.months ?? 1,
            method: pending?.payment_method ?? "cash_office",
          }}
          labels={{
            months: t("form.months"),
            amount: t("form.amount"),
            method: t("form.method"),
            reference: t("form.reference"),
            referenceHint: t("form.referenceHint"),
            notes: t("form.notes"),
            until: t("form.until", { date: "{date}" }),
            submit: premiumActive ? t("form.extend") : t("form.activate"),
            submitting: t("working"),
          }}
        />
        {(activations.data ?? []).length > 0 ? (
          <div className="flex flex-col gap-1">
            <h3 className="font-sans text-sm font-bold">{t("history")}</h3>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {(activations.data ?? []).map((a) => (
                <li key={a.id} className="py-2">
                  {t("activation", {
                    months: a.months,
                    amount: formatXaf(a.amount_xaf),
                    method: tMethods(a.method),
                    reference: a.reference,
                    from: date(a.period_start),
                    to: date(a.period_end),
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">{t("listingsTitle")}</h2>
        {counts.size === 0 ? (
          <p className="text-sm text-text-muted">{t("noListings")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {[...counts].map(([status, count]) => (
              <li key={status} className="rounded-full bg-surface px-3 py-1">
                {tStatus(status)}: <strong>{count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <p className="rounded-control bg-surface px-3.5 py-3 text-sm text-text-muted">
          {t("isAdmin")}
        </p>
      ) : (
        <section className="flex flex-col gap-4 rounded-card border border-border p-4">
          <h2 className="text-lg font-extrabold">{t("moderationTitle")}</h2>
          {suspended && user.suspended_until ? (
            <AdminActionForm
              action={suspendUser}
              pendingLabel={t("working")}
              buttons={[{ label: t("unsuspend"), variant: "secondary" }]}
            >
              <p className="text-sm">{t("suspendedUntil", { date: date(user.suspended_until) })}</p>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="days" value="0" />
              <TextAreaField id="unsuspend-reason" name="reason" label={t("reason")} />
            </AdminActionForm>
          ) : (
            <AdminActionForm
              action={suspendUser}
              pendingLabel={t("working")}
              buttons={[{ label: t("suspend"), variant: "secondary" }]}
            >
              <p className="text-sm text-text-muted">{t("suspendHint")}</p>
              <input type="hidden" name="userId" value={user.id} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="suspend-days" className="text-sm font-semibold">
                  {t("days")}
                </label>
                <select id="suspend-days" name="days" defaultValue="3" className={inputClasses()}>
                  {SUSPENSION_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {t("daysOption", { count: d })}
                    </option>
                  ))}
                </select>
              </div>
              <TextAreaField id="suspend-reason" name="reason" label={t("reason")} />
            </AdminActionForm>
          )}

          <div className="border-t border-border pt-4">
            {user.status === "banned" ? (
              <AdminActionForm
                action={setBanned}
                pendingLabel={t("working")}
                buttons={[{ label: t("unban"), variant: "secondary" }]}
              >
                <p className="text-sm">{t("bannedNow")}</p>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="username" value={user.username} />
                <input type="hidden" name="banned" value="0" />
                <TextAreaField id="unban-reason" name="reason" label={t("reason")} />
              </AdminActionForm>
            ) : (
              <AdminActionForm
                action={setBanned}
                pendingLabel={t("working")}
                buttons={[{ label: t("ban"), variant: "danger" }]}
              >
                <p className="text-sm text-text-muted">{t("banHint")}</p>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="username" value={user.username} />
                <input type="hidden" name="banned" value="1" />
                <TextAreaField id="ban-reason" name="reason" label={t("reason")} />
              </AdminActionForm>
            )}
          </div>
        </section>
      )}

      {(log.data ?? []).length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">{t("logTitle")}</h2>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(log.data ?? []).map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 py-2">
                <span className="font-semibold">
                  {t.has(`log.${entry.action}`) ? t(`log.${entry.action}`) : entry.action}
                </span>
                {entry.reason ? <span className="text-text-muted">{entry.reason}</span> : null}
                <span className="text-xs text-text-muted">
                  {format.dateTime(new Date(entry.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
