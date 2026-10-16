// Fotos de anuncios en el bucket público "listing-images" (servidas por la CDN de Supabase).

export const LISTING_IMAGES_BUCKET = "listing-images";

export type ImageFormat = "webp" | "jpg";

export function imageFileName(
  base: string,
  variant: "large" | "thumb",
  format: ImageFormat,
): string {
  return `${base}-${variant === "large" ? "l" : "t"}.${format}`;
}

export function imageUrl(base: string, format: string, variant: "large" | "thumb"): string {
  const file = imageFileName(base, variant, format as ImageFormat);
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/${file}`;
}
