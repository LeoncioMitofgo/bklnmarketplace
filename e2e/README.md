# Pruebas de extremo a extremo

Scripts de Node que prueban cada parte de la web de verdad: la base de datos (RLS, triggers y RPC) y las pantallas en un Chromium móvil de 360 px (D-064). Cada comprobación imprime `OK` o `FALLO`, y el script termina con error si alguna falla.

## Antes de empezar

- **Contra qué prueban.** Usan el proyecto Supabase de `.env.local`, que **es el de producción** (D-067) mientras no exista uno de desarrollo.
  - Cada prueba crea sus propios usuarios (`…@bklnmarketplace.com`) y anuncios, y los borra al terminar.
  - `admin-catalog-browser-check` cambia la configuración compartida (planes, precios y oficina) y la deja como estaba.
  - Los cobros de Premium de las pruebas se quedan en `premium_activations`, sin usuario: es un registro que no se borra.
- **La web, siempre en local.** Las pruebas en la web de producción las hace el cliente. La base de datos, en cambio, sí es la de producción: lanzar solo las pruebas de lo que se ha tocado, y no lanzarlas con usuarios reales hasta tener el proyecto de desarrollo.
- **Variables.** Hacen falta las de `.env.local`: Supabase (URL, clave publicable y clave secreta) y VAPID para los avisos.
- **Navegador.**
  - Chromium: por defecto, el de `%LOCALAPPDATA%/ms-playwright/chromium-1234`. Otra ruta se indica con `E2E_CHROMIUM`. Si no hay ninguno: `pnpm exec playwright-core install chromium`.
  - `push-check` usa además el Google Chrome instalado, porque Chromium no tiene servicio de push.

## Cómo se lanzan

```sh
pnpm build
CRON_SECRET=prueba-local-cron pnpm start -p 3100   # en otra terminal; el secreto es para premium-reminder-check
pnpm e2e todas                                     # todas menos push-check, una detrás de otra
pnpm e2e moderation-browser-check                  # una sola
pnpm e2e push-check                                # la de avisos push, aparte
```

`monitoring-check` también va aparte: levanta un Sentry de prueba en el puerto 4999 y necesita la web compilada y arrancada con su DSN:

```sh
SENTRY_DSN=http://e2e@localhost:4999/1 pnpm build
SENTRY_DSN=http://e2e@localhost:4999/1 CRON_SECRET=prueba-local-cron pnpm start -p 3100
pnpm e2e monitoring-check
```

- `pnpm e2e` sin nada lista las pruebas.
- Otra dirección: `E2E_BASE_URL=http://localhost:3000`.
- Las fotos, capturas y perfiles temporales del navegador van a la carpeta temporal del sistema (`bkln-e2e`).
- Para que `pnpm build` no falle, para antes el servidor de `pnpm start`.

## Qué prueba cada una

| Prueba | Qué cubre |
|---|---|
| `auth-db-check` | Registro, perfil, usuario reservado y teléfono único, teléfono privado, verificación de email propia, recuperación y borrado en cascada (1.1). `--keep` deja el usuario; `--cleanup <usuario>` lo borra |
| `listings-db-check` | Anuncios: borrador, fotos en Storage, publicar, límites y caducidad del plan, estados y RLS (1.2) |
| `listings-pages-check` | Mis anuncios con sesión: el anuncio, el precio de alquiler y el uso del plan (1.2) |
| `catalog-check` | Inicio, búsqueda, filtros, orden, ficha, perfil, favoritos, SEO y Open Graph (1.3) |
| `catalog-browser-check` | Lo interactivo del catálogo en el navegador: "Ver más", hoja de filtros, atrás de Android, favorito sin sesión → entrar → vuelta (1.3) |
| `chat-db-check` | Conversaciones, mensajes, fotos, no leídos, bloqueos y canales privados de Realtime (1.4) |
| `chat-browser-check` | Chat entre dos navegadores a la vez: bandeja, mensajes y fotos en directo, "Visto", borrador, bloquear y WhatsApp (1.4) |
| `push-check` | Avisos push con Chrome: suscribirse, envío del servidor aceptado por FCM y notificación del service worker (1.4) |
| `moderation-db-check` | Denuncias, auto‑ocultado a las 3, términos prohibidos y borrar la cuenta (1.5) |
| `moderation-browser-check` | Denunciar un anuncio y una conversación, términos, privacidad y borrar la cuenta (1.5) |
| `premium-admin-db-check` | Solicitudes de Premium y las RPC del panel: activar, bloquear, restaurar, suspender y banear (1.6) |
| `premium-admin-browser-check` | `/premium` y el panel `/admin`: pagos, denuncias con el chat denunciado, y suspender y banear usuarios (1.6); el panel en un portátil (D-071) y las métricas de validación (D-072) |
| `profile-browser-check` | Editar el perfil con foto y el acceso (email, teléfono y contraseña) (1.6) |
| `store-browser-check` | Tienda Premium `/t/<tienda>` y su editor (1.6) |
| `admin-catalog-browser-check` | Categorías, ciudades, planes, precios y oficina en el panel (1.6) |
| `premium-reminder-check` | Cron diario y aviso de Premium por caducar, en la web y por push (1.6) |
| `storage-cleanup-check` | Limpieza de Storage en modo prueba (`/api/cron/daily?dry=1`): deja lo que se usa y las subidas recientes, y borraría lo de anuncios borrados hace 40 días y lo de anuncios y cuentas que no existen (D-073). No borra nada |
| `brand-check` | Iconos, manifiesto, Open Graph, logo y que Chrome pueda instalar la web (1.7) |
| `monitoring-check` | Errores a Sentry (D-072): `/api/errors` solo desde nuestras páginas, un error del navegador llega una sola vez, sin la query ni cookies, y los cortes de conexión no se mandan (1.7) |

## Al escribir una nueva

- Lo común está en `lib.mjs`:
  - `env` y `createClient`;
  - `chromium` y `CHROMIUM_PATH`;
  - `ok(etiqueta, condición, detalle)` para cada comprobación, `crash(error)` si hay una excepción y `finish()` al final;
  - `watchErrors(página, errores)`, que recoge los errores de JavaScript y las peticiones fallidas.
- El nombre del fichero termina en `-check.mjs` para que `pnpm e2e` lo encuentre.
- Next 16 deja montadas y ocultas las páginas anteriores. Por eso:
  - los elementos se buscan filtrando los visibles: `.filter({ visible: true }).first()`;
  - antes de leer el contenido de una pantalla, se espera a un texto suyo, porque llega en streaming.
- La limpieza va en un `finally`, para que se haga aunque la prueba falle.
