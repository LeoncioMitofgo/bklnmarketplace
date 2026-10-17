import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/nav/page-header";
import { ReportForm } from "@/components/reports/report-form";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { listingPath, parseListingCode } from "@/lib/listings/paths";
import { reportListing } from "@/lib/reports/actions";
import { getReportableListing } from "@/lib/reports/queries";
import { LISTING_REPORT_REASONS } from "@/lib/reports/types";

// Denunciar un anuncio (ALCANCE §4.2 y §5.5). Hace falta sesión: sin ella, a entrar y de vuelta aquí.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("report.listing");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function ReportListingPage({ params }: PageProps<"/anuncio/[slug]/denunciar">) {
  return (
    <Suspense fallback={<div className="h-14 border-b border-border" aria-hidden="true" />}>
      <ReportListingContent params={params} />
    </Suspense>
  );
}

async function ReportListingContent({
  params,
}: Pick<PageProps<"/anuncio/[slug]/denunciar">, "params">) {
  const { slug } = await params;
  const code = parseListingCode(slug);
  const [listing, catalog, user] = await Promise.all([
    code ? getReportableListing(code) : null,
    getCatalog(),
    getSessionUser(),
  ]);
  if (!listing) notFound();

  const city = catalog.cities.find((c) => c.id === listing.city_id)?.name ?? null;
  const back = listingPath(listing.code, listing.title, city);
  const here = `${back}/denunciar`;
  if (!user) redirect(`/entrar?next=${encodeURIComponent(here)}`);

  const [t, messages] = await Promise.all([
    getTranslations("report.listing"),
    pickMessages(["common", "report"]),
  ]);

  return (
    <>
      <PageHeader backHref={back} backLabel={t("back")} title={t("title")} />
      <main className="flex flex-col gap-5 px-4 pt-4 pb-10">
        {listing.user_id === user.id ? (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm">{t("own")}</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-text-muted">
              {t("intro", { title: listing.title ?? "" })}
            </p>
            <NextIntlClientProvider messages={messages}>
              <ReportForm
                action={reportListing}
                kind="listing"
                reasons={LISTING_REPORT_REASONS}
                hidden={{ listingId: listing.id, returnTo: here }}
                backHref={back}
              />
            </NextIntlClientProvider>
          </>
        )}
      </main>
    </>
  );
}
