import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";

/** Cabecera de una pantalla completa (sin barra inferior): volver y título. */
export function PageHeader({
  backHref,
  backLabel,
  title,
}: {
  backHref: string;
  backLabel: string;
  title: string;
}) {
  return (
    <header className="flex items-center gap-1 border-b border-border px-1 py-1.5">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <ChevronLeftIcon className="size-6" />
      </Link>
      <h1 className="truncate text-lg font-extrabold">{title}</h1>
    </header>
  );
}
