import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeader, FormSkeleton } from "@/components/auth/auth-header";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/next-path";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const t = await getTranslations("auth.login");
  return (
    <>
      <AuthHeader title={t("title")} />
      <Suspense fallback={<FormSkeleton />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? safeNextPath(next, "") || null : null} />;
}
