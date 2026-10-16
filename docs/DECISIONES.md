# Registro de decisiones — BKLN Marketplace

Formato: `D-NNN · fecha · decisión · motivo`. Cuando se resuelva una pendiente, se pasa a "Tomadas" con un número nuevo.
Si una decisión se revierte, no se borra: se marca como ~~sustituida~~ y se enlaza la nueva.

---

## Pendientes

_Ninguna decisión de negocio pendiente (2026-10-16)._

## Tomadas

- **D-001 · 2026-10-16** · Producto: clasificados **generalista tipo Jiji** (C2C + B2C) con perfiles de vendedor tipo Vinted. **Web mobile first**, sin app nativa por ahora. · Lo pide el mercado de GE; es más rápido validar con una web.
- **D-002 · 2026-10-16** · **Pagos y entregas fuera de la plataforma** en v1. La arquitectura no debe impedir pagos in-app en el futuro. · Reduce complejidad y requisitos regulatorios en la validación.
- **D-003 · 2026-10-16** · **Una sola cuenta** para comprar y vender. · Es lo que hacen Jiji y Vinted; menos fricción.
- **D-004 · 2026-10-16** · **Catálogo 100 % público sin cuenta**; chatear, publicar y favoritos requieren cuenta, y tras el login se vuelve al punto de origen. · Evita spam y permite notificar las respuestas.
- **D-005 · 2026-10-16** · Contacto: **chat interno siempre + WhatsApp/llamar opcional por vendedor**, visible solo con sesión. El teléfono nunca es público. · Equilibra el control de la plataforma con la realidad de un mercado que vive en WhatsApp.
- **D-006 · 2026-10-16** · **Premium = plan único mensual** para vendedores. Pago fuera de la app y **activación manual por admin** con fecha de fin. · Es lo más simple para validar; los niveles y los destacados sueltos se evaluarán más adelante.
- **D-007 · 2026-10-16** · Mercado inicial **solo Guinea Ecuatorial**, **XAF**, **español** con i18n preparado para francés. · Foco.
- **D-008 · 2026-10-16** · **Moderación a posteriori**: publicación inmediata + reportes + auto‑ocultado por umbral + contenido prohibido. · La revisión previa frena la publicación y no escala.
- **D-009 · 2026-10-16** · **Empleo fuera del MVP** (fase 2). · Es otro tipo de producto (salario, candidaturas).
- **D-010 · 2026-10-16** · Convención de idioma: UI, documentación y commits en **español**; código en **inglés**; URLs públicas en español. · Mercado hispanohablante y código estándar.
- **D-011 · 2026-10-16** · El stack se decide **después** de cerrar el alcance. · Petición explícita del cliente.
- **D-012 · 2026-10-16** · **Registro**: nombre visible, nombre de usuario, teléfono, email y contraseña, todos obligatorios. **Login**: usuario, email o teléfono + contraseña. Sin SMS en el MVP: teléfono "no verificado"; email confirmado obligatorio para publicar; recuperación de contraseña por email. Reglas en ALCANCE §5.7. · El teléfono es el identificador preferido en GE; el email es el canal gratuito de recuperación y notificaciones; se evita el coste de SMS.
- **D-013 · 2026-10-16** · Valores iniciales validados: Normal 10 anuncios / 6 fotos / 30 días; Premium 200 / 15 / 60 días; auto‑ocultado a los 3 reportes. Configurables. · Validado por el cliente.
- **D-014 · 2026-10-16** · Listas iniciales de ciudades (ALCANCE §5.6) y categorías (§6) aceptadas; se editan desde el admin. · Validado por el cliente.
- **D-015 · 2026-10-16** · **Stack**: Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + RLS, Auth, Realtime, Storage, pg_cron), Resend, next-intl, Zod, Sentry, Vercel Web Analytics, Vitest + Playwright, pnpm + Biome. Sin ORM ni monorepo. Detalle en [ARQUITECTURA.md](ARQUITECTURA.md). · Preferencia de BKLN validada contra los requisitos: SSR ligero, tiempo real, push, imágenes y coste.
- **D-016 · 2026-10-16** · **Región única: Londres** (Supabase `eu-west-2`, funciones de Vercel `lhr1`). · Medido desde Malabo: Londres 135 ms y la más estable; Ciudad del Cabo 291 ms porque el tráfico sale por Europa.
- **D-017 · 2026-10-16** · **Hosting: Vercel.** Hobby en desarrollo y Pro al lanzar. · Integración nativa con Next.js y URLs de prueba por rama; Hobby no permite uso comercial.
- **D-018 · 2026-10-16** · **Entornos:** proyecto Supabase **dev en la nube** (Free, Londres), que también usan las previews de Vercel, y proyecto **prod** aparte (Pro). Sin Docker local; migraciones SQL escritas a mano y aplicadas con la CLI. · Elección del cliente frente a Supabase local con Docker.
- **D-019 · 2026-10-16** · **Imágenes:** variantes WebP (grande ≤ 1600 px + miniatura ≤ 480 px) generadas en el móvil y servidas directamente desde Storage, sin optimizador en servidor. · Ahorra datos y coste, y elimina el EXIF.
- **D-020 · 2026-10-16** · **Verificación de email propia** (confirmación de Supabase Auth desactivada + tokens + Resend). · Supabase solo permite bloquear el login hasta confirmar o no confirmar nada; D-012 pide cuenta usable al momento y email confirmado para publicar.
- ~~**D-021 · 2026-10-16** · Precio de Premium: 5.000 FCFA al mes; 33.000 FCFA al año; otros periodos a precio mensual.~~ Sustituida por D-022.
- **D-022 · 2026-10-16** · **Precios de Premium** con descuento proporcional a la duración (45 % el año): 1 mes 5.000 FCFA · 3 meses 13.300 FCFA (11,25 %) · 6 meses 23.250 FCFA (22,5 %) · 12 meses 33.000 FCFA (45 %). Van en la configuración de planes. · Decisión del cliente; el precio de 3 meses (13.312,5) se redondea a la centena.
- **D-023 · 2026-10-16** · **Pago de Premium en el MVP: en efectivo, en la oficina de BKLN.** El admin registra el cobro con número de recibo. La transferencia bancaria y Rosa Money (mobile money) se integrarán en la app más adelante (fase 3). · Decisión del cliente. El registro de activaciones guarda el método, así que se podrán admitir los demás sin rediseñar.
- **D-024 · 2026-10-16** · El proyecto Supabase **dev** queda en **Irlanda (`eu-west-1`)**; **producción irá en Londres (`eu-west-2`)**, como dice D-016. · Segunda medición (20 muestras): medianas parecidas (Irlanda 162 ms, Londres 151 ms), pero Irlanda tiene picos mucho peores (el 10 % más lento pasa de 369 ms, frente a 167 ms en Londres). Para desarrollar da igual; en producción manda la estabilidad.
- **D-025 · 2026-10-16** · **Pagos de Premium (amplía D-023):** en Malabo, efectivo en la oficina (BKLN Software & Systems, Banapa; de lunes a viernes de 8:00 a 16:00 y sábados de 11:00 a 14:00); fuera de Malabo, envío por agencia de envío de dinero a nombre de **BKLN Marketplace**, con el código compartido por WhatsApp al +240 555 220 846. Si una agencia exige un nombre legal o un documento distinto, se cambia en la configuración. El admin lo comprueba y activa; cada referencia es única. Estos datos van en la configuración. · Decisión del cliente, para cubrir a los vendedores de fuera de Malabo sin esperar a la fase 3.
- **D-026 · 2026-10-16** · **Nombre: BKLN Marketplace. Dominio: `bklnmarketplace.com`** (registrado en Hostinger; los DNS se gestionan allí). · Decisión del cliente.
- **D-027 · 2026-10-16** · **Modelo de datos del MVP** en [MODELO-DATOS.md](MODELO-DATOS.md):
  - Datos públicos y privados del usuario en tablas separadas.
  - El estado del anuncio solo cambia por RPC.
  - Premium se calcula con `premium_until`.
  - Las reglas críticas se aplican en la base de datos.
  - La configuración vive en `plans`, `plan_prices` y `app_settings`.
  · Pensado para que RLS proteja el teléfono y para que las reglas no dependan de la interfaz.
- **D-028 · 2026-10-16** · **Inmuebles con subcategorías separadas** para venta y alquiler, como Jiji, en lugar del atributo "Operación". Modifica D-014. · Es más simple de filtrar y el "/mes" lo decide la subcategoría. Decisión del cliente.
- **D-029 · 2026-10-16** · **Mínimo una foto para publicar** en todas las categorías. · Los anuncios sin foto apenas reciben mensajes. Decisión del cliente.
- **D-030 · 2026-10-16** · **Borrar la cuenta conserva, anonimizados, los mensajes enviados a otros** ("Usuario eliminado"), además de los cobros de Premium. Todo lo demás se borra. · Así la otra persona conserva su historial y borrar la cuenta no borra las pruebas de una estafa. Decisión del cliente.
- **D-031 · 2026-10-16** · **Identidad visual: dirección A "Atlántico"**: azul `#0B4F8A` + naranja `#F2662B` (siempre con texto oscuro) y un símbolo que mezcla burbuja de chat y etiqueta. Detalle en [IDENTIDAD.md](IDENTIDAD.md). · Transmite confianza, clave con el pago fuera de la app, y se distingue de Jiji, que es verde. Decisión del cliente entre tres direcciones.
- **D-032 · 2026-10-16** · **Tipografía:** Plus Jakarta Sans 800 **solo en títulos y precios**, alojada en nuestro servidor y en un único peso; el resto, con la fuente del sistema. · Unos 20–25 KB una sola vez a cambio de personalidad. Decisión del cliente.
- **D-033 · 2026-10-16** · **Wireframes v1** (13 pantallas, en el lienzo):
  - Publicar en 4 pasos.
  - "Ver más" en lugar de scroll infinito.
  - El admin se puede usar desde el móvil.

  · Ahorra datos y simplifica. Quedan abiertos a comentarios en el lienzo.
- **D-034 · 2026-10-16** · **Next.js 16 con Cache Components y Partial Prefetching:**
  - Las páginas públicas se sirven como una estructura estática desde la CDN.
  - Lo que depende de la sesión va dentro de un `<Suspense>`.
  - La sesión se refresca en `src/proxy.ts`, y solo si hay cookies de Supabase.

  · Es el mecanismo de caché por etiquetas de Next 16 y reduce viajes de red (ARQUITECTURA §1).
- **D-035 · 2026-10-16** · **Los datos de referencia van en una migración, no en `seed.sql`:** planes, precios, ajustes, ciudades, categorías y atributos. `seed.sql` queda para datos de prueba. · Producción también los necesita.
- **D-036 · 2026-10-16** · **Mientras no exista el proyecto Supabase de producción, el despliegue de producción de Vercel apunta al proyecto dev.** Antes del lanzamiento hay que cambiar sus variables. · De momento solo se publica una página estática, sin datos reales.
- **D-037 · 2026-10-16** · **Emails de auth propios:**
  - La verificación de email y la recuperación de contraseña los envía la app, con la API REST de Resend y plantillas HTML sencillas. React Email queda para cuando las plantillas crezcan.
  - La recuperación usa `generateLink` + `verifyOtp`.
  - Los dos enlaces se canjean al pulsar un botón (POST), no al abrir la URL, porque los antivirus de correo abren los enlaces solos.
  - Sin `RESEND_API_KEY`, fuera de producción el email se escribe en la consola.

  · Emails en español y con nuestra marca, sin depender de las plantillas de Supabase y robustos frente a los escáneres de enlaces.
- **D-038 · 2026-10-16** · **Flujo de git: se trabaja directamente en `main`.** Cada push publica en bklnmarketplace.com. Las pantallas sin terminar quedan accesibles por URL, aunque la home siga mostrando "Próximamente". · Decisión del cliente; se descartó una rama de desarrollo con previews.
- **D-039 · 2026-10-16** · **Subida de fotos (matiza D-019):**
  - El servidor crea URLs firmadas tras comprobar el dueño y el límite de fotos, y el móvil sube con progreso real (`XMLHttpRequest`).
  - Los usuarios no tienen permisos de escritura en Storage.
  - WebP, con JPEG como respaldo, porque Safari no genera WebP desde canvas; el bucket admite los dos.

  · El progreso visible importa con datos lentos. Además, con URLs firmadas nadie puede subir ficheros fuera de su anuncio ni pasarse del límite.
- **D-040 · 2026-10-16** · **Borradores de anuncio en la base de datos:**
  - El borrador se crea al pulsar "Empezar un anuncio nuevo" (como mucho 10 abiertos por usuario) y cada paso se guarda en el servidor.
  - En el paso de detalles, además, se guarda una copia en el navegador por si se corta la red.
  - Crear el borrador es una acción explícita (botón), no una visita a una URL, para que la precarga de enlaces no genere borradores.

  · Así se retoma desde cualquier dispositivo y nunca se pierde lo escrito (ALCANCE §4.4).
- **D-041 · 2026-10-16** · **"Ver más" amplía el número de resultados de la misma URL (`?n=2`, `?n=3`…)** en lugar de paginar con cursor (matiza ARQUITECTURA §5.4):
  - Páginas de 20, hasta 10 (200 resultados); a partir de ahí se pide afinar con los filtros.
  - El enlace lleva un ancla al primer resultado nuevo, así que sin JavaScript también deja al usuario donde estaba.

  · Es lo más simple que funciona sin JavaScript, cada URL se cachea y con el volumen del MVP la consulta es barata. Si los volúmenes crecen, se puede pasar a cursor sin cambiar la interfaz.
- **D-042 · 2026-10-16** · **El corazón de favorito está en la ficha y en `/favoritos`, no en las tarjetas de los listados.** · Así el inicio, la búsqueda y los perfiles se sirven cacheados sin depender de la sesión. Se puede añadir a las tarjetas más adelante si los datos lo piden.
- **D-043 · 2026-10-16** · **Nada se indexa hasta el lanzamiento:** sin la variable `SITE_INDEXABLE=true`, robots.txt lo bloquea todo y las páginas llevan `noindex`. El sitemap, los canonical y el JSON-LD ya están listos. · Producción usa el proyecto dev con datos de prueba (D-036) y no deben acabar en Google.
- **D-044 · 2026-10-16** · **El inicio real sustituye a "Próximamente"** en bklnmarketplace.com (matiza D-038), sin indexar (D-043). "Recientes" muestra todo el país: el selector de ciudad del wireframe 01 queda fuera del MVP y la ciudad se filtra en la búsqueda. · Hacía falta para probar el catálogo en el móvil. Nadie más conoce aún la dirección.
- **D-045 · 2026-10-16** · **Filtros de búsqueda:**
  - Van en la URL en español. Los atributos usan su etiqueta sin tildes ni eñes: `marca=Toyota`, `anio_min=2015`, `banios_min=2`.
  - Se filtra por atributos de lista, de sí/no y rangos numéricos; los de texto libre (modelo, talla) no.
  - La hoja de filtros se abre con el ancla `#filtros` y CSS `:target`: funciona sin JavaScript y el botón atrás de Android la cierra. El botón dice "Ver resultados" sin el número del wireframe 03, que exigiría una consulta por cada cambio.

  · Páginas compartibles y que funcionan en cualquier navegador, sin peticiones extra con datos lentos.
- **D-046 · 2026-10-16** · **Textos de interfaz en el cliente por zona:** cada grupo de rutas pasa a `NextIntlClientProvider` solo los textos de sus componentes de cliente (`src/i18n/client-messages.ts`). · Antes cada página llevaba en su HTML el `es.json` entero (unos 20 KB sin comprimir).
