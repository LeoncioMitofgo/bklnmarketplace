import { imageUrl } from "@/lib/listings/images";

// Galería de la ficha (wireframe 04): carrusel con scroll-snap y contador en cada foto, sin JavaScript.
// Cada foto tiene dos tamaños (D-019): el navegador elige con srcset; las siguientes cargan al deslizar.

type GalleryImage = { storage_path: string; format: string; width: number; height: number };

const THUMB_MAX = 480;

export function Gallery({
  images,
  alt,
  counter,
}: {
  images: GalleryImage[];
  alt: string;
  counter: (current: number, total: number) => string;
}) {
  if (images.length === 0) return <div className="aspect-[4/3] bg-placeholder" />;

  return (
    <ul className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-surface [scrollbar-width:none]">
      {images.map((image, index) => {
        const scale = Math.min(1, THUMB_MAX / Math.max(image.width, image.height));
        const thumbWidth = Math.round(image.width * scale);
        const large = imageUrl(image.storage_path, image.format, "large");
        const thumb = imageUrl(image.storage_path, image.format, "thumb");
        return (
          <li key={image.storage_path} className="relative h-full w-full shrink-0 snap-center">
            {/* biome-ignore lint/performance/noImgElement: fotos ya comprimidas en el móvil, sin optimizador (D-019). */}
            <img
              src={large}
              srcSet={`${thumb} ${thumbWidth}w, ${large} ${image.width}w`}
              sizes="(min-width: 448px) 448px, 100vw"
              width={image.width}
              height={image.height}
              alt={index === 0 ? alt : ""}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              className="size-full object-contain"
            />
            {images.length > 1 ? (
              <span className="absolute bottom-3 right-3 rounded-full bg-text/70 px-2.5 py-1 text-xs font-semibold text-white">
                {counter(index + 1, images.length)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
