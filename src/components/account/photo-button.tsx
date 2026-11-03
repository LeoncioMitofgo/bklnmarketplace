"use client";

import { useRef } from "react";

/**
 * Botón para elegir una foto (un input de fichero escondido dentro de la etiqueta). Mientras sube,
 * enseña "Preparando…" y luego el porcentaje.
 */
export function PhotoButton({
  label,
  busy,
  progress,
  labels,
  onFile,
}: {
  label: string;
  busy: boolean;
  progress: number | null;
  labels: { preparing: string; uploading: (percent: number) => string };
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-primary ${
        busy ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {busy && progress !== null
        ? progress > 0
          ? labels.uploading(Math.round(progress * 100))
          : labels.preparing
        : label}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (input.current) input.current.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
