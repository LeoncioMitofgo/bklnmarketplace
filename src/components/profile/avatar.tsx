/** Avatar con la inicial mientras no haya foto (la subida de fotos llega con el perfil editable). */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const sizes = size === "lg" ? "size-20 text-3xl" : "size-14 text-xl";
  return (
    <span
      aria-hidden="true"
      className={`${sizes} flex shrink-0 items-center justify-center rounded-full bg-surface font-display font-extrabold text-primary`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
