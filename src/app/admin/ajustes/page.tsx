import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminColumns, AdminShell, AdminSkeleton } from "@/components/admin/admin-shell";
import { AdminCheckbox, AdminInput, AdminTextArea } from "@/components/admin/fields";
import { requireAdmin } from "@/lib/admin/auth";
import {
  saveBannedTerms,
  saveOffice,
  savePlan,
  savePrice,
  saveReportThreshold,
} from "@/lib/admin/catalog-actions";
import { formatGqPhone } from "@/lib/format";

// Ajustes (ALCANCE §5.2, §5.3 y §5.5): límites de los planes, precios de Premium, datos de la
// oficina, términos prohibidos y umbral de denuncias. Todo vive en la base de datos, nunca en el código.

type Office = {
  name: string;
  address: string;
  hours: string;
  payments_whatsapp: string;
  agency_beneficiary: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return { title: t("title") };
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminSettings />
    </Suspense>
  );
}

async function AdminSettings() {
  const { supabase } = await requireAdmin("/admin/ajustes");
  const [plans, prices, settings, t] = await Promise.all([
    supabase
      .from("plans")
      .select("id, max_active_listings, max_photos, listing_duration_days")
      .in("id", ["normal", "premium"]),
    supabase
      .from("plan_prices")
      .select("months, price_xaf, is_active")
      .eq("plan_id", "premium")
      .order("months"),
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["office", "banned_terms", "report_hide_threshold"]),
    getTranslations("admin.settings"),
  ]);
  if (plans.error || prices.error || settings.error) throw new Error("admin_settings");
  const setting = (key: string) => settings.data.find((s) => s.key === key)?.value;
  const office = setting("office") as Office;
  const terms = (setting("banned_terms") as string[] | undefined) ?? [];
  const threshold = Number(setting("report_hide_threshold") ?? 3);

  return (
    <AdminShell active="settings">
      <h1 className="text-xl font-extrabold">{t("title")}</h1>

      {/* En pantallas anchas, las secciones de dos en dos. */}
      <AdminColumns>
        <Section title={t("plansTitle")} hint={t("plansHint")}>
          {(["normal", "premium"] as const).map((id) => {
            const plan = plans.data.find((p) => p.id === id);
            if (!plan) return null;
            return (
              <div key={id} className="flex flex-col gap-2">
                <h3 className="font-sans text-base font-bold">{t(`plan.${id}`)}</h3>
                <AdminActionForm
                  action={savePlan}
                  pendingLabel={t("working")}
                  buttons={[{ label: t("save"), variant: "secondary" }]}
                >
                  <input type="hidden" name="id" value={id} />
                  <div className="grid grid-cols-3 gap-2">
                    <AdminInput
                      id={`${id}-active`}
                      name="maxActiveListings"
                      label={t("maxActive")}
                      inputMode="numeric"
                      defaultValue={plan.max_active_listings}
                    />
                    <AdminInput
                      id={`${id}-photos`}
                      name="maxPhotos"
                      label={t("maxPhotos")}
                      inputMode="numeric"
                      defaultValue={plan.max_photos}
                    />
                    <AdminInput
                      id={`${id}-days`}
                      name="durationDays"
                      label={t("duration")}
                      inputMode="numeric"
                      defaultValue={plan.listing_duration_days}
                    />
                  </div>
                </AdminActionForm>
              </div>
            );
          })}
        </Section>

        <Section title={t("pricesTitle")} hint={t("pricesHint")}>
          {prices.data.map((price) => (
            <AdminActionForm
              key={price.months}
              action={savePrice}
              pendingLabel={t("working")}
              buttons={[{ label: t("save"), variant: "secondary" }]}
            >
              <input type="hidden" name="months" value={price.months} />
              <input type="hidden" name="hasActive" value="1" />
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <AdminInput
                  id={`price-${price.months}`}
                  name="price"
                  label={t("priceFor", { count: price.months })}
                  inputMode="numeric"
                  defaultValue={price.price_xaf}
                />
                <AdminCheckbox
                  id={`price-${price.months}-active`}
                  name="isActive"
                  label={t("offered")}
                  defaultChecked={price.is_active}
                />
              </div>
            </AdminActionForm>
          ))}
          <div className="rounded-card bg-surface p-4">
            <AdminActionForm
              action={savePrice}
              pendingLabel={t("working")}
              buttons={[{ label: t("addPrice"), variant: "secondary" }]}
            >
              <div className="grid grid-cols-2 gap-3">
                <AdminInput
                  id="price-new-months"
                  name="months"
                  label={t("months")}
                  inputMode="numeric"
                  required
                />
                <AdminInput
                  id="price-new-price"
                  name="price"
                  label={t("price")}
                  inputMode="numeric"
                  required
                />
              </div>
            </AdminActionForm>
          </div>
        </Section>

        <Section title={t("officeTitle")} hint={t("officeHint")}>
          <AdminActionForm
            action={saveOffice}
            pendingLabel={t("working")}
            buttons={[{ label: t("save"), variant: "secondary" }]}
          >
            <AdminInput
              id="office-name"
              name="name"
              label={t("officeName")}
              maxLength={120}
              defaultValue={office?.name}
            />
            <AdminInput
              id="office-address"
              name="address"
              label={t("officeAddress")}
              maxLength={120}
              defaultValue={office?.address}
            />
            <AdminInput
              id="office-hours"
              name="hours"
              label={t("officeHours")}
              maxLength={120}
              defaultValue={office?.hours}
            />
            <AdminInput
              id="office-whatsapp"
              name="paymentsWhatsapp"
              label={t("officeWhatsapp")}
              inputMode="tel"
              defaultValue={
                office?.payments_whatsapp ? formatGqPhone(office.payments_whatsapp) : ""
              }
            />
            <AdminInput
              id="office-beneficiary"
              name="agencyBeneficiary"
              label={t("officeBeneficiary")}
              maxLength={120}
              defaultValue={office?.agency_beneficiary}
            />
          </AdminActionForm>
        </Section>

        <Section title={t("termsTitle")} hint={t("termsHint")}>
          <AdminActionForm
            action={saveBannedTerms}
            pendingLabel={t("working")}
            buttons={[{ label: t("save"), variant: "secondary" }]}
          >
            <AdminTextArea
              id="banned-terms"
              name="terms"
              label={t("terms", { count: terms.length })}
              rows={10}
              defaultValue={terms.join("\n")}
            />
          </AdminActionForm>
        </Section>

        <Section title={t("reportsTitle")} hint={t("reportsHint")}>
          <AdminActionForm
            action={saveReportThreshold}
            pendingLabel={t("working")}
            buttons={[{ label: t("save"), variant: "secondary" }]}
          >
            <AdminInput
              id="report-threshold"
              name="threshold"
              label={t("threshold")}
              inputMode="numeric"
              defaultValue={threshold}
            />
          </AdminActionForm>
        </Section>
      </AdminColumns>
    </AdminShell>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border p-4">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="text-sm text-text-muted">{hint}</p>
      {children}
    </section>
  );
}
