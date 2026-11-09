import type { MetadataRoute } from "next";
import { isIndexable } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// Hasta el lanzamiento (SITE_INDEXABLE sin poner) solo se deja pasar lo de las tiendas: sus páginas,
// los anuncios (los de demostración llevan noindex), los estáticos para pintarlas y el sitemap, que
// solo trae las tiendas reales y sus anuncios (D-081).
export default function robots(): MetadataRoute.Robots {
  const sitemap = `${siteUrl()}/sitemap.xml`;
  if (!isIndexable()) {
    return {
      rules: {
        userAgent: "*",
        allow: ["/t/", "/anuncio/", "/_next/", "/sitemap.xml"],
        disallow: ["/", "/anuncio/*/denunciar"],
      },
      sitemap,
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/buscar",
        "/cuenta",
        "/favoritos",
        "/mis-anuncios",
        "/publicar",
        "/mensajes",
        "/entrar",
        "/registro",
        "/recuperar",
        "/nueva-contrasena",
        "/verificar-email",
        "/anuncio/*/denunciar",
        "/admin",
      ],
    },
    sitemap,
  };
}
