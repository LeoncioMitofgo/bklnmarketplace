"use client";

import { useTranslations } from "next-intl";
import { PhotoButton } from "@/components/account/photo-button";
import { useImageUpload } from "@/components/account/use-image-upload";
import { Alert } from "@/components/ui/alert";
import { compressSquare, compressToMax } from "@/lib/listings/compress";
import { profileMediaUrl } from "@/lib/profile-media";
import { prepareStoreImage, removeStoreImage, saveStoreImage } from "@/lib/stores/actions";
import type { StoreMediaKind } from "@/lib/stores/slug";

/** Logo: cuadrado de 400 px. Portada: 1200 px de lado largo, se ve recortada a 3:1. */
const LOGO_SIDE = 400;
const COVER_MAX = 1200;

export function StoreImagePicker({ kind, path }: { kind: StoreMediaKind; path: string | null }) {
  const t = useTranslations("store.images");
  const { preview, progress, error, busy, upload } = useImageUpload({
    compress: (file) =>
      kind === "logo" ? compressSquare(file, LOGO_SIDE) : compressToMax(file, COVER_MAX),
    prepare: (format) => prepareStoreImage(kind, format),
    save: (newPath) => saveStoreImage(kind, newPath),
  });
  const src = preview ?? (path ? profileMediaUrl(path) : null);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t(`${kind}.label`)}</p>
      <div className={kind === "logo" ? "flex items-center gap-4" : "flex flex-col gap-2"}>
        {src ? (
          // biome-ignore lint/performance/noImgElement: fotos ya reducidas en el móvil (ARQUITECTURA §5.2).
          <img
            src={src}
            alt=""
            className={
              kind === "logo"
                ? "size-20 shrink-0 rounded-card bg-surface object-cover"
                : "aspect-[3/1] w-full rounded-card bg-surface object-cover"
            }
          />
        ) : (
          <span
            aria-hidden="true"
            className={
              kind === "logo"
                ? "size-20 shrink-0 rounded-card bg-surface"
                : "aspect-[3/1] w-full rounded-card bg-surface"
            }
          />
        )}
        <div className="flex flex-wrap items-center gap-x-4">
          <PhotoButton
            label={path ? t("change") : t("add")}
            busy={busy}
            progress={progress}
            labels={{
              preparing: t("preparing"),
              uploading: (percent) => t("uploading", { percent }),
            }}
            onFile={upload}
          />
          {path && !busy ? (
            <form action={removeStoreImage}>
              <input type="hidden" name="kind" value={kind} />
              <button type="submit" className="min-h-11 text-sm text-text-muted">
                {t("remove")}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-text-muted">{t(`${kind}.hint`)}</p>
      {error ? <Alert tone="error">{t(`errors.${error}`)}</Alert> : null}
    </div>
  );
}
