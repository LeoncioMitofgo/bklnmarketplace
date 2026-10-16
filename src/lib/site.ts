/**
 * URL pública del sitio (enlaces absolutos, Open Graph, emails).
 * Producción: NEXT_PUBLIC_SITE_URL (https://www.bklnmarketplace.com).
 * Previews de Vercel: la URL del propio despliegue. En local: localhost.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
