// Logo de BKLN Marketplace (IDENTIDAD §2). El símbolo es la "b" con la etiqueta de precio; los SVG
// maestros están en docs/marca. Logotipo: "bkln" en Plus Jakarta Sans 800 + "marketplace" en la del sistema.

type LogoProps = {
  label: string;
  size?: "sm" | "lg";
  className?: string;
};

export function LogoSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M2.5 27V7a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v5.86A15 15 0 1 1 2.5 27Z"
        className="fill-primary"
      />
      <g transform="translate(17.5 27) rotate(-45)">
        <path
          d="M8 0 3-5H-7.5V5H3Z"
          className="fill-white stroke-white"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <circle cx="3.2" cy="0" r="1.8" className="fill-primary" />
      </g>
      <path
        d="M29 11 32.5 4M33.5 16l6-6"
        className="stroke-accent"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ label, size = "sm", className = "" }: LogoProps) {
  const symbol = size === "lg" ? "size-11" : "size-8";
  const text = size === "lg" ? "text-[28px]" : "text-xl";
  return (
    <span
      className={`inline-flex items-center gap-2 text-primary ${className}`}
      aria-label={label}
      role="img"
    >
      <LogoSymbol className={symbol} />
      <span className={`${text} leading-none`} aria-hidden="true">
        <span className="font-display font-extrabold">bkln</span>
        <span className="font-medium">marketplace</span>
      </span>
    </span>
  );
}
