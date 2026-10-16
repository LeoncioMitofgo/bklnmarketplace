import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
      <Logo label={t("brand.logoLabel")} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="text-2xl font-extrabold">{t("notFound.title")}</h1>
        <p className="text-base leading-relaxed text-text-muted">{t("notFound.body")}</p>
        <Link href="/" className={buttonClasses("primary")}>
          {t("notFound.goHome")}
        </Link>
      </div>
    </main>
  );
}
