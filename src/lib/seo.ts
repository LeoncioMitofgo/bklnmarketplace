/**
 * ¿Se deja indexar el sitio? Solo cuando SITE_INDEXABLE=true (se pone en Vercel al lanzar, ROADMAP 1.7).
 * Mientras tanto, robots.txt lo bloquea todo y las páginas llevan noindex.
 */
export function isIndexable(): boolean {
  return process.env.SITE_INDEXABLE === "true";
}
