import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Catalog } from "@/lib/catalog-types";
import { imageUrl } from "@/lib/listings/images";
import { listingPath } from "@/lib/listings/paths";
import { priceLabel } from "@/lib/listings/price";
import type { ListingCardData } from "@/lib/listings/public";

// Tarjetas de anuncio (IDENTIDAD §6): foto 4:3 en rejilla y carrusel, miniatura a la izquierda en listas.
// `now` lo pasa quien pinta la lista, para que todas las tarjetas usen la misma hora.

type CardProps = { listing: ListingCardData; catalog: Catalog; now: number };

async function cardData({ listing, catalog, now }: CardProps) {
  const [t, tPrice, format] = await Promise.all([
    getTranslations("catalog.card"),
    getTranslations("price"),
    getFormatter(),
  ]);
  const city = catalog.cities.find((c) => c.id === listing.city_id)?.name ?? null;
  const category = catalog.categories.find((c) => c.id === listing.category_id);
  const date = listing.status === "sold" ? listing.sold_at : listing.published_at;
  return {
    t,
    href: listingPath(listing.code, listing.title, city),
    price: priceLabel(listing.price_xaf, category, tPrice),
    place: listing.neighborhood || city,
    time: date ? format.relativeTime(new Date(date), { now, style: "short" }) : null,
    cover: listing.cover_path
      ? imageUrl(listing.cover_path, listing.cover_format ?? "webp", "thumb")
      : null,
  };
}

function Badge({ tone, children }: { tone: "premium" | "sold"; children: React.ReactNode }) {
  const tones = { premium: "bg-accent text-text", sold: "bg-text text-white" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    // biome-ignore lint/performance/noImgElement: miniatura ya comprimida en el móvil (D-019).
    <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
  ) : null;
}

/** Tarjeta vertical: rejillas y carrusel de destacados. En el perfil de un Premium, sin insignia repetida. */
export async function ListingCard(props: CardProps & { hidePremium?: boolean }) {
  const { listing } = props;
  const { t, href, price, place, time, cover } = await cardData(props);
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-placeholder">
        <Cover src={cover} />
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.status === "sold" ? <Badge tone="sold">{t("sold")}</Badge> : null}
          {listing.seller_is_premium && !props.hidePremium ? (
            <Badge tone="premium">{t("premium")}</Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-1 font-display text-[15px] font-extrabold text-primary">{price}</p>
      <p className="line-clamp-2 text-sm leading-snug">{listing.title}</p>
      <p className="truncate text-xs text-text-muted">
        {[place, time].filter(Boolean).join(" · ")}
      </p>
    </Link>
  );
}

/** Fila con miniatura a la izquierda: resultados de búsqueda y recientes. */
export async function ListingRow(props: CardProps & { id?: string }) {
  const { listing } = props;
  const { t, href, price, place, time, cover } = await cardData(props);
  const tDetails = await getTranslations("listings.details");
  const condition = listing.condition ? tDetails(listing.condition) : null;
  return (
    <Link id={props.id} href={href} className="flex scroll-mt-4 gap-3 py-3">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-control bg-placeholder">
        <Cover src={cover} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2 font-display text-base font-extrabold text-primary">
          {price}
          {listing.is_negotiable && listing.price_xaf !== null ? (
            <span className="font-sans text-xs font-normal text-text-muted">{t("negotiable")}</span>
          ) : null}
        </p>
        <p className="line-clamp-2 text-[15px] leading-snug">{listing.title}</p>
        <p className="truncate text-xs text-text-muted">
          {[condition, place, time].filter(Boolean).join(" · ")}
        </p>
        {listing.seller_is_premium ? (
          <span className="mt-1 self-start">
            <Badge tone="premium">{t("premium")}</Badge>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
