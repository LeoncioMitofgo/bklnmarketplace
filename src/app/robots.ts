import type { MetadataRoute } from "next";
import { isIndexable } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// Hasta el lanzamiento (SITE_INDEXABLE sin poner) no se indexa nada: el proyecto aún usa datos de prueba.
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
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
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
