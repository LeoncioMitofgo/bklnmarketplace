import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { SignOutButton } from "@/components/account/sign-out-button";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { Avatar } from "@/components/profile/avatar";
import { PushSettings } from "@/components/push/push-settings";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { setShowWhatsapp } from "@/lib/chat/actions";
import { formatGqPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  return (
    <main className="flex flex-col gap-6 px-4 pt-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <Suspense fallback={<p className="text-text-muted">{t("loading")}</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

async function AccountContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta");

  const supabase = await createClient();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, premium_until")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profile_private")
      .select("phone, email_verified_at, show_whatsapp")
      .eq("user_id", user.id)
      .single(),
  ]);
  if (!profile || !priv) redirect("/entrar?next=/cuenta");

  const t = await getTranslations("account");
  const format = await getFormatter();
  const premiumUntil = profile.premium_until ? new Date(profile.premium_until) : null;
  const isPremium = premiumUntil !== null && premiumUntil > new Date();

  return (
    <>
      <section className="flex items-center gap-4">
        <Avatar name={profile.display_name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-lg font-bold">{profile.display_name}</p>
          <p className="text-sm text-text-muted">@{profile.username}</p>
          <div className="flex flex-wrap gap-x-4">
            <Link href="/mis-anuncios" className="text-sm font-semibold text-primary">
              {t("myListings")}
            </Link>
            <Link href="/favoritos" className="text-sm font-semibold text-primary">
              {t("favorites")}
            </Link>
            <Link href={`/u/${profile.username}`} className="text-sm font-semibold text-primary">
              {t("publicProfile")}
            </Link>
          </div>
        </div>
      </section>

      <dl className="flex flex-col divide-y divide-border rounded-card border border-border">
        <div className="flex flex-col gap-1 p-4">
          <dt className="text-xs text-text-muted">{t("plan")}</dt>
          <dd className="font-semibold">
            {isPremium && premiumUntil
              ? t("planPremium", { date: format.dateTime(premiumUntil, { dateStyle: "short" }) })
              : t("planNormal")}
          </dd>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <dt className="text-xs text-text-muted">{t("email")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {priv.email_verified_at ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <CheckIcon className="size-4" />
                {t("emailVerified")}
              </span>
            ) : (
              <span className="text-xs font-semibold text-danger">{t("emailPending")}</span>
            )}
          </dd>
          {priv.email_verified_at ? null : (
            <>
              <p className="text-sm leading-relaxed text-text-muted">{t("emailPendingNotice")}</p>
              <ResendVerification />
            </>
          )}
        </div>

        <div className="flex flex-col gap-1 p-4">
          <dt className="text-xs text-text-muted">{t("phone")}</dt>
          <dd>{formatGqPhone(priv.phone)}</dd>
          <p className="text-xs text-text-muted">{t("phonePrivate")}</p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <dt className="text-xs text-text-muted">{t("pushTitle")}</dt>
          <dd>
            <PushSettings />
          </dd>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <dt className="text-xs text-text-muted">{t("whatsappTitle")}</dt>
          <dd className="text-sm leading-relaxed">
            {priv.show_whatsapp ? t("whatsappOn") : t("whatsappOff")}
          </dd>
          <form action={setShowWhatsapp}>
            <input type="hidden" name="show" value={priv.show_whatsapp ? "0" : "1"} />
            <button
              type="submit"
              className={buttonClasses(priv.show_whatsapp ? "ghost" : "secondary", "min-h-11")}
            >
              {priv.show_whatsapp ? t("whatsappDisable") : t("whatsappEnable")}
            </button>
          </form>
        </div>
      </dl>

      <SignOutButton label={t("signOut")} />

      <nav className="flex flex-col divide-y divide-border border-t border-border text-[15px]">
        <Link href="/terminos" className="flex min-h-12 items-center justify-between">
          {t("terms")}
          <ChevronRightIcon className="size-5 text-text-muted" />
        </Link>
        <Link href="/privacidad" className="flex min-h-12 items-center justify-between">
          {t("privacy")}
          <ChevronRightIcon className="size-5 text-text-muted" />
        </Link>
        <Link
          href="/cuenta/borrar"
          prefetch={false}
          className="flex min-h-12 items-center justify-between text-danger"
        >
          {t("deleteAccount")}
          <ChevronRightIcon className="size-5" />
        </Link>
      </nav>
    </>
  );
}
