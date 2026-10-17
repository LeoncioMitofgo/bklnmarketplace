import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Panel de administración (ALCANCE §4.11). Sin barra inferior; cada página comprueba el rol (requireAdmin).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    robots: { index: false },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-2xl">{children}</div>;
}
