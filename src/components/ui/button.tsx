// Botones según IDENTIDAD §5: 52 px de alto, radio 12 px. El naranja (accent) solo para Publicar y Premium.

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border-2 border-primary bg-bg text-primary hover:bg-surface",
  accent: "bg-accent text-text",
  ghost: "text-primary hover:bg-surface",
};

export function buttonClasses(variant: ButtonVariant = "primary", className = ""): string {
  return [
    "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-control px-5",
    "text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
    VARIANTS[variant],
    className,
  ].join(" ");
}
