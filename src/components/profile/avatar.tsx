import { profileMediaUrl } from "@/lib/profile-media";

const SIZES = { sm: "size-10 text-base", md: "size-14 text-xl", lg: "size-20 text-3xl" } as const;
const PIXELS = { sm: 40, md: 56, lg: 80 } as const;

/**
 * Foto de perfil, o la inicial si no hay foto. `src` sirve para enseñar la que se acaba de elegir
 * antes de que termine de subirse. La foto es decorativa: el nombre siempre aparece al lado.
 */
export function Avatar({
  name,
  path,
  src,
  size = "md",
}: {
  name: string;
  path?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
}) {
  const url = src ?? (path ? profileMediaUrl(path) : null);
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: fotos ya reducidas en el móvil (ARQUITECTURA §5.2).
      <img
        src={url}
        alt=""
        width={PIXELS[size]}
        height={PIXELS[size]}
        loading="lazy"
        className={`${SIZES[size]} shrink-0 rounded-full bg-surface object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-surface font-display font-extrabold text-primary`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
