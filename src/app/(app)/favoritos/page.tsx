import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { getMyFavorites } from "@/lib/favorites/queries";
import { imageUrl } from "@/lib/listings/images";
import { listingPath } from "@/lib/listings/paths";
import { priceLabel } from "@/lib/listings/price";

// Favoritos (ALCANCE §4.7): si un anuncio guardado se vende, se pausa o caduca, se indica.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog.favorites");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function FavoritesPage() {
  const t = await getTranslations("catalog.favorites");
  return (
    <main className="flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <Suspense fallback={<p className="text-text-muted">{t("loading")}</p>}>
        <FavoritesContent />
      </Suspense>
    </main>
  );
}

async function FavoritesContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/favoritos");

  const [favorites, catalog, t, tPrice] = await Promise.all([
    getMyFavorites(),
    getCatalog(),
    getTranslations("catalog.favorites"),
    getTranslations("price"),
  ]);

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card bg-surface px-4 py-8 text-center">
        <p className="text-sm text-text-muted">{t("empty")}</p>
        <Link href="/" className={buttonClasses("primary", "w-auto")}>
          {t("explore")}
        </Link>
      </div>
    );
  }

  const labels = { save: t("save"), remove: t("remove") };

  return (
    <ul className="flex flex-col divide-y divide-border">
      {favorites.map((favorite) => {
        const city = catalog.cities.find((c) => c.id === favorite.city_id)?.name ?? null;
        const category = catalog.categories.find((c) => c.id === favorite.category_id);
        const isPublic = favorite.availability === "active" || favorite.availability === "sold";
        const body = (
          <>
            <div className="relative size-20 shrink-0 overflow-hidden rounded-control bg-placeholder">
              {favorite.cover_path ? (
                // biome-ignore lint/performance/noImgElement: miniatura ya comprimida (D-019).
                <img
                  src={imageUrl(favorite.cover_path, favorite.cover_format ?? "webp", "thumb")}
                  alt=""
                  loading="lazy"
                  className={`size-full object-cover ${favorite.availability === "active" ? "" : "opacity-60"}`}
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              {favorite.title !== null ? (
                <p className="font-display text-base font-extrabold text-primary">
                  {priceLabel(favorite.price_xaf, category, tPrice)}
                </p>
              ) : null}
              <p className="line-clamp-2 text-[15px] leading-snug">
                {favorite.title ?? t("unavailableTitle")}
              </p>
              {favorite.availability !== "active" ? (
                <p className="text-xs font-semibold text-danger">
                  {t(`status.${favorite.availability}`)}
                </p>
              ) : null}
            </div>
          </>
        );
        return (
          <li key={favorite.listing_id} className="flex items-start gap-2 py-3">
            {isPublic ? (
              <Link
                href={listingPath(favorite.code, favorite.title, city)}
                className="flex min-w-0 flex-1 gap-3"
              >
                {body}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 gap-3">{body}</div>
            )}
            <FavoriteButton
              listingId={favorite.listing_id}
              returnTo="/favoritos"
              saved
              labels={labels}
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
            />
          </li>
        );
      })}
    </ul>
  );
}
