import type { ReactNode } from "react";

type AlertProps = {
  tone: "error" | "success" | "info";
  children: ReactNode;
};

const TONES: Record<AlertProps["tone"], string> = {
  error: "border-danger text-danger",
  success: "border-success text-success",
  info: "border-border text-text",
};

/** Aviso de formulario. Los errores se anuncian al lector de pantalla al aparecer. */
export function Alert({ tone, children }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-control border bg-surface px-3.5 py-3 text-sm leading-relaxed ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
