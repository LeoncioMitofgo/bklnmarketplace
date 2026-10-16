import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeader, FormSkeleton } from "@/components/auth/auth-header";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.newPassword");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function NewPasswordPage({ searchParams }: PageProps<"/nueva-contrasena">) {
  const t = await getTranslations("auth.newPassword");
  return (
    <>
      <AuthHeader title={t("title")} />
      <Suspense fallback={<FormSkeleton />}>
        <NewPasswordContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewPasswordContent({
  searchParams,
}: Pick<PageProps<"/nueva-contrasena">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token === "string" && token.length > 0) {
    return <NewPasswordForm token={token} />;
  }

  const t = await getTranslations("auth");
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="error">{t("errors.form.linkInvalid")}</Alert>
      <Link
        href="/recuperar"
        className="flex min-h-11 items-center justify-center text-sm font-bold text-primary"
      >
        {t("newPassword.requestNew")}
      </Link>
    </div>
  );
}
