// Compresión de fotos en el móvil antes de subir (ARQUITECTURA §5.2, D-019).
// Recomprimir con canvas elimina los metadatos EXIF (incluida la ubicación GPS).

import type { ImageFormat } from "./images";

export type Variant = { blob: Blob; width: number; height: number };
export type CompressedImage = { format: ImageFormat; large: Variant; thumb: Variant };

const LARGE_MAX_SIDE = 1600;
const THUMB_MAX_SIDE = 480;
const MAX_BYTES = 1024 * 1024; // Límite del bucket.
const QUALITIES = [0.75, 0.6, 0.45];

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

async function encode(
  source: ImageBitmap,
  maxSide: number,
  type: string,
  quality: number,
): Promise<Variant> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("encode_failed");
  return { blob, width, height };
}

async function encodeUnderLimit(source: ImageBitmap, maxSide: number, type: string) {
  let result: Variant | null = null;
  for (const quality of QUALITIES) {
    result = await encode(source, maxSide, type, quality);
    if (result.blob.size <= MAX_BYTES) return result;
  }
  if (!result) throw new Error("encode_failed");
  return result;
}

/**
 * Foto cuadrada (recorte centrado) de `side` px como mucho, para la foto de perfil.
 * WebP si el navegador sabe generarlo; si no (Safari), JPEG.
 */
export async function compressSquare(
  file: File,
  side: number,
): Promise<{ format: ImageFormat; blob: Blob }> {
  const bitmap = await decode(file);
  try {
    const crop = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(side, crop);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      size,
      size,
    );
    const toBlob = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
    const webp = await toBlob("image/webp");
    if (webp?.type === "image/webp") return { format: "webp", blob: webp };
    const jpg = await toBlob("image/jpeg");
    if (!jpg) throw new Error("encode_failed");
    return { format: "jpg", blob: jpg };
  } finally {
    bitmap.close();
  }
}

/**
 * Devuelve la foto grande (≤1600 px) y la miniatura (≤480 px).
 * WebP si el navegador sabe generarlo; si no (Safari), JPEG.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await decode(file);
  try {
    const large = await encodeUnderLimit(bitmap, LARGE_MAX_SIDE, "image/webp");
    if (large.blob.type === "image/webp") {
      const thumb = await encode(bitmap, THUMB_MAX_SIDE, "image/webp", 0.7);
      return { format: "webp", large, thumb };
    }
    return {
      format: "jpg",
      large: await encodeUnderLimit(bitmap, LARGE_MAX_SIDE, "image/jpeg"),
      thumb: await encode(bitmap, THUMB_MAX_SIDE, "image/jpeg", 0.7),
    };
  } finally {
    bitmap.close();
  }
}
