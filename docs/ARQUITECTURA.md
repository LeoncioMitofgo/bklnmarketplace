# Arquitectura técnica — BKLN Marketplace

> Versión 1.0 — 2026-10-16. Recoge las decisiones D-015 a D-020 de [DECISIONES.md](DECISIONES.md).
> Si algo cambia, se actualiza aquí y se registra allí.

---

## 1. Principio rector: la latencia

Mediciones del 2026-10-16 desde Malabo (tiempo de conexión TCP a regiones de AWS, mínimo de 5 muestras):

| Región | Mínimo | Comportamiento |
|---|---|---|
| **Londres (eu-west-2)** | **135 ms** | La más estable → **elegida** |
| París (eu-west-3) | 140 ms | Picos de hasta 700 ms |
| Irlanda / España | 144–149 ms | Similar |
| Frankfurt | 161 ms | — |
| EE. UU. Este | 213 ms | — |
| Ciudad del Cabo | 291 ms | El tráfico de GE sale por Europa |

Segunda medición (20 muestras alternas, el mismo día): **Londres** con mediana de 151 ms, el 10 % más lento por encima de 167 ms y máximo de 184 ms; **Irlanda** con mediana de 162 ms, el 10 % más lento por encima de 369 ms y máximo de 539 ms. Londres queda confirmada para producción por estabilidad. El proyecto de desarrollo está en Irlanda (D-024), lo que basta para desarrollar.

Cada viaje entre Malabo y Europa cuesta unos 150 ms, más lo que añada la red móvil. De ahí salen estas reglas:

1. **Server Components por defecto.** Solo se usa `"use client"` donde hay interacción real: chat, asistente de publicación, galería y formularios con estado.
2. **Una pantalla = un viaje.** El servidor pide en paralelo los datos de la página y la entrega completa. Nada de que el cliente encadene peticiones.
3. **Servidor junto a la base de datos.** Las funciones de Vercel van en `lhr1` y Supabase en `eu-west-2`, así que las consultas entre ellos tardan alrededor de 1 ms.
4. **Las páginas públicas funcionan aunque no cargue el JavaScript** (por ejemplo, en navegadores ligeros como Opera Mini): se generan en el servidor y los enlaces son enlaces normales.
5. **Lo público se cachea** (home, categorías, fichas, perfiles y tiendas) y se invalida por etiquetas cuando cambia un anuncio o un perfil.
6. **Objetivos de peso orientativos:** JavaScript de primera carga en páginas públicas de ~100 KB comprimido como máximo, miniaturas de ~40 KB y fotos grandes de ~250 KB.

## 2. Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | Next.js 16 (App Router, **Cache Components** + Partial Prefetching) + TypeScript | Server Components, Server Actions, `use cache` + `cacheTag`. Lo que depende de la sesión va en `<Suspense>` (D-034) |
| Interfaz | Tailwind CSS + shadcn/ui + Lucide | Solo se añaden los componentes que se usan |
| Base de datos | Supabase Postgres | **RLS en todas las tablas**. Extensiones: `unaccent`, `pg_trgm`, `pg_cron`, `pg_net` |
| Login | Supabase Auth (email + contraseña por debajo) | Confirmación de email de Supabase **desactivada**; usamos un flujo propio (§5.1) |
| Tiempo real | Supabase Realtime con canales privados autorizados por RLS | Chat y contador de no leídos |
| Ficheros | Supabase Storage (bucket público con CDN) | Solo WebP, con tamaño máximo por fichero |
| Búsqueda | Búsqueda de texto completo de Postgres (`spanish`), `unaccent` y trigramas; atributos en JSONB | Meilisearch o Typesense solo si algún día hace falta |
| Tareas programadas | `pg_cron` para tareas solo de SQL; Vercel Cron para las que envían email o push | §5.5 |
| Push | Web Push (VAPID) + service worker propio + librería `web-push` | Sin Firebase |
| Email | Resend (API REST) con plantillas HTML propias | La app envía la verificación y la recuperación (D-037); React Email, si las plantillas crecen |
| Traducciones | next-intl | Solo `es`, sin prefijo de idioma en la URL |
| Validación | Zod | Esquemas compartidos entre cliente y servidor |
| Errores | Sentry | Script cargado con el mínimo impacto |
| Analítica | Vercel Web Analytics (activada en el proyecto el 2026-10-16; se instala `@vercel/analytics` con `<Analytics />` en el layout raíz) + métricas de negocio desde nuestra base de datos | Sin PostHog ni GA, por peso. Los eventos personalizados de Vercel exigen el plan Pro; no los necesitamos, porque las métricas de validación salen de Postgres |
| Tests | Vitest (lógica) + Playwright (flujos a 360 px con red lenta simulada) | |
| Herramientas | pnpm, Node 24 LTS, Biome, Supabase CLI | |
| Hosting | Vercel | Plan gratuito (Hobby) en desarrollo; **Pro al lanzar** (Hobby no permite uso comercial) |

**Descartados:**
- Firebase: no es relacional y complica filtros y búsqueda.
- Clerk / Auth0: otro proveedor y otra factura.
- ORM (Prisma / Drizzle): sería una capa encima de RLS.
- Monorepo: innecesario para una sola app.
- Optimizador de imágenes en servidor: tiene coste y las variantes ya se generan en el móvil.

## 3. Estructura del repositorio

```
/
├─ src/
│  ├─ app/                    # rutas (los segmentos de URL, en español)
│  │  ├─ (public)/            # home, buscar, anuncio/, categoria/, u/, t/
│  │  ├─ (auth)/              # registro, entrar, recuperar, verificar-email
│  │  ├─ (app)/               # publicar, mensajes, mis-anuncios, favoritos, ajustes, premium
│  │  ├─ admin/               # panel de administración (rol admin)
│  │  └─ api/                 # webhooks, cron, push
│  ├─ components/             # ui/ (shadcn) + componentes propios
│  ├─ lib/                    # clientes de Supabase, formatos (FCFA, +240, fechas), planes, esquemas Zod
│  ├─ messages/es.json        # textos de la interfaz
│  └─ proxy.ts                # refresco de sesión de Supabase (en Next 16, proxy.ts sustituye a middleware.ts)
├─ supabase/
│  ├─ migrations/             # SQL escrito a mano y versionado
│  ├─ seed.sql                # categorías, atributos, ciudades, planes
│  └─ config.toml
├─ public/                    # manifest, iconos, sw.js
└─ docs/
```

El código (nombres de variables, tablas, columnas) va en inglés. Los segmentos de URL van en español.

## 4. Datos (visión general)

El modelo completo (columnas, enums, RLS, triggers, RPC, índices y borrado de cuenta) está en [MODELO-DATOS.md](MODELO-DATOS.md). Resumen de entidades:

- `profiles`: usuario, teléfono, nombre visible, ciudad, `role`, `premium_until`, `email_verified_at`, `show_whatsapp`, datos de tienda.
- `plans`: límites por plan (D-013) y precios por periodo (D-022), editables sin desplegar.
- `categories`, `category_attributes`, `cities`.
- `listings` (estado según ALCANCE §5.1, atributos en JSONB, `search_vector`) y `listing_images`.
- `conversations` (única por anuncio + comprador) y `messages`.
- `favorites`, `reports`, `blocks`.
- `premium_requests` (solicitudes pendientes de pago) y `premium_activations` (historial de cobros y activaciones, con método y referencia única: recibo o código de envío).
- `app_settings`: datos de la oficina, WhatsApp de pagos, beneficiario de los envíos y otros valores editables desde el admin.
- `push_subscriptions`, `email_verification_tokens`, `rate_limits`.

Criterios:
- **Premium se calcula, no se marca a mano:** un usuario es Premium si `premium_until > now()`. No hay un booleano que un proceso programado tenga que ir cambiando.
- **Las reglas críticas se aplican en la base de datos** (RLS y triggers), no solo en la interfaz: límites del plan, email confirmado para publicar, transiciones de estado y bloqueos.

## 5. Flujos clave

### 5.1 Registro, login y verificación (D-012)
- **Registro:**
  1. Una Server Action valida los datos con Zod.
  2. Llama a `auth.signUp` pasando usuario, teléfono y nombre como metadatos.
  3. Un trigger sobre `auth.users` crea el `profiles`. Los índices únicos de usuario y teléfono hacen que el registro falle si alguno ya existe.
- **Login:**
  1. Una Server Action mira qué ha escrito el usuario (si lleva `@` es un email, si son dígitos es un teléfono, y si no, un nombre de usuario).
  2. Si no es un email, busca el email asociado con una función SQL que solo puede llamar el servidor.
  3. Llama a `signInWithPassword` en el servidor y deja la sesión en cookies con `@supabase/ssr`.
  4. Si algo falla, devuelve un error genérico. El email nunca llega al cliente.
- **Verificación de email propia:**
  1. Se guarda un token (solo su hash), válido 24 h.
  2. Se envía un email con Resend.
  3. La ruta `/verificar-email` marca `email_verified_at`.
  4. Publicar exige que esté marcado; la RLS de `listings` lo comprueba.
- **Recuperar contraseña:**
  1. El servidor busca el email a partir del identificador.
  2. Crea el enlace con `auth.admin.generateLink({ type: "recovery" })`, que no envía nada, y manda el email por su cuenta.
  3. El enlace lleva a `/nueva-contrasena`, donde, al guardar la contraseña, se hace `verifyOtp` + `updateUser` (D-037).
  4. Se muestra el email enmascarado.
- **Límite de intentos:** contador propio por identificador e IP en `rate_limits`.

### 5.2 Imágenes
1. En el móvil, cada foto se recomprime con canvas en dos variantes WebP: grande (lado largo de 1600 px como máximo) y miniatura (480 px como máximo). Al recomprimir desaparecen los metadatos EXIF y el GPS.
2. Se sube directamente a Storage, a la ruta `listing-images/{user_id}/{listing_id}/…`, con reintento y barra de progreso. Una política de RLS solo permite escribir en la carpeta propia.
3. Se muestran con `<img>`, `srcset` (miniatura o grande), `loading="lazy"` y `width`/`height` fijados para que la página no salte. No se usa el optimizador de Vercel.
4. Las imágenes huérfanas (sin anuncio a las 24 h) se borran con un cron que usa la API de Storage.

### 5.3 Chat y notificaciones
- Una `conversation` por (anuncio, comprador). Los `messages` llevan texto o imagen y su estado de lectura.
- **Tiempo real:** un trigger con `realtime.broadcast_changes` emite cada mensaje a un canal privado por conversación y a otro canal por usuario (para la bandeja y los no leídos). La autorización se hace con RLS sobre `realtime.messages`.
- **Push:** al insertarse un mensaje, un Database Webhook llama a `/api/webhooks/new-message` (protegida con secreto), que envía la notificación push al destinatario. Las suscripciones caducadas (respuesta 410) se borran.
- **Email de respaldo:** un cron recoge los mensajes que llevan más de 15 minutos sin leer y envía un email agrupado, como máximo uno por hora y usuario.

### 5.4 Búsqueda
- `search_vector` = título (peso A) + descripción (peso B), con configuración `spanish` y `unaccent`. `unaccent` dentro de una columna generada necesita una función envoltorio `IMMUTABLE`. Índice GIN.
- `pg_trgm` sobre el título para tolerar errores de escritura.
- Índices de filtro sobre `(status, category_id, city_id, price, created_at)`, más un índice GIN sobre los atributos JSONB.
- Orden por relevancia: `ts_rank` más un plus para Premium.
- La paginación usa un cursor, no un `offset` numérico.

### 5.5 Tareas programadas

| Tarea | Herramienta | Frecuencia |
|---|---|---|
| Caducar anuncios activos vencidos | pg_cron (SQL) | Cada hora |
| Renovar automáticamente los anuncios de Premium | pg_cron (SQL) | Diaria |
| Al caducar Premium, pausar los anuncios que pasen del límite Normal | pg_cron (SQL) | Diaria |
| Email por mensajes sin leer | Vercel Cron → `/api/cron/...` | Cada 10–15 min (en producción, plan Pro) |
| Avisos: anuncio por caducar, Premium a 7 días de caducar | Vercel Cron | Diaria |
| Limpiar imágenes huérfanas y tokens caducados | Vercel Cron (API de Storage) | Diaria |

Las rutas de cron se protegen con `CRON_SECRET`. En desarrollo (plan Hobby, como mucho un cron al día) se lanzan a mano.

### 5.6 Caché, SEO y compartir
- Las páginas públicas se cachean con etiquetas (`listing:{id}`, `category:{id}`, `user:{id}`). Las Server Actions que modifican datos invalidan las etiquetas afectadas.
- `generateMetadata` genera el Open Graph con la foto grande, el título, el precio y la ciudad. También hay `sitemap.ts` dinámico y JSON‑LD de tipo `Product`/`Offer`.
- El teléfono y el email nunca aparecen en el HTML.

## 6. Entornos

| | Desarrollo | Previews (Vercel) | Producción |
|---|---|---|---|
| Next.js | Local (`pnpm dev`) | Vercel Preview | Vercel Production, funciones en `lhr1` |
| Supabase | Proyecto **dev** `xujlsrezhctlovncsywu` (Free, Irlanda `eu-west-1`) | El mismo proyecto dev | Proyecto **prod** (Pro, **Londres** `eu-west-2`), aún no creado |
| Email | Resend (modo de prueba) | Resend | Resend con `bklnmarketplace.com` verificado (DNS en Hostinger) |

- **En local las páginas irán más lentas que en producción**, porque el servidor de desarrollo está en Malabo y la base de datos en Londres. Las conclusiones de rendimiento se sacan en las previews, no en local.
- En las previews, las funciones (Londres) consultan la base de datos dev (Irlanda): unos 10 ms más por consulta, despreciable.
- Los proyectos Free se pausan tras 7 días sin actividad; se reactivan desde el panel de Supabase.
- **Migraciones:**
  - Se escriben a mano en `supabase/migrations/` y se aplican con `supabase db push`: primero en dev y en prod solo después de probarlas.
  - `supabase db diff` necesita Docker, así que no se usa.
  - Los tipos se generan con `supabase gen types typescript --linked`.
- **Secretos** en `.env.local` (nunca en el repo) y en las variables de entorno de Vercel. El repo lleva un `.env.example` sin valores.
- **Variables de Supabase:** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicas. `SUPABASE_SECRET_KEY` (la clave secreta nueva, que sustituye a la antigua `service_role`) es solo de servidor.
- **Nunca en variables `NEXT_PUBLIC_`:** `SUPABASE_SECRET_KEY`, la clave VAPID privada, la clave de Resend ni `CRON_SECRET`.
- **Configuración de Vercel en el repo:** al hacer el scaffold se fijan `framework: 'nextjs'` (el proyecto se creó sin framework) y `regions: ['lhr1']`.
- **Previews protegidas:** Vercel exige iniciar sesión para ver las previews (protección de despliegues). Para probarlas en móviles de otras personas habrá que usar enlaces para compartir o ajustar esa protección.

### DNS (Hostinger → Vercel)

El dominio principal es **`www.bklnmarketplace.com`**; la raíz redirige a `www` con un 308. Por eso, en producción, `NEXT_PUBLIC_SITE_URL=https://www.bklnmarketplace.com`. Valores que dio Vercel el 2026-10-16:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `216.198.79.1` |
| A | `@` | `64.29.17.1` (opcional; no se añadió) |
| CNAME | `www` | `e3fa906d10eeb920.vercel-dns-017.com` |

**Aplicado el 2026-10-16:** se sustituyeron los registros que Hostinger pone por defecto (`A @ → 2.57.91.91` y `CNAME www → bklnmarketplace.com`), con TTL de 300. Vercel da los dos dominios por bien configurados. No hay registros AAAA ni CAA que estorben. Los registros de Resend (SPF, DKIM) se añadirán al configurar el email.

## 7. Costes (aproximados, a confirmar al lanzar)

| | Desarrollo | Producción |
|---|---|---|
| Vercel | 0 (Hobby) | ~20 USD/mes (Pro) |
| Supabase | 0 (Free) | ~25 USD/mes (Pro) |
| Resend / Sentry | 0 (planes gratuitos) | 0 al principio |
| Dominio | — | ~10–15 USD/año |
| **Total** | **0** | **~45 USD/mes (~25–28.000 FCFA)** |

## 8. A comprobar al montar el proyecto

- [ ] Límites de ritmo de Supabase Auth cuando el login se hace desde el servidor: todas las peticiones salen de IPs de Vercel.
- [ ] Versión actual de Next.js y sus convenciones (`proxy.ts`, Cache Components).
- [ ] Al crear el proyecto de producción, elegir **explícitamente** Londres (`eu-west-2`). El selector genérico "Europa" puso el de desarrollo en Irlanda.
- [ ] La función `IMMUTABLE` envoltorio de `unaccent` para la columna generada de búsqueda.
