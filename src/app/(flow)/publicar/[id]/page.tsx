import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ListingWizard } from "@/components/listings/wizard/listing-wizard";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { getEditableListing, getPlanUsage } from "@/lib/listings/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("listings.start");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default function ListingEditorPage({ params }: PageProps<"/publicar/[id]">) {
  return (
    <Suspense fallback={<div className="m-4 h-96 animate-pulse rounded-card bg-surface" />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: Pick<PageProps<"/publicar/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=/publicar/${id}`);

  const [editable, catalog, usage] = await Promise.all([
    getEditableListing(id, user.id),
    getCatalog(),
    getPlanUsage(user.id),
  ]);
  if (!editable) notFound();

  return (
    <ListingWizard
      listing={editable.listing}
      images={editable.images}
      catalog={catalog}
      maxPhotos={usage.maxPhotos}
      emailVerified={usage.emailVerified}
    />
  );
}
