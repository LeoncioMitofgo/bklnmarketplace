import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { CloseIcon } from "@/components/icons";

/** Cabecera de las pantallas de auth (wireframes 06 y 07): cerrar, logo y título. */
export async function AuthHeader({ title }: { title: string }) {
  const t = await getTranslations();
  return (
    <header className="flex flex-col gap-4 pt-2 pb-6">
      <Link
        href="/"
        aria-label={t("common.close")}
        className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-text"
      >
        <CloseIcon />
      </Link>
      <Logo label={t("brand.logoLabel")} />
      <h1 className="text-2xl font-extrabold">{title}</h1>
    </header>
  );
}

export function FormSkeleton() {
  return <div className="h-80 animate-pulse rounded-card bg-surface" aria-hidden="true" />;
}
