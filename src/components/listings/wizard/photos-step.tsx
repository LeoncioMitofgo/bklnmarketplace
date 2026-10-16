"use client";

import { useTranslations } from "next-intl";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import {
  confirmImageUpload,
  deleteListingImage,
  prepareImageUpload,
  setCoverImage,
} from "@/lib/listings/actions";
import { compressImage } from "@/lib/listings/compress";
import { imageUrl } from "@/lib/listings/images";
import type { EditableImage } from "@/lib/listings/queries";
import { uploadWithProgress } from "@/lib/listings/upload";

type Upload = {
  key: string;
  file: File;
  status: "compressing" | "uploading" | "error";
  progress: number;
  preview?: string;
  error?: string;
};

type PhotosStepProps = {
  listingId: string;
  images: EditableImage[];
  maxPhotos: number;
  onImagesChange: Dispatch<SetStateAction<EditableImage[]>>;
  onNext: () => void;
};

export function PhotosStep({
  listingId,
  images,
  maxPhotos,
  onImagesChange,
  onNext,
}: PhotosStepProps) {
  const t = useTranslations("listings.photos");
  const tWizard = useTranslations("listings.wizard");
  const tErrors = useTranslations("listings.errors");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const sorted = [...images].sort((a, b) => a.position - b.position);
  const busy = uploads.filter((u) => u.status !== "error").length;
  const free = maxPhotos - images.length - busy;

  const update = (key: string, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  async function process(upload: Upload) {
    update(upload.key, { status: "compressing", progress: 0, error: undefined });

    let compressed: Awaited<ReturnType<typeof compressImage>>;
    try {
      compressed = await compressImage(upload.file);
    } catch {
      update(upload.key, { status: "error", error: "photo_unreadable" });
      return;
    }
    if (!upload.preview) {
      const preview = URL.createObjectURL(compressed.thumb.blob);
      previews.current.add(preview);
      update(upload.key, { preview });
    }

    try {
      const prepared = await prepareImageUpload(listingId, compressed.format);
      if (!prepared.ok) {
        update(upload.key, { status: "error", error: prepared.error });
        return;
      }
      update(upload.key, { status: "uploading" });
      // La foto grande pesa ~85 % del total; la miniatura, el resto.
      await uploadWithProgress(prepared.data.uploads.large, compressed.large.blob, (f) =>
        update(upload.key, { progress: f * 0.85 }),
      );
      await uploadWithProgress(prepared.data.uploads.thumb, compressed.thumb.blob, (f) =>
        update(upload.key, { progress: 0.85 + f * 0.15 }),
      );
      const saved = await confirmImageUpload({
        listingId,
        imageId: prepared.data.imageId,
        format: compressed.format,
        width: compressed.large.width,
        height: compressed.large.height,
      });
      if (!saved.ok) {
        update(upload.key, { status: "error", error: saved.error });
        return;
      }
      onImagesChange((list) => [...list, saved.data]);
      setUploads((list) => list.filter((u) => u.key !== upload.key));
    } catch {
      update(upload.key, { status: "error", error: "photo_upload_failed" });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, Math.max(free, 0));
    setNotice(files.length > chosen.length ? t("tooMany", { max: maxPhotos }) : null);
    const added: Upload[] = chosen.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "compressing",
      progress: 0,
    }));
    setUploads((list) => [...list, ...added]);
    if (inputRef.current) inputRef.current.value = "";
    // Una a una: menos memoria en móviles modestos y la conexión no se reparte.
    for (const upload of added) await process(upload);
  }

  async function remove(image: EditableImage) {
    const result = await deleteListingImage(image.id).catch(() => null);
    if (result?.ok) onImagesChange((list) => list.filter((i) => i.id !== image.id));
    else setNotice(tErrors(result?.error ?? "offline"));
  }

  async function makeCover(image: EditableImage) {
    const cover = sorted[0];
    const result = await setCoverImage(image.id).catch(() => null);
    if (!result?.ok) {
      setNotice(tErrors(result?.error ?? "offline"));
      return;
    }
    onImagesChange((list) =>
      list.map((i) => {
        if (i.id === image.id) return { ...i, position: cover.position };
        if (i.id === cover.id) return { ...i, position: image.position };
        return i;
      }),
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold">{t("title")}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t("hint", { max: maxPhotos })}</p>
      </div>

      {notice ? <Alert tone="info">{notice}</Alert> : null}

      <ul className="grid grid-cols-3 gap-2">
        {sorted.map((image, index) => (
          <li
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-control bg-placeholder"
          >
            {/* biome-ignore lint/performance/noImgElement: miniaturas ya comprimidas, sin optimizador (D-019). */}
            <img
              src={imageUrl(image.storage_path, image.format, "thumb")}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
            {index === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-text px-2 py-0.5 text-[10px] font-bold text-white">
                {t("cover")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(image)}
                className="absolute inset-x-1 bottom-1 min-h-8 rounded-full bg-bg/90 px-1 text-[11px] font-semibold text-primary"
              >
                {t("makeCover")}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(image)}
              aria-label={t("remove")}
              className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-bg text-text"
            >
              <CloseIcon className="size-4" />
            </button>
          </li>
        ))}

        {uploads.map((upload) => (
          <li
            key={upload.key}
            className="relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-control bg-surface p-2 text-center"
          >
            {upload.preview ? (
              // biome-ignore lint/performance/noImgElement: vista previa local (blob:).
              <img
                src={upload.preview}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-40"
              />
            ) : null}
            {upload.status === "error" ? (
              <div className="relative flex flex-col items-center gap-1">
                <span className="text-xs font-bold">{t("failed")}</span>
                <button
                  type="button"
                  onClick={() => process(upload)}
                  className="min-h-9 rounded-full bg-primary px-3 text-xs font-semibold text-white"
                >
                  {t("retry")}
                </button>
              </div>
            ) : (
              <div className="relative flex w-full flex-col items-center gap-1.5">
                <span className="text-xs">
                  {upload.status === "compressing"
                    ? t("compressing")
                    : t("uploading", { percent: Math.round(upload.progress * 100) })}
                </span>
                <span className="h-1.5 w-full rounded-full bg-bg">
                  <span
                    className="block h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.round(upload.progress * 100)}%` }}
                  />
                </span>
              </div>
            )}
          </li>
        ))}

        {free > 0 ? (
          <li className="aspect-square">
            <label className="flex size-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-border text-sm font-semibold text-primary">
              <PlusIcon />
              {t("add")}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </li>
        ) : null}
      </ul>

      {uploads.some((u) => u.status === "error" && u.error) ? (
        <Alert tone="error">
          {tErrors(uploads.find((u) => u.status === "error")?.error ?? "photo_upload_failed")}
        </Alert>
      ) : null}

      <p className="text-[13px] text-text-muted">
        {t("count", { count: images.length, max: maxPhotos })}
      </p>
      <p className="rounded-card bg-surface px-3.5 py-3 text-[13px] leading-relaxed">
        {t("dataNotice")}
      </p>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {images.length === 0 ? (
          <p className="text-center text-sm text-text-muted">{t("needOne")}</p>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={images.length === 0 || busy > 0}
          className={buttonClasses("primary")}
        >
          {tWizard("next")}
        </button>
      </div>
    </div>
  );
}
