// Logo de BKLN Marketplace (IDENTIDAD §2). El símbolo es SVG; el logotipo se pasará a trazados SVG
// para no depender de fuentes. Mientras tanto: "bkln" en Plus Jakarta Sans 800 + "marketplace" en la del sistema.

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
        d="M10 4h24a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H17l-7 7v-7a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8z"
        className="fill-primary"
      />
      <circle cx="11" cy="13" r="3" className="fill-white" />
      <path
        d="M17 19h16M17 25h10"
        className="stroke-accent"
        strokeWidth="3"
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
