import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmailForm, PasswordForm, PhoneForm } from "@/components/account/access-forms";
import { ChevronLeftIcon } from "@/components/icons";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { formatGqPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Email, teléfono y contraseña (ALCANCE §4.3 y §5.7). Son los datos para entrar: cada cambio pide
// la contraseña actual.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.access");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccessPage() {
  const t = await getTranslations("settings.access");
  return (
    <main className="flex flex-col gap-6 px-4 pt-4">
      <Link
        href="/cuenta"
        className="-ml-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary"
      >
        <ChevronLeftIcon className="size-5" />
        {t("back")}
      </Link>
      <div className="-mt-3 flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-text-muted">{t("intro")}</p>
      </div>
      <Suspense fallback={<div className="h-96 rounded-card bg-surface" aria-hidden="true" />}>
        <AccessContent />
      </Suspense>
    </main>
  );
}

async function AccessContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/acceso");

  const supabase = await createClient();
  const [{ data: priv }, t, messages] = await Promise.all([
    supabase.from("profile_private").select("phone").eq("user_id", user.id).single(),
    getTranslations("settings.access"),
    pickMessages(["common", "auth.errors", "auth.messages", "settings"]),
  ]);
  if (!priv) redirect("/entrar?next=/cuenta/acceso");

  return (
    <NextIntlClientProvider messages={messages}>
      <Section title={t("emailTitle")}>
        <EmailForm current={user.email} />
      </Section>
      <Section title={t("phoneTitle")}>
        <PhoneForm current={formatGqPhone(priv.phone)} />
      </Section>
      <Section title={t("passwordTitle")}>
        <PasswordForm />
      </Section>
    </NextIntlClientProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border p-4">
      <h2 className="font-sans text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}
