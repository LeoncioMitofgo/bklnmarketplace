/** Estado de un anuncio en el panel: rojo si está oculto o bloqueado, verde si está a la vista. */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "under_review" || status === "blocked"
      ? "bg-danger text-white"
      : status === "active"
        ? "bg-success text-white"
        : "bg-surface text-text";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}
