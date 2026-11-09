# Roadmap — BKLN Marketplace

**Estado: Fase 1 en curso** (1.1 a 1.6 hechas; 1.7, lanzamiento, en curso: marca nueva, web instalable y pruebas de extremo a extremo hechas). Marca cada casilla al completarla (con fecha si es un hito).

---

## Fase 0 — Definición

- [x] Alcance y tipo de proyecto → [ALCANCE.md](ALCANCE.md) (2026-10-16)
- [x] Stack → D-015 a D-020 y [ARQUITECTURA.md](ARQUITECTURA.md) (2026-10-16)
- [x] Método de registro e inicio de sesión → D-012 (2026-10-16)
- [x] Límites por plan y duración de los anuncios → D-013 (2026-10-16)
- [x] Listas iniciales de ciudades y categorías → D-014 (2026-10-16)
- [x] Precios y método de pago de Premium → D-022, D-023 (2026-10-16)
- [x] Dirección de la oficina y pago fuera de Malabo → D-025 (2026-10-16)
- [x] Horario de la oficina (2026-10-16)
- [x] Beneficiario de los envíos por agencia: BKLN Marketplace (2026-10-16)
- [x] Nombre y dominio: BKLN Marketplace, `bklnmarketplace.com` → D-026 (2026-10-16)
- [x] Identidad visual: logo, colores y tipografía → [IDENTIDAD.md](IDENTIDAD.md), D-031 y D-032 (2026-10-16)
- [x] Wireframes mobile (13 pantallas) → lienzo enlazado en IDENTIDAD.md, D-033 (2026-10-16)
- [x] Modelo de datos → [MODELO-DATOS.md](MODELO-DATOS.md) y D-027 a D-030 (2026-10-16)
- [x] Repositorio git (2026-10-16)
- [x] Proyectos creados: GitHub, Supabase dev y Vercel (2026-10-16)
- [x] `supabase init` + `supabase link` con el proyecto dev (2026-10-16)
- [x] Proyecto de Vercel conectado al repo de GitHub, con los dominios `bklnmarketplace.com` y `www` añadidos (2026-10-16)
- [x] Acceso de Claude a Vercel con el conector MCP (2026-10-16)
- [x] Vercel: variables públicas, más `framework: nextjs` y región `lhr1` en `vercel.ts` (2026-10-16)
- [x] Vercel: `SUPABASE_SECRET_KEY` (2026-10-16, la añadió el usuario). Está como *Encrypted*: conviene recrearla como *Sensitive*
- [x] DNS en Hostinger apuntando a Vercel (2026-10-16)
- [x] Resend: cuenta, `RESEND_API_KEY` en Vercel y dominio verificado en Hostinger (2026-11-03, lo hizo el usuario). Los emails de confirmación y de recuperar la contraseña ya salen en producción y se confirman bien

## Fase 1 — MVP

### 1.1 Base
- [x] Proyecto inicial (2026-10-16):
  - Next.js 16 con Cache Components e i18n `es`.
  - Tokens de IDENTIDAD.
  - Utilidades de formato (FCFA, +240, Africa/Malabo) con tests.
  - Clientes de Supabase y proxy de sesión.
  - Página "Próximamente".
- [x] Layout mobile con barra inferior en las pantallas de la app (2026-10-16). `/buscar`, `/publicar` y `/mensajes` llegan en 1.2–1.4
- [x] Registro (`/registro`) y login (`/entrar`) con usuario, email o teléfono + contraseña (2026-10-16)
- [x] Confirmación de email propia (`/verificar-email`), recuperación de contraseña (`/recuperar` → `/nueva-contrasena`) y límite de intentos (2026-10-16)
- [x] Perfil público `/u/<usuario>` (cacheado), `/cuenta` y vuelta al punto de origen tras el login (2026-10-16)
- [x] Capa de datos de auth probada de extremo a extremo contra el proyecto dev: 22 comprobaciones de registro, login, RLS, tokens, límites y recuperación (2026-10-16)
- [ ] Probar los formularios en el navegador (lo hace el usuario): registro, entrar con usuario, email o teléfono, y recuperar la contraseña. Resend ya envía los emails desde el 2026-11-03; en local (`pnpm dev`) se escriben en la terminal
- [x] Configuración de planes: tablas `plans` y `plan_prices` + `current_plan()` (2026-10-16)
- [x] Datos iniciales: 13 categorías, 49 subcategorías, 40 atributos, 16 ciudades y ajustes (2026-10-16)
- [x] Base de datos de usuarios (2026-10-16):
  - `profiles`, `profile_private` y `stores` con RLS y permisos por columna.
  - Trigger de registro.
  - `resolve_login_email()`, que solo puede ejecutar el servidor.

### 1.2 Anuncios
- [x] Asistente de publicación (2026-10-16), en `/publicar` → `/publicar/[id]`:
  - 4 pasos.
  - Fotos comprimidas en el móvil, subidas con progreso real y con opción de reintentar.
  - Borrador en la base de datos y atributos según la categoría.
- [x] Mis anuncios (`/mis-anuncios`): pestañas por estado, editar, pausar/reactivar, vendido, renovar y eliminar (2026-10-16)
- [x] Caducidad automática y renovación automática Premium con pg_cron, más el reajuste diario de límites (2026-10-16)
- [x] Avisos de caducidad por email (2026-11-04, D-074): en el cron diario, un email por vendedor con sus anuncios por caducar (últimos 3 días) y los recién caducados, sin repetir ni escribir a Premium con renovación automática. Probado con `listing-expiry-check`
- [x] Control de límites por plan, aplicado en la base de datos (2026-10-16): anuncios activos, fotos, duración y ritmo diario
- [x] Capa de datos de anuncios probada de extremo a extremo (2026-10-16): 37 comprobaciones de la base de datos y 11 de páginas con sesión
- [x] Probar en el móvil el asistente completo y la subida de fotos en Android (2026-10-16): primer anuncio real, 3 fotos WebP de 14–127 KB
- [ ] Probar la subida de fotos en un iPhone (JPEG)
- [x] Limpieza programada de los ficheros de Storage de anuncios borrados y de fotos huérfanas (2026-11-04, D-073): en el cron diario; ficheros sin uso de más de 24 h, fotos de anuncios borrados hace más de 30 días y restos de cuentas borradas, con un freno si saldrían demasiados. Probado con `storage-cleanup-check` en modo prueba

### 1.3 Catálogo público
- [x] Home: categorías, destacados Premium, recientes (2026-10-16). Sustituye a "Próximamente" (D-044)
- [x] Búsqueda, filtros y orden (2026-10-16):
  - `/buscar` y `/categoria/<slug>`, con la RPC `search_listings`.
  - Filtros en la URL y en una hoja que funciona sin JavaScript (D-045).
  - "Ver más" sin scroll infinito (D-041).
- [x] Ficha de anuncio (`/anuncio/<título-ciudad>-<código>`), compartir (menú del móvil o WhatsApp) con Open Graph, contador de vistas y anuncios similares (2026-10-16). El chat y el botón de WhatsApp llegan en 1.4
- [x] Perfil público del vendedor con sus anuncios en venta y vendidos recientes (2026-10-16)
- [x] Favoritos: corazón en la ficha y `/favoritos`, que indica si se vendió, se pausó o caducó (2026-10-16, D-042)
- [x] SEO: URLs legibles, canonical, sitemap y JSON-LD Product/Offer (2026-10-16). La indexación queda bloqueada hasta el lanzamiento (D-043)
- [x] Probado de extremo a extremo (2026-10-16): 53 comprobaciones de base de datos y páginas, más 29 en un navegador móvil real a 360 px (hoja de filtros, "Ver más", atrás, favorito sin sesión → entrar → vuelta)
- [ ] Probar en el móvil el inicio, la búsqueda, los filtros, la ficha y los favoritos (lo hace el usuario)

### 1.4 Contacto
- [x] Chat en tiempo real por anuncio, con texto y fotos, "Visto", borrador guardado y respuestas rápidas en el primer mensaje (2026-10-17, D-048)
- [x] Bandeja `/mensajes` (Todos, Comprando y Vendiendo), no leídos en la bandeja y en la barra inferior, y bloquear desde la conversación (2026-10-17). Reportar pasa a 1.5, junto con la tabla de denuncias
- [x] Barra fija de la ficha con Chatear y WhatsApp opcional, solo con sesión. El teléfono se pide al pulsar y tiene un tope diario (2026-10-17, D-049 y D-050). Se activa en Mi cuenta
- [x] Tiempo de respuesta del vendedor (pg_cron diario) en la conversación, la ficha y el perfil (2026-10-17)
- [x] Probado de extremo a extremo (2026-10-17): 51 comprobaciones de base de datos y tiempo real, y 23 con dos navegadores móviles a la vez (comprador y vendedora)
- [x] Notificaciones push web (2026-10-17, D-051):
  - Invitación a activarlas en la bandeja y en la conversación, y ajuste en Mi cuenta.
  - Aviso con el nombre y el mensaje, que abre la conversación.
  - Al cerrar sesión se da de baja el móvil.
  - Probado con Chrome real: el servidor envía y FCM acepta; el service worker muestra el aviso.
- [x] Claves VAPID en Vercel (Production) y nuevo despliegue (2026-10-17). Comprobado contra bklnmarketplace.com: FCM acepta los avisos firmados por el servidor
- [ ] Probar los avisos push en iPhone (lo hace el usuario): solo funcionan con la web instalada en la pantalla de inicio, posible desde la 1.7 (D-063), en iOS 16.4 o posterior
- [x] Email de respaldo por mensajes sin leer (2026-11-04, D-076): `/api/cron/unread`, con un email agrupado si un mensaje lleva más de 15 minutos sin leer, como mucho uno por hora. Probado con `unread-email-check`
  - [ ] Programarlo cada 15 minutos en `vercel.ts` al pasar a Vercel Pro (Hobby no lo permite)
- [ ] Probar el chat en el móvil entre dos cuentas (lo hace el usuario)

### 1.5 Confianza y moderación
- [x] Denuncias con auto‑ocultado (2026-10-17, D-053):
  - "Denunciar este anuncio" en la ficha y "Denunciar a…" en el menú del chat, con la opción de bloquear a la vez.
  - Con 3 denuncias abiertas de usuarios distintos, el anuncio pasa a "En revisión" y desaparece de las páginas públicas al momento. Queda apuntado en `moderation_log`.
  - Tope de 20 denuncias al día por usuario.
- [x] Lista de contenido y palabras prohibidas (2026-10-17, D-056): se comprueba por palabras completas y la lista inicial es más amplia. El vendedor ve la lista en los términos, enlazada desde el último paso de publicar
- [x] Límites de ritmo (publicación y chat): hechos en 1.2 y 1.4, más el de denuncias
- [x] Avisos anti‑estafa (ficha + chat): hechos en 1.3 y 1.4
- [x] Términos de uso (`/terminos`) y política de privacidad (`/privacidad`), enlazados desde el registro, Mi cuenta y el pie del inicio (2026-10-17, D-056)
- [x] Borrar la cuenta desde Mi cuenta, con la contraseña (2026-10-17, D-055):
  - Se borran en el momento su perfil, sus anuncios y sus fotos de Storage.
  - Se invalida la caché de su perfil y de sus anuncios.
- [x] Corregido: entrar desde una pantalla con sesión (Mensajes, Perfil…) devolvía otra vez a `/entrar`. Ahora el proxy redirige a entrar antes de montar la página (D-054)
- [x] Probado de extremo a extremo (2026-10-17): 54 comprobaciones de base de datos y 43 en un navegador móvil a 360 px. Se repitieron las pruebas de navegador del catálogo y del chat
- [ ] Revisar los textos legales (los escribió Claude y son provisionales; lo hace el cliente): edad mínima de 18 años y email de contacto `hello@bklnsoftware.tech`
- [ ] Probar en el móvil denunciar, bloquear y borrar una cuenta de prueba (lo hace el usuario)

### 1.6 Premium y administración
- [x] "Hazte Premium" en `/premium` (2026-10-17, D-057):
  - Comparativa Normal/Premium y precios por periodo, con el precio por mes y el ahorro. Todo sale de la configuración.
  - Formas de pago y solicitud, que se puede cambiar o cancelar. Botón de WhatsApp con el usuario, el periodo y el importe.
  - Se llega desde Mi cuenta ("Hazte Premium" o "Renovar").
- [x] Panel admin en `/admin`, usable desde el móvil (2026-10-17, D-057):
  - Resumen con las colas y las métricas básicas.
  - Pagos por confirmar y últimos cobros.
  - Denuncias: bloquear, restaurar o descartar; leer el chat denunciado, con sus fotos.
  - Usuarios: buscar, Premium, suspender y banear (también en Supabase Auth), con historial.
- [x] Activación y ampliación de Premium con registro de pagos (2026-10-17):
  - Referencia única por forma de pago; el tiempo nuevo se suma al periodo actual.
  - Cierra la solicitud y avisa al usuario por push.
- [x] Avisos push: Premium activado y anuncio bloqueado por moderación (2026-10-17)
- [x] Probado de extremo a extremo (2026-10-17): 57 comprobaciones de base de datos y 37 en navegador. Se repitieron las pruebas de navegador del catálogo, el chat y la 1.5
- [x] Rol de admin para la cuenta del cliente, `julio_nkulu` (comprobado el 2026-11-03; se da con SQL: `profile_private.role = 'admin'`)
- [x] Panel admin, catálogo y ajustes (2026-11-03, D-060):
  - Pestaña "Catálogo": categorías y subcategorías (crear, editar, ordenar y desactivar), sus atributos (crear, editar y eliminar) y ciudades.
  - Pestaña "Ajustes": límites de los planes, precios de Premium (añadir o retirar periodos), datos de la oficina, términos prohibidos y denuncias para ocultar.
  - Probado en un navegador móvil: 26 comprobaciones, dejando la configuración como estaba.
- [x] Editar el perfil y los datos de la cuenta (2026-11-03, D-058):
  - `/cuenta/perfil`: foto (recortada y reducida en el móvil), nombre, usuario, ciudad y descripción.
  - `/cuenta/acceso`: email (hay que volver a confirmarlo), teléfono y contraseña. Cada cambio pide la contraseña actual; cambiar la contraseña cierra la sesión en los demás dispositivos.
  - La foto sale en Mi cuenta, en el perfil público y en la ficha del anuncio.
  - Probado en un navegador móvil: 28 comprobaciones.
- [x] Tienda Premium `/t/<tienda>` (2026-11-03, D-059):
  - Se edita en `/cuenta/tienda`: nombre, dirección web, descripción, dirección, horario, logo y portada.
  - La página pública tiene portada, logo, insignia, horario y dirección, y las pestañas "En venta" y "Vendidos". Se puede compartir, con Open Graph, y está en el sitemap. El WhatsApp solo aparece con sesión.
  - Enlazada desde la ficha ("Ver su tienda"), el perfil y Mi cuenta.
  - Si caduca Premium, deja de verse y sus datos se conservan.
  - Probada en un navegador móvil: 24 comprobaciones.
- [x] Caducidad de Premium (2026-11-03, D-061):
  - Aviso en Mi cuenta y en Mis anuncios en la última semana ("caduca en N días · Renovar Premium") y durante 30 días después de caducar, explicando la pausa de los anuncios que sobran y que la tienda no se borra.
  - Aviso push 7 días antes con un cron diario de Vercel (`/api/cron/daily`, a las 9:00 en Malabo), una vez por periodo (`notification_log`).
  - La vuelta a Normal y el pausado de los anuncios que sobran ya los hacía el cron `enforce_plan_limits` (1.2), y la tienda deja de verse por su RLS.
  - Probado: 11 comprobaciones del cron y de los avisos.
- [x] `CRON_SECRET` en Vercel (Production, *Sensitive*) y nuevo despliegue, hechos por el usuario (2026-11-03)

### 1.7 Lanzamiento
Previsto para **enero de 2027** (D-068).
- [x] Pruebas de extremo a extremo en el repo (2026-11-04, D-064): `e2e/`, con `pnpm e2e todas`. Se recuperaron del historial las que se habían borrado; son 17 scripts. Por separado pasan; en la batería completa fallaron tres por tiempos de espera (chat, moderación y panel de Premium)
- [x] Marca nueva (2026-11-03, D-063): la "b" con la etiqueta de precio, que diseñó el cliente con ChatGPT y se redibujó en SVG. Logo de la web, favicon, iconos de la app (Android e iPhone), icono de las notificaciones e imagen para compartir. SVG maestros en `docs/marca/`
- [x] La web se puede instalar en el móvil (2026-11-03, D-063): manifiesto con nombre, colores e iconos. Chrome la da por instalable (comprobado con su herramienta de depuración)
- [ ] Probar en el móvil (lo hace el usuario): añadir a la pantalla de inicio en Android y en iPhone, el icono de una notificación y la vista previa de un enlace en WhatsApp
- [x] Analítica básica y monitorización de errores (2026-11-04, D-072):
  - Visitas y búsquedas en Vercel Web Analytics, enlazado desde el panel.
  - «Validación del mercado» en el resumen del panel: % de anuncios con mensajes, tiempo de respuesta, usuarios activos y los que vuelven, y Premium (ALCANCE §9).
  - Errores del servidor y del navegador a Sentry, sin su SDK ni scripts de terceros, y sin la query ni datos personales. Probado con `monitoring-check` (11 comprobaciones) contra un Sentry de prueba.
  - [x] Cuenta gratuita de Sentry, proyecto `bkln-marketplace` y `SENTRY_DSN` en Vercel (Production), con un despliegue nuevo, hechos por el cliente (2026-11-04). Comprobado con un error de prueba del servidor y otro del navegador: llegan a Sentry y el aviso por email también
- [x] Recortar el JavaScript de primera carga de las páginas públicas (2026-11-04, D-075): de 153,6 a 144,9 KB comprimidos, al precompilar los mensajes de next-intl. React y el router de Next son unos 125 KB; Analytics y el aviso de errores ocupan 2 KB y se quedan
- [ ] Pruebas en Android de gama baja con red lenta
- [x] Aviso de versión previa (2026-11-04, D-066): se quita solo al abrir la indexación
- [x] Categoría «Oficina y papelería» con tres subcategorías (2026-11-04, D-070)
- [x] Página «Todas las categorías» (`/categorias`), a la que lleva el «Ver todas» del inicio (2026-11-05, D-077)
- [x] Alimentación separada de Agricultura, con Panadería y pastelería y Comida preparada (2026-11-05, D-078)
- [x] Anuncios por encargo (2026-11-05, D-079): «¿Lo tienes ya?» y el plazo al publicar, la insignia «POR ENCARGO», «Por encargo · plazo» en la ficha, un aviso de seguridad propio en la ficha, el chat y la revisión, y los términos. Migración `20261105120000_order_listings.sql`, probada antes en el proyecto de desarrollo. Prueba: `order-check`
  - [x] Probarlo en el móvil (2026-11-05, el usuario): publicó un anuncio por encargo y todo bien
- [x] Panel de admin adaptado al ordenador: menú lateral y páginas a dos columnas (2026-11-04, D-071)
- [x] El proyecto de Supabase actual es el de producción (2026-11-04, D-067). Funciones de Vercel en Dublín (`dub1`)
- [x] Estabilizar las pruebas e2e que fallaban en la batería completa (2026-11-04). Todas entraban desde `::1` y, al acumularse los logins, saltaba el límite de 30 por IP cada 15 minutos: ahora cada prueba usa su propia IP (`TEST_IP` en `e2e/lib.mjs`). También se corrigieron cuatro comprobaciones que miraban antes de tiempo (contenido en streaming o borrador que vuelve al hidratar) o sin await. La batería completa pasa (18 pruebas)
- [ ] Sembrar anuncios con vendedores y tiendas fundadoras, con 6 meses de Premium gratis, visibilidad y publicidad (D-065). Empresas, emails y correos en [LANZAMIENTO-CONTACTOS.md](LANZAMIENTO-CONTACTOS.md) (2026-11-04), con medios, agencias y patrocinio para el lanzamiento
  - [x] Propuesta personalizada en PDF y mensaje para cada tienda (2026-11-04): CFAO Motors, Jetour, Casa Mercedes, RYESA, Cuattro, Rock & Noble, Inmo-GUINEA, KITEA, Unicasa y The Computer Store; y GENSE Inmobiliaria el 2026-11-05. Se generan con el sistema de propuestas de `C:/Users/leonc/PlanEject` (`propuestas/fuentes/marketplace-*.md`)
  - [ ] Cuando publique la primera tienda fundadora, cambiar el aviso de versión previa a «Muchos anuncios son de demostración…» (`preview.notice` en `es.json`, D-066)
  - [x] Enviar las propuestas por WhatsApp y email, y el correo a AVANTE (2026-11-04, lo hizo el cliente desde hello@bklnsoftware.tech)
  - [ ] Seguimiento: recordatorio a los 7–10 días, mensaje a mediados de diciembre y el día de la apertura a principios de enero
  - [ ] Activar Premium a cada tienda que diga que sí: 0 FCFA, referencia `FUNDADORA-<empresa>`, los meses hasta la apertura más 6 (D-065)
- [x] Propuestas de patrocinio personalizadas (2026-11-04, D-069): Muni, GETESA, BANGE, Martínez Hermanos, Ventage Group, Afri Mall, Galería JM & Hermanos y Viteoca Market
  - [ ] Enviarlas a partir del 18 de noviembre (lo hace el cliente; correos en LANZAMIENTO-CONTACTOS)
  - [ ] Pie «Con el apoyo de» con los logos, cuando firme el primer patrocinador
- [ ] Acto de presentación en Malabo (enero de 2027): fecha, sala (Galambo, Centro Cultural de España u hotel) e invitados
- [ ] Limpiar los restos de pruebas e2e fallidas en producción, con el visto bueno del cliente: cuentas `pnav+…` y `perfil+…`, las denuncias abiertas que dejaron, anuncios bloqueados «Móvil revisado…» y cobros de prueba de Premium
- [ ] Decidir si se quedan los anuncios de prueba del cliente («Coche en venta», «Camisa y Chaleco», «POS en venta…»): no son de demostración y no se borran con ellas
- [ ] Antes de abrir, borrar las cuentas de demostración (D-047): son las de `user_metadata.demo = true` en Supabase Auth; al borrarlas desaparecen sus anuncios, y sus fotos hay que quitarlas de Storage (si se borran desde el panel de Supabase, el cron las quita al día siguiente, D-073; como son muchas, puede saltar el freno y habrá que borrarlas a mano)
- [ ] Supabase Pro en el proyecto actual y Vercel Pro, antes de abrir (D-067). Con Vercel Pro, programar el cron de mensajes sin leer (D-076). Antes, mover el proyecto de la web de BKLN a una organización gratuita: en Pro, cada proyecto de la organización paga su cómputo
- [x] Proyecto de Supabase de desarrollo (2026-11-05, D-067): «BKLNMarketplace-dev» (`ioqnwiuuquekpybpwvlt`), en Irlanda y gratis, con todas las migraciones. Sus claves están en `.env.dev`. En el plan gratuito solo caben 2 proyectos activos: para usarlo hay que pausar «Bkln-software» (el formulario de la web), y al terminar, al revés
  - [ ] Copiar a desarrollo el catálogo de producción (categorías cambiadas a mano: Oficina y papelería, Alimentación…): sin eso, `catalog-check` da 6 fallos allí
- [ ] Abrir la indexación: `SITE_INDEXABLE=true` en las variables de producción de Vercel (D-043)
- [ ] Despliegue en producción

### En paralelo: proveedores de pago (prepara la fase 3)
Detalle, contactos y correos en [PAGOS-PROVEEDORES.md](PAGOS-PROVEEDORES.md).
- [x] Investigar Rosa Money, Muni Dinero y Bonafide Microbank (B-Morï) (2026-11-03)
- [ ] Conseguir el email de Bonafide Microbank (su web solo se abre en el navegador; también LinkedIn o X)
- [ ] Enviar los correos desde hello@bklnsoftware.tech (lo hace el cliente): presentarnos como programadores de la plataforma y preguntar por cuenta de comercio, API, requisitos y comisiones
- [ ] Con las respuestas, elegir proveedor (DECISIONES, pendientes) y empezar por cobrar Premium en la web

## Fase 2 — Crecimiento

- [ ] Valoraciones ligadas a una conversación real: lo primero tras la apertura (D-080)
- [ ] Seguir tiendas, con aviso por push cuando publican (D-080)
- [ ] Estadísticas por anuncio (Premium)
- [ ] Respuestas rápidas en el chat (Premium)
- [ ] Verificación de vendedores (insignia "Verificado")
- [ ] Verificación de teléfono (OTP por SMS o WhatsApp) y recuperación de contraseña por teléfono
- [ ] Alertas de búsqueda guardada
- [ ] Categoría Empleo
- [ ] Francés
- [ ] Modo sin conexión básico (instalable ya desde la 1.7, D-063) y botón propio de "Instalar"
- [ ] Aviso de mensajes nuevos por WhatsApp/SMS

## Fase 3 — Plataforma

- [ ] Pagos dentro de la app (Rosa Money, Muni Dinero, B-Morï de Bonafide Microbank, transferencia bancaria) y pago automático de Premium
- [ ] Envíos / integración con delivery
- [ ] App móvil
- [ ] Expansión CEMAC
