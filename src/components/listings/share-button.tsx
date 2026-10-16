"use client";

import { ShareIcon } from "@/components/icons";

/**
 * Compartir: menú nativo del móvil si existe; si no (o sin JavaScript), WhatsApp con el enlace.
 * La vista previa la dan las etiquetas Open Graph de la ficha.
 */
export function ShareButton({
  url,
  text,
  label,
  className,
}: {
  url: string;
  text: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (typeof navigator.share !== "function") return;
        event.preventDefault();
        navigator.share({ text, url }).catch(() => {
          // El usuario cerró el menú de compartir: no hay nada que hacer.
        });
      }}
    >
      <ShareIcon className="size-5" />
    </a>
  );
}
