import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { pickMessages } from "@/i18n/client-messages";
import { LOCALE } from "@/i18n/request";
import { isIndexable } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Un solo peso (800), solo para títulos y precios (D-032). El resto usa la fuente del sistema.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: "800",
  display: "swap",
  variable: "--font-jakarta",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: { siteName: t("siteName"), locale: "es_GQ", type: "website" },
    // Hasta el lanzamiento, nada indexable (ver robots.ts).
    robots: isIndexable() ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b4f8a", // --color-primary (IDENTIDAD §3)
  // Con el teclado abierto, la página se encoge: la caja de texto del chat queda a la vista.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cada grupo de rutas añade los textos de sus componentes de cliente (i18n/client-messages.ts).
  const messages = await pickMessages(["common", "nav", "errorPage"]);
  return (
    <html lang={LOCALE} className={jakarta.variable}>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
