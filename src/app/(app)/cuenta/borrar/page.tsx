import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

// Borrar la cuenta (ALCANCE §4.3 y §7). Qué se borra y qué se conserva: MODELO-DATOS §11.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deleteAccount");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function DeleteAccountPage() {
  const t = await getTranslations("deleteAccount");
  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <Suspense fallback={<div className="h-80 rounded-card bg-surface" aria-hidden="true" />}>
        <DeleteAccountContent />
      </Suspense>
    </main>
  );
}

async function DeleteAccountContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/borrar");
  const t = await getTranslations("deleteAccount");

  return (
    <>
      <p className="rounded-control border border-danger bg-surface px-3.5 py-3 text-sm font-semibold text-danger">
        {t("warning")}
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-bold">{t("deletedTitle")}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
          <li>{t("deleted1")}</li>
          <li>{t("deleted2")}</li>
          <li>{t("deleted3")}</li>
          <li>{t("deleted4")}</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-bold">{t("keptTitle")}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
          <li>{t("kept1")}</li>
          <li>{t("kept2")}</li>
        </ul>
      </section>
      <p className="text-sm leading-relaxed text-text-muted">{t("freed")}</p>

      <DeleteAccountForm
        labels={{
          password: t("password"),
          submit: t("submit"),
          submitting: t("submitting"),
          errors: {
            password_required: t("errors.password_required"),
            invalid_password: t("errors.invalid_password"),
            too_many_attempts: t("errors.too_many_attempts"),
            unexpected: t("errors.unexpected"),
          },
        }}
      />
      <Link href="/cuenta" className={buttonClasses("ghost")}>
        {t("cancel")}
      </Link>
    </>
  );
}
