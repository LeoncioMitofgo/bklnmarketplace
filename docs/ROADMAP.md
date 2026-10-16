# Roadmap — BKLN Marketplace

**Estado: Fase 0 en curso.** Marca cada casilla al completarla (con fecha si es un hito).

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
- [ ] Vercel: `SUPABASE_SECRET_KEY`, que añade el usuario en el panel como *Sensitive*
- [x] DNS en Hostinger apuntando a Vercel (2026-10-16)
- [ ] Resend: cuenta, `RESEND_API_KEY` (en `.env.local` y en Vercel) y dominio verificado con sus registros DNS en Hostinger. Hasta entonces, fuera de producción los emails se escriben en la consola del servidor

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
- [ ] Probar los formularios en el navegador (lo hace el usuario). Los emails de verificación y recuperación solo salen cuando se configure Resend; en local (`pnpm dev`) se escriben en la terminal
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
- [ ] Avisos de caducidad por email (cuando se configure Resend; Vercel Cron)
- [x] Control de límites por plan, aplicado en la base de datos (2026-10-16): anuncios activos, fotos, duración y ritmo diario
- [x] Capa de datos de anuncios probada de extremo a extremo (2026-10-16): 37 comprobaciones de la base de datos y 11 de páginas con sesión
- [ ] Probar en el móvil la subida de fotos (compresión real en Android e iPhone) y el asistente completo (lo hace el usuario)
- [ ] Limpieza programada de los ficheros de Storage de anuncios borrados y de fotos huérfanas (Vercel Cron)

### 1.3 Catálogo público
- [ ] Home: categorías, destacados Premium, recientes
- [ ] Búsqueda, filtros y orden
- [ ] Ficha de anuncio, compartir con Open Graph y anuncios similares
- [ ] Perfil público del vendedor
- [ ] Favoritos
- [ ] SEO: URLs, sitemap, datos estructurados

### 1.4 Contacto
- [ ] Chat en tiempo real por anuncio (texto e imagen)
- [ ] Bandeja de mensajes, no leídos, bloquear, reportar
- [ ] Botón WhatsApp/llamar opcional (solo con sesión)
- [ ] Notificaciones: push web + email de respaldo

### 1.5 Confianza y moderación
- [ ] Reportes con auto‑ocultado por umbral
- [ ] Lista de contenido y palabras prohibidas
- [ ] Límites de ritmo (publicación y chat)
- [ ] Avisos anti‑estafa (ficha + chat)
- [ ] Términos, privacidad y borrar cuenta. Al borrar hay que invalidar la caché `profile:<usuario>`; si no, el perfil público sigue visible hasta que caduca

### 1.6 Premium y administración
- [ ] Página "Hazte Premium": precios por periodo, formas de pago, solicitud y botón de WhatsApp para el código del envío
- [ ] Panel admin: reportes, usuarios, categorías/atributos, ciudades, métricas
- [ ] Activación y extensión de Premium con registro de pagos
- [ ] Tienda personalizada `/t/<slug>`
- [ ] Caducidad de Premium: aviso, vuelta a Normal, pausado automático de los anuncios que sobran

### 1.7 Lanzamiento
- [ ] Analítica básica y monitorización de errores
- [ ] Pruebas en Android de gama baja con red lenta
- [ ] Sembrar anuncios con vendedores y tiendas fundadoras
- [ ] Proyecto Supabase de producción (Pro, Londres) y Vercel Pro. **Cambiar las variables de producción de Vercel al proyecto nuevo** (D-036)
- [ ] Despliegue en producción

## Fase 2 — Crecimiento

- [ ] Estadísticas por anuncio (Premium)
- [ ] Respuestas rápidas en el chat (Premium)
- [ ] Valoraciones ligadas a una conversación real
- [ ] Verificación de vendedores (insignia "Verificado")
- [ ] Verificación de teléfono (OTP por SMS o WhatsApp) y recuperación de contraseña por teléfono
- [ ] Alertas de búsqueda guardada
- [ ] Categoría Empleo
- [ ] Francés
- [ ] PWA instalable y modo sin conexión básico
- [ ] Aviso de mensajes nuevos por WhatsApp/SMS

## Fase 3 — Plataforma

- [ ] Pagos dentro de la app (Rosa Money, transferencia bancaria) y pago automático de Premium
- [ ] Envíos / integración con delivery
- [ ] App móvil
- [ ] Expansión CEMAC
