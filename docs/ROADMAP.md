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
- [ ] Registros DNS de Resend (email), cuando se configure el email

## Fase 1 — MVP

### 1.1 Base
- [x] Proyecto inicial (2026-10-16):
  - Next.js 16 con Cache Components e i18n `es`.
  - Tokens de IDENTIDAD.
  - Utilidades de formato (FCFA, +240, Africa/Malabo) con tests.
  - Clientes de Supabase y proxy de sesión.
  - Página "Próximamente".
- [ ] Layout mobile con barra inferior (llega con las primeras pantallas reales)
- [ ] Registro (nombre, usuario, teléfono, email, contraseña) y login con usuario/email/teléfono + contraseña
- [ ] Confirmación de email, recuperación de contraseña por email y límite de intentos
- [ ] Perfil de usuario `/u/<usuario>` y vuelta al punto de origen tras el login
- [x] Configuración de planes: tablas `plans` y `plan_prices` + `current_plan()` (2026-10-16)
- [x] Datos iniciales: 13 categorías, 49 subcategorías, 40 atributos, 16 ciudades y ajustes (2026-10-16)
- [x] Base de datos de usuarios (2026-10-16):
  - `profiles`, `profile_private` y `stores` con RLS y permisos por columna.
  - Trigger de registro.
  - `resolve_login_email()`, que solo puede ejecutar el servidor.

### 1.2 Anuncios
- [ ] Asistente de publicación con compresión de fotos en el dispositivo, borrador y atributos por categoría
- [ ] Mis anuncios: editar, pausar/reactivar, vendido, renovar, eliminar
- [ ] Caducidad automática y avisos de caducidad
- [ ] Control de límites por plan

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
- [ ] Términos, privacidad y borrar cuenta

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
