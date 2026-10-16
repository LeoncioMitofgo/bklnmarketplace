"use client";

/**
 * Cierra la hoja de filtros. Si se abrió con el ancla #filtros, vuelve atrás en el historial
 * (así el botón atrás no la reabre); sin JavaScript es un enlace normal fuera del ancla.
 */
export function SheetClose({
  className,
  children,
  label,
}: {
  className?: string;
  children?: React.ReactNode;
  label: string;
}) {
  return (
    // biome-ignore lint/a11y/useValidAnchor: sin JavaScript tiene que ser un enlace que salga del ancla.
    <a
      href="#resultados"
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (window.location.hash === "#filtros") {
          event.preventDefault();
          window.history.back();
        }
      }}
    >
      {children}
    </a>
  );
}
