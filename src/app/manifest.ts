import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { LOCALE } from "@/i18n/request";

// Manifiesto de la web instalable (D-063): Chrome y Safari la añaden a la pantalla de inicio con el
// icono de la marca y la abren sin la barra del navegador. Los iconos salen de docs/marca.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: LOCALE, namespace: "meta" });
  return {
    id: "/",
    name: t("siteName"),
    short_name: t("shortName"),
    description: t("description"),
    lang: LOCALE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff", // --color-bg
    theme_color: "#0b4f8a", // --color-primary
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
