import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeader, FormSkeleton } from "@/components/auth/auth-header";
import { SignUpForm } from "@/components/auth/signup-form";
import { safeNextPath } from "@/lib/auth/next-path";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const t = await getTranslations("auth.signup");
  return (
    <>
      <AuthHeader title={t("title")} />
      <Suspense fallback={<FormSkeleton />}>
        <SignUpFormWithNext searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SignUpFormWithNext({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const { next } = await searchParams;
  return <SignUpForm next={typeof next === "string" ? safeNextPath(next, "") || null : null} />;
}
