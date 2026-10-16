import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { CheckIcon } from "@/components/icons";
import { Avatar } from "@/components/profile/avatar";
import { buttonClasses } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
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
      .select("phone, email_verified_at")
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
          <Link href={`/u/${profile.username}`} className="text-sm font-semibold text-primary">
            {t("publicProfile")}
          </Link>
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
      </dl>

      <form action={signOut}>
        <button type="submit" className={buttonClasses("ghost")}>
          {t("signOut")}
        </button>
      </form>
    </>
  );
}
