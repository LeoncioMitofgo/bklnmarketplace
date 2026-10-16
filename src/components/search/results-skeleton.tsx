// Esqueleto mientras llegan los resultados: misma estructura que la lista para que no salte.
export function ResultsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 px-4">
      <div className="h-12 rounded-control bg-surface" />
      <div className="flex gap-2">
        <div className="h-10 w-24 rounded-full bg-surface" />
        <div className="h-10 w-20 rounded-full bg-surface" />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: filas de relleno sin identidad.
          <li key={i} className="flex gap-3 py-3">
            <div className="size-24 shrink-0 rounded-control bg-placeholder" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <div className="h-4 w-24 rounded bg-placeholder" />
              <div className="h-4 w-full rounded bg-surface" />
              <div className="h-3 w-32 rounded bg-surface" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
