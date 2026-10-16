"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import type { Catalog } from "@/lib/catalog-types";
import type { EditableImage, EditableListing } from "@/lib/listings/queries";
import { CategoryStep } from "./category-step";
import { DetailsStep } from "./details-step";
import { PhotosStep } from "./photos-step";
import { ReviewStep } from "./review-step";

const STEPS = ["photos", "category", "details", "review"] as const;
export type StepName = (typeof STEPS)[number];

type ListingWizardProps = {
  listing: EditableListing;
  images: EditableImage[];
  catalog: Catalog;
  maxPhotos: number;
  emailVerified: boolean;
};

/** Primer paso pendiente: así un borrador retomado continúa donde se quedó. */
function firstPendingStep(listing: EditableListing, images: EditableImage[]): number {
  if (listing.status !== "draft") return 3;
  if (images.length === 0) return 0;
  if (listing.category_id === null) return 1;
  if (listing.title === null) return 2;
  return 3;
}

export function ListingWizard(props: ListingWizardProps) {
  const t = useTranslations("listings.wizard");
  const [listing, setListing] = useState(props.listing);
  const [images, setImages] = useState(props.images);
  const [step, setStep] = useState(() => firstPendingStep(props.listing, props.images));

  const goTo = (name: StepName) => setStep(STEPS.indexOf(name));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const isDraft = listing.status === "draft";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-col gap-2.5 border-b border-border px-3 pt-1 pb-3">
        <div className="flex items-center justify-between">
          <Link
            href="/mis-anuncios"
            aria-label={t("close")}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <CloseIcon />
          </Link>
          <p className="text-base font-bold">{isDraft ? t("titleNew") : t("titleEdit")}</p>
          <span className="w-11" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5 px-1">
          <p className="text-[13px] text-text-muted">
            {t("step", {
              current: step + 1,
              total: STEPS.length,
              name: t(`steps.${STEPS[step]}`),
            })}
          </p>
          <div
            className="h-1.5 rounded-full bg-surface"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
          >
            <div
              className="h-1.5 rounded-full bg-primary transition-[width]"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-4">
        {STEPS[step] === "photos" ? (
          <PhotosStep
            listingId={listing.id}
            images={images}
            maxPhotos={props.maxPhotos}
            onImagesChange={setImages}
            onNext={next}
          />
        ) : null}
        {STEPS[step] === "category" ? (
          <CategoryStep
            listingId={listing.id}
            categories={props.catalog.categories}
            selectedId={listing.category_id}
            onSelected={(categoryId) => {
              setListing((l) => ({ ...l, category_id: categoryId }));
              next();
            }}
            onBack={back}
          />
        ) : null}
        {STEPS[step] === "details" ? (
          <DetailsStep
            listing={listing}
            catalog={props.catalog}
            onSaved={(changes) => {
              setListing((l) => ({ ...l, ...changes }));
              next();
            }}
            onBack={back}
          />
        ) : null}
        {STEPS[step] === "review" ? (
          <ReviewStep
            listing={listing}
            images={images}
            catalog={props.catalog}
            emailVerified={props.emailVerified}
            onEdit={goTo}
          />
        ) : null}
      </div>
    </div>
  );
}
