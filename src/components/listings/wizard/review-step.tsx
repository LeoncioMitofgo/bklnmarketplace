"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ResendVerification } from "@/components/account/resend-verification";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { attributesFor, type Catalog } from "@/lib/catalog-types";
import { formatXaf } from "@/lib/format";
import { publishListing } from "@/lib/listings/actions";
import { attributeText } from "@/lib/listings/attributes";
import { imageUrl } from "@/lib/listings/images";
import type { EditableImage, EditableListing } from "@/lib/listings/queries";
import type { StepName } from "./listing-wizard";

type ReviewStepProps = {
  listing: EditableListing;
  images: EditableImage[];
  catalog: Catalog;
  emailVerified: boolean;
  onEdit: (step: StepName) => void;
};

export function ReviewStep({ listing, images, catalog, emailVerified, onEdit }: ReviewStepProps) {
  const t = useTranslations("listings.review");
  const tWizard = useTranslations("listings.wizard");
  const tDetails = useTranslations("listings.details");
  const tPrice = useTranslations("price");
  const tErrors = useTranslations("listings.errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const category = catalog.categories.find((c) => c.id === listing.category_id);
  const root = catalog.categories.find((c) => c.id === category?.parent_id);
  const city = catalog.cities.find((c) => c.id === listing.city_id);
  const cover = [...images].sort((a, b) => a.position - b.position)[0];
  const defs = attributesFor(catalog, listing.category_id);
  const isDraft = listing.status === "draft";

  const price =
    listing.price_xaf === null
      ? t("noPrice")
      : category?.price_period === "month"
        ? tPrice("perMonth", { price: formatXaf(listing.price_xaf) })
        : formatXaf(listing.price_xaf);

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishListing(listing.id).catch(() => ({
        ok: false as const,
        error: "offline",
      }));
      if (result && !result.ok) setError(tErrors(result.error));
    });
  }

  const editLink = (step: StepName) => (
    <button
      type="button"
      onClick={() => onEdit(step)}
      className="min-h-11 text-sm font-semibold text-primary"
    >
      {tWizard(`steps.${step}`)} ›
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-xl font-extrabold">{t("title")}</h1>

      <article className="overflow-hidden rounded-card border border-border">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: foto ya comprimida, sin optimizador (D-019).
          <img
            src={imageUrl(cover.storage_path, cover.format, "large")}
            alt=""
            width={cover.width}
            height={cover.height}
            className="aspect-[4/3] w-full bg-placeholder object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-2 p-4">
          <p className="font-display text-2xl font-extrabold text-primary">{price}</p>
          {listing.is_negotiable && listing.price_xaf !== null ? (
            <p className="text-xs font-semibold text-text-muted">{tPrice("negotiable")}</p>
          ) : null}
          <p className="text-lg leading-snug">{listing.title}</p>
          <p className="text-sm text-text-muted">
            {[root?.name, category?.name].filter(Boolean).join(" › ")}
            {listing.condition ? ` · ${tDetails(listing.condition)}` : ""}
          </p>
          <p className="text-sm text-text-muted">
            {[listing.neighborhood, city?.name].filter(Boolean).join(", ")}
          </p>
          {defs.some((d) => listing.attributes[d.key] !== undefined) ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
              {defs
                .filter((d) => listing.attributes[d.key] !== undefined)
                .map((d) => (
                  <div key={d.key}>
                    <dt className="text-xs text-text-muted">{d.label}</dt>
                    <dd>
                      {attributeText(d, listing.attributes[d.key], { yes: t("yes"), no: t("no") })}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : null}
          <p className="whitespace-pre-line border-t border-border pt-3 text-sm leading-relaxed">
            {listing.description}
          </p>
        </div>
      </article>

      <div className="flex flex-wrap gap-x-4">
        {editLink("photos")}
        {editLink("category")}
        {editLink("details")}
      </div>

      <p className="text-[13px] text-text-muted">{t("safety")}</p>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {isDraft ? (
          <>
            {emailVerified ? null : (
              <>
                <Alert tone="info">{t("verifyNotice")}</Alert>
                <ResendVerification />
              </>
            )}
            <button
              type="button"
              onClick={publish}
              disabled={pending || !emailVerified}
              className={buttonClasses("accent")}
            >
              {pending ? t("publishing") : t("publish")}
            </button>
          </>
        ) : (
          <Link href="/mis-anuncios" className={buttonClasses("primary")}>
            {t("done")}
          </Link>
        )}
      </div>
    </div>
  );
}
