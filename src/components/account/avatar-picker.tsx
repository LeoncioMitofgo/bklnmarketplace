"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/avatar";
import { Alert } from "@/components/ui/alert";
import { prepareAvatarUpload, removeAvatar, saveAvatar } from "@/lib/account/settings-actions";
import { compressSquare } from "@/lib/listings/compress";
import { uploadWithProgress } from "@/lib/listings/upload";

/** Lado de la foto de perfil: se ve a 80 px como mucho; 400 px dan para pantallas densas. */
const AVATAR_SIDE = 400;

/**
 * Elegir la foto de perfil: se recorta en cuadrado y se reduce en el móvil (sin EXIF), se sube a
 * una URL firmada con progreso y después se guarda en el perfil.
 */
export function AvatarPicker({ name, path }: { name: string; path: string | null }) {
  const t = useTranslations("settings.avatar");
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

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
      const compressed = await compressSquare(file, AVATAR_SIDE).catch(() => {
        throw new Error("photo_unreadable");
      });
      setPreview(URL.createObjectURL(compressed.blob));
      const prepared = await prepareAvatarUpload(compressed.format);
      if (!prepared.ok) throw new Error(prepared.error);
      await uploadWithProgress(prepared.signedUrl, compressed.blob, setProgress);
      const saved = await saveAvatar(prepared.path);
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
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar name={name} path={path} src={preview} size="lg" />
        <div className="flex flex-col items-start gap-1">
          <label
            className={`flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-primary ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {busy
              ? progress > 0
                ? t("uploading", { percent: Math.round(progress * 100) })
                : t("preparing")
              : path
                ? t("change")
                : t("add")}
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {path && !busy ? (
            <form action={removeAvatar}>
              <button type="submit" className="min-h-11 text-sm text-text-muted">
                {t("remove")}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-text-muted">{t("hint")}</p>
      {error ? <Alert tone="error">{t(`errors.${error}`)}</Alert> : null}
    </div>
  );
}
