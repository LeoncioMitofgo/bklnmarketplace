import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckIcon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";

// Después de borrar la cuenta (lib/account/actions.ts). Página estática.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deleteAccount.done");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccountDeletedPage() {
  const t = await getTranslations("deleteAccount.done");
  return (
    <main className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <CheckIcon className="size-10 text-success" />
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-[15px] leading-relaxed text-text-muted">{t("text")}</p>
      <Link href="/" className={buttonClasses("primary", "mt-2")}>
        {t("home")}
      </Link>
    </main>
  );
}
