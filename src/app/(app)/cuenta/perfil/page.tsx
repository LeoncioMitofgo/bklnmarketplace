import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { ProfileForm } from "@/components/account/profile-form";
import { ChevronLeftIcon } from "@/components/icons";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// Editar el perfil público (ALCANCE §4.3): foto, nombre, usuario, ciudad y descripción.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.profile");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EditProfilePage() {
  const t = await getTranslations("settings.profile");
  return (
    <main className="flex flex-col gap-6 px-4 pt-4">
      <Link
        href="/cuenta"
        className="-ml-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary"
      >
        <ChevronLeftIcon className="size-5" />
        {t("back")}
      </Link>
      <h1 className="-mt-3 text-2xl font-extrabold">{t("title")}</h1>
      <Suspense fallback={<div className="h-96 rounded-card bg-surface" aria-hidden="true" />}>
        <EditProfileContent />
      </Suspense>
    </main>
  );
}

async function EditProfileContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/perfil");

  const supabase = await createClient();
  const [{ data: profile }, catalog, messages] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, city_id, bio, avatar_path")
      .eq("id", user.id)
      .single(),
    getCatalog(),
    pickMessages(["common", "auth.errors", "auth.messages", "settings"]),
  ]);
  if (!profile) redirect("/entrar?next=/cuenta/perfil");

  return (
    <NextIntlClientProvider messages={messages}>
      <AvatarPicker name={profile.display_name} path={profile.avatar_path} />
      <ProfileForm
        profile={{
          displayName: profile.display_name,
          username: profile.username,
          cityId: profile.city_id,
          bio: profile.bio ?? "",
        }}
        cities={catalog.cities.map((c) => ({ id: c.id, name: c.name }))}
      />
    </NextIntlClientProvider>
  );
}
