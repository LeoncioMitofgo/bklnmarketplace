import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Catalog } from "@/lib/catalog-types";
import { imageUrl } from "@/lib/listings/images";
import { listingPath } from "@/lib/listings/paths";
import { priceLabel } from "@/lib/listings/price";

export type PinnedListing = {
  code: string | null;
  title: string | null;
  status: string | null;
  priceXaf: number | null;
  categoryId: number | null;
  cityId: number | null;
  coverPath: string | null;
  coverFormat: string | null;
};

/** El anuncio fijado arriba de la conversación, con su estado actual (ALCANCE §4.5). */
export async function ListingPin({
  listing,
  catalog,
}: {
  listing: PinnedListing;
  catalog: Catalog;
}) {
  const [t, tPrice] = await Promise.all([getTranslations("chat"), getTranslations("price")]);
  const city = catalog.cities.find((c) => c.id === listing.cityId)?.name ?? null;
  const category = catalog.categories.find((c) => c.id === listing.categoryId);
  const visible = listing.title !== null && listing.code !== null;
  const isPublic = visible && (listing.status === "active" || listing.status === "sold");
  const statusText = listing.status ? t(`listingStatus.${listing.status}`) : t("deletedListing");

  const body = (
    <>
      <div className="size-12 shrink-0 overflow-hidden rounded-control bg-placeholder">
        {listing.coverPath ? (
          // biome-ignore lint/performance/noImgElement: miniatura ya comprimida (D-019).
          <img
            src={imageUrl(listing.coverPath, listing.coverFormat ?? "webp", "thumb")}
            alt=""
            className="size-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-sm">{visible ? listing.title : t("unavailableListing")}</p>
        <p className="flex items-center gap-2 text-sm">
          {visible ? (
            <span className="font-display font-extrabold text-primary">
              {priceLabel(listing.priceXaf, category, tPrice)}
            </span>
          ) : null}
          <span
            className={`text-xs font-semibold ${listing.status === "active" ? "text-success" : "text-text-muted"}`}
          >
            {statusText}
          </span>
        </p>
      </div>
    </>
  );

  return isPublic && listing.code ? (
    <Link
      href={listingPath(listing.code, listing.title, city)}
      className="flex items-center gap-3 border-b border-border px-4 py-2"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">{body}</div>
  );
}
