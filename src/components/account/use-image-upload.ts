"use client";

import { useEffect, useState } from "react";
import type { ImageFormat } from "@/lib/listings/images";
import { uploadWithProgress } from "@/lib/listings/upload";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Subida de una foto suelta (perfil, logo o portada): se comprime en el móvil, se sube a una URL
 * firmada con progreso y después se guarda. Mientras tanto se enseña la vista previa.
 * `error` es una clave: offline, photo_unreadable, rate_limited o unexpected.
 */
export function useImageUpload({
  compress,
  prepare,
  save,
}: {
  compress: (file: File) => Promise<{ format: ImageFormat; blob: Blob }>;
  prepare: (
    format: ImageFormat,
  ) => Promise<({ ok: true } & { path: string; signedUrl: string }) | { ok: false; error: string }>;
  save: (path: string) => Promise<Result>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const compressed = await compress(file).catch(() => {
        throw new Error("photo_unreadable");
      });
      setPreview(URL.createObjectURL(compressed.blob));
      const prepared = await prepare(compressed.format);
      if (!prepared.ok) throw new Error(prepared.error);
      await uploadWithProgress(prepared.signedUrl, compressed.blob, setProgress);
      const saved = await save(prepared.path);
      if (!saved.ok) throw new Error(saved.error);
    } catch (cause) {
      const key = (cause as Error).message;
      setError(
        !navigator.onLine || key === "network" || key === "timeout"
          ? "offline"
          : ["photo_unreadable", "rate_limited"].includes(key)
            ? key
            : "unexpected",
      );
      setPreview(null);
    } finally {
      setProgress(null);
    }
  }

  return { preview, progress, error, busy: progress !== null, upload };
}
