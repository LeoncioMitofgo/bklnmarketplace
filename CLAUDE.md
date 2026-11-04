# BKLN Marketplace

Marketplace de clasificados generalista (modelo Jiji + perfiles de vendedor tipo Vinted) para Guinea Ecuatorial. Web mobile first, sin app nativa por ahora. Proyecto de BKLN Software & Systems.

## Estado actual

**Fase 1 en curso.** La Fase 0 se completó el 2026-10-16. Hechas y probadas (1.5 el 2026-10-17):
- 1.1: auth, cuenta, perfil y barra inferior.
- 1.2: anuncios (publicar, Mis anuncios, caducidad y límites). El primer anuncio real se publicó desde un Android.
- 1.3: catálogo público (inicio, búsqueda con filtros, ficha, perfil con anuncios, favoritos y SEO). El inicio real sustituye a "Próximamente" y nada se indexa hasta el lanzamiento (D-043, D-044).
- 1.4: chat en tiempo real con fotos, bandeja, no leídos, bloqueos, botón de WhatsApp, tiempo de respuesta y notificaciones push (D-048 a D-052). La ficha va a pantalla completa con la barra de contacto.
- 1.5: denuncias con auto‑ocultado a las 3, términos prohibidos por palabras completas, `/terminos`, `/privacidad` y borrar la cuenta (D-053 a D-056). Las pantallas con sesión redirigen a entrar en el proxy (D-054). Los textos legales son provisionales: los revisa el cliente.

Las pruebas en el móvil que quedan pendientes del usuario son las casillas sin marcar de ROADMAP. Hasta el lanzamiento hay datos de demostración (D-047), y la web lo avisa arriba (D-066).

- 1.6, primera parte: "Hazte Premium" en `/premium` con solicitud y WhatsApp, y panel `/admin` (pagos y activación de Premium, denuncias con el chat denunciado, usuarios con suspender y banear, métricas) (D-057). El rol de admin se da con SQL.

- 1.6, segunda parte: editar el perfil (`/cuenta/perfil`, con foto) y el acceso (`/cuenta/acceso`: email, teléfono y contraseña) (D-058), la tienda Premium `/t/<tienda>`, que se edita en `/cuenta/tienda` (D-059), el catálogo y los ajustes en el panel (D-060), y el aviso de Premium por caducar, en la web y por push con un cron diario (D-061). Todo, el 2026-11-03. `CRON_SECRET` está en Vercel desde el 2026-11-03.

- 1.7, primera parte: marca nueva (la "b" con la etiqueta) en el logo, el favicon, los iconos y la imagen para compartir, y la web se puede instalar en el móvil (D-063), el 2026-11-03.

- 1.7: las pruebas de extremo a extremo están en el repo (`e2e/`, `pnpm e2e`, D-064), el 2026-11-04.

- 1.7, preparar el lanzamiento (2026-11-04): empresas y correos en `docs/LANZAMIENTO-CONTACTOS.md`, tiendas fundadoras con 6 meses de Premium y propuestas personalizadas (D-065), aviso de versión previa (D-066) y **el proyecto de Supabase actual es el de producción** (D-067).

**Siguiente:** 1.7, lanzamiento, previsto para **enero de 2027** (D-068). Pendiente (ROADMAP): lo que falta antes de abrir. La analítica y los errores están desde el 2026-11-04 (D-072), con Sentry en marcha (proyecto `bkln-marketplace`, `SENTRY_DSN` en Vercel).

## Recursos

- Repo: https://github.com/LeoncioMitofgo/bklnmarketplace (rama principal `main`).
- Supabase **producción**: proyecto `xujlsrezhctlovncsywu` ("BKLNMarketplace") en Irlanda `eu-west-1` (https://xujlsrezhctlovncsywu.supabase.co), enlazado con la CLI (D-067). Plan Free hasta el lanzamiento; Pro antes de abrir. **No hay proyecto de desarrollo**: se crea antes de la próxima migración.
- Dominio: `bklnmarketplace.com`, registrado en Hostinger; el DNS apunta a Vercel desde el 2026-10-16.
- Oficina (pagos Premium): BKLN Software & Systems, Banapa, Malabo. Lunes a viernes de 8:00 a 16:00 y sábados de 11:00 a 14:00. WhatsApp de pagos: +240 555 220 846. Beneficiario de los envíos por agencia: BKLN Marketplace.
- Vercel: equipo `bkln-software` (`team_ncnI0qZKscFu7lW1UFjajnqS`, plan Hobby), proyecto `bkln_marketplace` (`prj_LhOB2RneFwbTVUs5cnaWUCdHfL5T`), accesible con el conector MCP. Está conectado al repo: **cada push a `main` despliega a producción**. Dominio principal `www.bklnmarketplace.com`; la raíz redirige con 308. Registros DNS en ARQUITECTURA §6.
- Claves en `.env.local` (ignorado por git); la plantilla es `.env.example`. Nunca escribir claves secretas en los documentos ni en el chat.

## Documentos (leer la sección que haga falta, no todo cada vez)

- [docs/ALCANCE.md](docs/ALCANCE.md) — qué es y qué no es el producto, permisos, reglas de negocio. **Fuente de verdad.**
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — stack, región, estructura del repo y flujos técnicos (login, imágenes, chat/push, búsqueda, cron), entornos y costes.
- [docs/MODELO-DATOS.md](docs/MODELO-DATOS.md) — tablas, enums, RLS, triggers, RPC, Storage, Realtime, índices y borrado de cuenta. **Especificación de las migraciones.**
- [docs/IDENTIDAD.md](docs/IDENTIDAD.md) — logo, tokens de color, tipografía, formas, componentes base y decisiones de cada pantalla (wireframes).
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases y checklist. Marcar lo que se complete.
- [docs/DECISIONES.md](docs/DECISIONES.md) — decisiones tomadas y pendientes.
- [docs/PAGOS-PROVEEDORES.md](docs/PAGOS-PROVEEDORES.md) — Rosa Money, Muni Dinero y Bonafide Microbank: quiénes son, contactos y correos para presentarnos (prepara los pagos de la fase 3).
- [docs/LANZAMIENTO-CONTACTOS.md](docs/LANZAMIENTO-CONTACTOS.md) — empresas de Malabo para el lanzamiento (agencias y medios, patrocinio, tiendas fundadoras y lugar), con sus emails comprobados y los correos para escribirles.
- Skill `bkln-feature` ([.claude/skills/bkln-feature/SKILL.md](.claude/skills/bkln-feature/SKILL.md)) — checklist obligatorio antes de diseñar o implementar cualquier funcionalidad.

## Reglas inamovibles (resumen de ALCANCE)

1. **Mobile first y baja conectividad**: diseño a 360 px; rendimiento e imágenes ligeras son requisito, no mejora.
2. **Sin pagos ni entregas en la plataforma** (v1). Nada de carrito, checkout ni pedidos. La unidad es el *anuncio* + la *conversación*.
3. **Una sola cuenta compra y vende.** Ver todo sin cuenta; chatear, publicar y favoritos requieren cuenta. Registro: nombre, usuario, teléfono, email y contraseña. Login: usuario/email/teléfono + contraseña. Sin SMS en el MVP. Publicar requiere el email confirmado (ALCANCE §5.7).
4. **Contacto**: chat interno siempre + botón WhatsApp/llamar opcional por vendedor, visible solo con sesión. El teléfono nunca es público ni indexable.
5. **Dos planes: Normal y Premium** (plan único de 1, 3, 6 o 12 meses, pagado en la oficina o, fuera de Malabo, por agencia de envío con el código por WhatsApp, y activado a mano por el admin con fecha de fin; precios en D-022, pagos en D-025). Los límites viven en una configuración de planes, nunca como números mágicos repartidos por el código.
6. **Solo Guinea Ecuatorial**: XAF entero ("150.000 FCFA"), teléfonos +240, zona horaria Africa/Malabo, español con i18n desde el día 1 (francés más adelante).
7. Lo que está fuera del MVP (ALCANCE §8) no se implementa sin preguntar, pero el diseño no debe impedirlo (sobre todo pagos in-app).

## Stack (detalle y motivos en docs/ARQUITECTURA.md)

Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + RLS, Auth, Realtime, Storage, pg_cron) · Resend · next-intl · Zod · Vercel · pnpm + Biome · Vitest + Playwright.

- **Región: Irlanda** (Supabase `eu-west-1`, funciones de Vercel `dub1`, D-067). Cada viaje Malabo↔Europa cuesta unos 150 ms, así que: Server Components por defecto, una sola ida y vuelta por página y nada de cascadas de peticiones desde el cliente.
- **RLS en todas las tablas.** Migraciones SQL escritas a mano en `supabase/migrations/`. No hay Docker local, así que no se usa `supabase db diff`.
- **El proyecto de Supabase enlazado es el de producción** (D-067). Nunca se prueba una migración directamente en producción: antes de la próxima hay que crear el proyecto de desarrollo y probarla allí. Las pruebas `e2e/` también escriben en producción (cada una borra lo suyo): lanzar solo las de lo que se ha tocado, y no lanzarlas con usuarios reales hasta tener el proyecto de desarrollo.
- Imágenes: variantes WebP generadas en el móvil, sin optimizador de imágenes en el servidor.

## Comandos

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm e2e todas` (pruebas de extremo a extremo contra `pnpm start -p 3100`; ver [e2e/README.md](e2e/README.md)) · `pnpm lint` · `pnpm typecheck` · `pnpm db:push` (migraciones al proyecto enlazado; usa la sesión de la CLI) · `pnpm db:types` (regenera `src/lib/supabase/database.types.ts` después de cada migración).

Antes de dar por terminada una tarea: lint, typecheck, tests y build en verde, y las pruebas de `e2e/` de lo que se ha tocado (o una nueva, si es una funcionalidad nueva).

## Idioma y convenciones

- Conversación, documentación, textos de UI y commits: **español**.
- Código (variables, funciones, tablas, columnas, endpoints internos): **inglés**.
- URLs públicas en español y legibles: `/anuncio/...`, `/categoria/...`, `/u/<usuario>`, `/t/<tienda>`, `/publicar`, `/mensajes`.

## Cómo trabajar en este repo

- Antes de cualquier funcionalidad, pantalla o modelo de datos: aplicar la skill `bkln-feature`.
- Antes de escribir código de Next.js, lee la guía correspondiente en `node_modules/next/dist/docs/` (ver [AGENTS.md](AGENTS.md)). Next 16 cambia APIs: `proxy.ts` en lugar de `middleware.ts`, Cache Components y `use cache`.
- Si una petición contradice ALCANCE o una decisión tomada: avisar y preguntar antes de hacerla. Si se aprueba, actualizar ALCANCE y DECISIONES.
- Al completar una tarea del roadmap: marcarla en ROADMAP.md.
- Sin sobreingeniería: estamos validando mercado. La versión más simple que funcione en un Android de gama baja con 3G.
