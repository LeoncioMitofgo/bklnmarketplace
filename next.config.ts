import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  // Los mensajes se precompilan al compilar: el navegador ya no carga el formateador de ICU
  // (~12 KB comprimidos en cada página). Solo admite textos; las listas de los textos legales van
  // aparte, en content/legal.
  experimental: {
    messages: { path: "./src/messages", format: "json", locales: "infer", precompile: true },
  },
});

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
