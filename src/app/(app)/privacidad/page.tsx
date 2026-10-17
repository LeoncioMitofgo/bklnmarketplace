import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: "/privacidad" },
  };
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}
