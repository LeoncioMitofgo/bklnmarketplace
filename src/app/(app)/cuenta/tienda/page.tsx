import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { StoreForm } from "@/components/store/store-form";
import { StoreImagePicker } from "@/components/store/store-image-picker";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { pickMessages } from "@/i18n/client-messages";
import { getSessionUser } from "@/lib/auth/session";
import { formatGqPhone } from "@/lib/format";
import { defaultStoreSlug } from "@/lib/stores/slug";
import { createClient } from "@/lib/supabase/server";

// Mi tienda (ALCANCE §4.8): solo con Premium. Si caduca, la tienda deja de verse pero los datos
// se conservan (§5.3) y aquí se explica cómo recuperarla.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("store.edit");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MyStorePage() {
  const t = await getTranslations("store.edit");
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
        <MyStoreContent />
      </Suspense>
    </main>
  );
}

async function MyStoreContent() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/cuenta/tienda");

  const supabase = await createClient();
  const [{ data: profile }, { data: store }, t, format, messages] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, premium_until")
      .eq("id", user.id)
      .single(),
    supabase
      .from("stores")
      .select("slug, name, description, address, opening_hours, call_phone, logo_path, cover_path")
      .eq("user_id", user.id)
      .maybeSingle(),
    getTranslations("store.edit"),
    getFormatter(),
    pickMessages(["common", "store"]),
  ]);
  if (!profile) redirect("/entrar?next=/cuenta/tienda");
  const premiumUntil = profile.premium_until ? new Date(profile.premium_until) : null;
  const isPremium = premiumUntil !== null && premiumUntil.getTime() > Date.now();

  if (!isPremium) {
    return (
      <section className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed">{store ? t("expired") : t("premiumOnly")}</p>
        <Link href="/premium" className={buttonClasses("accent")}>
          {store ? t("renew") : t("goPremium")}
        </Link>
      </section>
    );
  }

  return (
    <NextIntlClientProvider messages={messages}>
      {store ? (
        <Alert tone="info">
          {t("live", { date: format.dateTime(premiumUntil, { dateStyle: "short" }) })}{" "}
          <Link href={`/t/${store.slug}`} className="font-semibold text-primary underline">
            {t("view")}
          </Link>
        </Alert>
      ) : (
        <p className="text-[15px] leading-relaxed text-text-muted">{t("intro")}</p>
      )}
      <StoreForm
        isNew={!store}
        initial={{
          name: store?.name ?? profile.display_name,
          slug: store?.slug ?? defaultStoreSlug(profile.username),
          description: store?.description ?? "",
          address: store?.address ?? "",
          openingHours: store?.opening_hours ?? "",
          // Sin el +240, que ya va delante del campo: "222 123 456".
          callPhone: store?.call_phone ? formatGqPhone(store.call_phone).slice(5) : "",
        }}
      />
      {store ? (
        <section className="flex flex-col gap-5 border-t border-border pt-5">
          <h2 className="text-lg font-extrabold">{t("imagesTitle")}</h2>
          <StoreImagePicker kind="logo" path={store.logo_path} />
          <StoreImagePicker kind="cover" path={store.cover_path} />
        </section>
      ) : null}
    </NextIntlClientProvider>
  );
}
