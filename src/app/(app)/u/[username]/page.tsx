import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MapPinIcon } from "@/components/icons";
import { Avatar } from "@/components/profile/avatar";
import { getPublicProfile } from "@/lib/profiles";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return {};
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio ?? undefined,
    alternates: { canonical: `/u/${profile.username}` },
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  const t = await getTranslations("profile");
  return (
    <main className="flex flex-col gap-6 px-4 pt-6">
      <Suspense fallback={<p className="text-text-muted">{t("loading")}</p>}>
        <ProfileContent params={params} />
      </Suspense>
    </main>
  );
}

async function ProfileContent({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) notFound();

  const t = await getTranslations("profile");
  const format = await getFormatter();
  const isPremium = profile.premium_until !== null && new Date(profile.premium_until) > new Date();

  return (
    <>
      <section className="flex items-center gap-4">
        <Avatar name={profile.display_name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{profile.display_name}</h1>
            {isPremium ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-text">
                {t("premium")}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-text-muted">@{profile.username}</p>
        </div>
      </section>

      <div className="flex flex-col gap-1.5 text-sm text-text-muted">
        {profile.city ? (
          <span className="flex items-center gap-1.5">
            <MapPinIcon className="size-4" />
            {profile.city.name}
          </span>
        ) : null}
        <span>
          {t("memberSince", {
            date: format.dateTime(new Date(profile.created_at), { month: "long", year: "numeric" }),
          })}
        </span>
      </div>

      {profile.bio ? <p className="text-base leading-relaxed">{profile.bio}</p> : null}

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-lg font-extrabold">{t("listings")}</h2>
        <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
          {t("noListings", { name: profile.display_name })}
        </p>
      </section>
    </>
  );
}
