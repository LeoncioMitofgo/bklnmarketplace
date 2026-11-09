/**
 * ¿Se deja indexar el sitio? Solo cuando SITE_INDEXABLE=true (se pone en Vercel al lanzar, ROADMAP 1.7).
 * Mientras tanto, robots.txt solo deja pasar lo de las tiendas reales y el resto lleva noindex.
 */
export function isIndexable(): boolean {
  return process.env.SITE_INDEXABLE === "true";
}

/**
 * Antes del lanzamiento ya se indexan las tiendas reales y sus anuncios, para que Google y los
 * asistentes las conozcan antes de abrir (D-081). Las de demostración (D-047) no.
 */
export function isIndexedBeforeLaunch(owner: { is_demo: boolean } | null, hasStore: boolean) {
  return !isIndexable() && hasStore && owner !== null && !owner.is_demo;
}

/** robots para generateMetadata: abre la página antes del lanzamiento; si no, hereda el del layout. */
export function prelaunchRobots(indexed: boolean) {
  return indexed ? { robots: { index: true, follow: true } } : {};
}
