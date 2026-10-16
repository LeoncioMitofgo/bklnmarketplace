import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { FormSkeleton } from "@/components/auth/auth-header";
import { CloseIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSessionUser } from "@/lib/auth/session";
import { createDraft } from "@/lib/listings/actions";
import { getPlanUsage } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("listings.start");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function PublishStartPage() {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col gap-5 px-4 pt-1 pb-8">
      <Link
        href="/"
        aria-label={t("common.close")}
        className="-ml-1 flex size-11 items-center justify-center rounded-full"
      >
        <CloseIcon />
      </Link>
      <h1 className="text-2xl font-extrabold">{t("listings.start.title")}</h1>
      <p className="text-base leading-relaxed text-text-muted">{t("listings.start.intro")}</p>
      <Suspense fallback={<FormSkeleton />}>
        <StartContent />
      </Suspense>
    </div>
  );
}

async function StartContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/publicar");

  const supabase = await createClient();
  const [{ data: drafts }, usage, t] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(5),
    getPlanUsage(user.id),
    getTranslations("listings.start"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {usage.emailVerified ? null : (
        <div className="flex flex-col gap-3">
          <Alert tone="info">{t("verifyNotice")}</Alert>
          <ResendVerification />
        </div>
      )}

      {drafts && drafts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-extrabold">{t("drafts")}</h2>
          <ul className="divide-y divide-border rounded-card border border-border">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/publicar/${draft.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 px-4"
                >
                  <span className="truncate">{draft.title ?? t("untitled")}</span>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {t("continue")} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={createDraft}>
        <SubmitButton label={t("new")} pendingLabel={t("creating")} variant="accent" />
      </form>
    </div>
  );
}
