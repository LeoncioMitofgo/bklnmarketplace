import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { ReportForm } from "@/components/reports/report-form";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { getConversation } from "@/lib/chat/queries";
import { reportConversation } from "@/lib/reports/actions";
import { USER_REPORT_REASONS } from "@/lib/reports/types";

// Denunciar a la otra persona de una conversación (ALCANCE §4.5), con la opción de bloquearla.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("report.user");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function ReportUserPage({ params }: PageProps<"/mensajes/[id]/denunciar">) {
  return (
    <Suspense fallback={<div className="h-14 border-b border-border" aria-hidden="true" />}>
      <ReportUserContent params={params} />
    </Suspense>
  );
}

async function ReportUserContent({
  params,
}: Pick<PageProps<"/mensajes/[id]/denunciar">, "params">) {
  const { id } = await params;
  const here = `/mensajes/${id}/denunciar`;
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(here)}`);

  const [conversation, t, tChat, messages] = await Promise.all([
    getConversation(id),
    getTranslations("report.user"),
    getTranslations("chat"),
    pickMessages(["common", "report"]),
  ]);
  if (!conversation) notFound();

  const back = `/mensajes/${conversation.id}`;
  const name = conversation.other_display_name ?? tChat("deletedUser");

  return (
    <>
      <PageHeader backHref={back} backLabel={t("back")} title={t("title", { name })} />
      <main className="flex flex-col gap-5 px-4 pt-4 pb-10">
        {conversation.other_id === null ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm">{t("deleted")}</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-text-muted">{t("intro", { name })}</p>
            {conversation.blocked_by_me ? (
              <p className="text-sm leading-relaxed text-text-muted">{t("alreadyBlocked")}</p>
            ) : null}
            <NextIntlClientProvider messages={messages}>
              <ReportForm
                action={reportConversation}
                kind="user"
                reasons={USER_REPORT_REASONS}
                hidden={{ conversationId: conversation.id, returnTo: here }}
                backHref={back}
                name={name}
                canBlock={!conversation.blocked_by_me}
              />
            </NextIntlClientProvider>
          </>
        )}
      </main>
    </>
  );
}
