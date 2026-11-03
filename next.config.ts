import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Cada despliegue de Vercel con su identificador (D-062): una pestaña abierta desde antes de un
  // despliegue recarga la página al navegar, en vez de llamar a Server Actions que ya no existen
  // ("Failed to find Server Action"). En local no hay, y no cambia nada.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
