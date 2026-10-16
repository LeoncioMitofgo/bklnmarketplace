import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/components/auth/auth-header";
import { RecoverForm } from "@/components/auth/recover-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.recover");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function RecoverPage() {
  const t = await getTranslations("auth.recover");
  return (
    <>
      <AuthHeader title={t("title")} />
      <RecoverForm />
    </>
  );
}
