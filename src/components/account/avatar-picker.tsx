"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/profile/avatar";
import { Alert } from "@/components/ui/alert";
import { prepareAvatarUpload, removeAvatar, saveAvatar } from "@/lib/account/settings-actions";
import { compressSquare } from "@/lib/listings/compress";
import { PhotoButton } from "./photo-button";
import { useImageUpload } from "./use-image-upload";

/** Lado de la foto de perfil: se ve a 80 px como mucho; 400 px dan para pantallas densas. */
const AVATAR_SIDE = 400;

/**
 * Elegir la foto de perfil: se recorta en cuadrado y se reduce en el móvil (sin EXIF), se sube a
 * una URL firmada con progreso y después se guarda en el perfil.
 */
export function AvatarPicker({ name, path }: { name: string; path: string | null }) {
  const t = useTranslations("settings.avatar");
  const { preview, progress, error, busy, upload } = useImageUpload({
    compress: (file) => compressSquare(file, AVATAR_SIDE),
    prepare: prepareAvatarUpload,
    save: saveAvatar,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar name={name} path={path} src={preview} size="lg" />
        <div className="flex flex-col items-start gap-1">
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
