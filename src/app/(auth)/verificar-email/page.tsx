import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeader, FormSkeleton } from "@/components/auth/auth-header";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verificar-email">) {
  const t = await getTranslations("auth.verifyEmail");
  return (
    <>
      <AuthHeader title={t("title")} />
      <Suspense fallback={<FormSkeleton />}>
        <VerifyEmailContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function VerifyEmailContent({
  searchParams,
}: Pick<PageProps<"/verificar-email">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token === "string" && token.length > 0) {
    return <VerifyEmailForm token={token} />;
  }

  const t = await getTranslations("auth.errors");
  return <Alert tone="error">{t("form.linkInvalid")}</Alert>;
}
