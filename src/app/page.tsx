import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";

// Página provisional mientras se construye el MVP: es lo que se ve en bklnmarketplace.com.
export default async function ComingSoonPage() {
  const t = await getTranslations("comingSoon");
  const tBrand = await getTranslations("brand");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <Logo label={tBrand("logoLabel")} size="lg" />

      <section className="flex flex-1 flex-col justify-center gap-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          {t("eyebrow")}
        </p>
        <h1 className="text-[32px] font-extrabold leading-tight">{t("title")}</h1>
        <p className="text-base leading-relaxed text-text-muted">{t("body")}</p>
        <p className="rounded-card bg-surface px-4 py-3 text-sm">{t("cities")}</p>
      </section>

      <footer className="text-xs text-text-muted">{t("footer")}</footer>
    </main>
  );
}
