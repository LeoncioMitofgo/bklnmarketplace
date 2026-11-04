# Registro de decisiones — BKLN Marketplace

Formato: `D-NNN · fecha · decisión · motivo`. Cuando se resuelva una pendiente, se pasa a "Tomadas" con un número nuevo.
Si una decisión se revierte, no se borra: se marca como ~~sustituida~~ y se enlaza la nueva.

---

## Pendientes

- **Textos legales provisionales (D-056):** los términos y la privacidad los redactó Claude en lenguaje sencillo y hay que revisarlos. Hay que confirmar en especial la edad mínima (18 años), el email de contacto (`hello@bklnsoftware.tech`) y si se citan leyes concretas de Guinea Ecuatorial.

- **Proveedor de pagos dentro de la app (fase 3):** candidatos Rosa Money, Muni Dinero y Bonafide Microbank (B-Morï, dentro de GIMACPAY). Los correos para presentarnos están preparados desde el 2026-11-03 ([PAGOS-PROVEEDORES.md](PAGOS-PROVEEDORES.md)). Se decide con sus respuestas: que tengan cuenta de comercio y confirmación automática del pago (API), además de requisitos y comisiones. Lo primero sería cobrar Premium.

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
- ~~**D-016 · 2026-10-16** · **Región única: Londres** (Supabase `eu-west-2`, funciones de Vercel `lhr1`). · Medido desde Malabo: Londres 135 ms y la más estable; Ciudad del Cabo 291 ms porque el tráfico sale por Europa.~~ Sustituida por D-067.
- **D-017 · 2026-10-16** · **Hosting: Vercel.** Hobby en desarrollo y Pro al lanzar. · Integración nativa con Next.js y URLs de prueba por rama; Hobby no permite uso comercial.
- **D-018 · 2026-10-16** · **Entornos:** proyecto Supabase **dev en la nube** (Free, Londres), que también usan las previews de Vercel, y proyecto **prod** aparte (Pro). Sin Docker local; migraciones SQL escritas a mano y aplicadas con la CLI. · Elección del cliente frente a Supabase local con Docker.
- **D-019 · 2026-10-16** · **Imágenes:** variantes WebP (grande ≤ 1600 px + miniatura ≤ 480 px) generadas en el móvil y servidas directamente desde Storage, sin optimizador en servidor. · Ahorra datos y coste, y elimina el EXIF.
- **D-020 · 2026-10-16** · **Verificación de email propia** (confirmación de Supabase Auth desactivada + tokens + Resend). · Supabase solo permite bloquear el login hasta confirmar o no confirmar nada; D-012 pide cuenta usable al momento y email confirmado para publicar.
- ~~**D-021 · 2026-10-16** · Precio de Premium: 5.000 FCFA al mes; 33.000 FCFA al año; otros periodos a precio mensual.~~ Sustituida por D-022.
- **D-022 · 2026-10-16** · **Precios de Premium** con descuento proporcional a la duración (45 % el año): 1 mes 5.000 FCFA · 3 meses 13.300 FCFA (11,25 %) · 6 meses 23.250 FCFA (22,5 %) · 12 meses 33.000 FCFA (45 %). Van en la configuración de planes. · Decisión del cliente; el precio de 3 meses (13.312,5) se redondea a la centena.
- **D-023 · 2026-10-16** · **Pago de Premium en el MVP: en efectivo, en la oficina de BKLN.** El admin registra el cobro con número de recibo. La transferencia bancaria y Rosa Money (mobile money) se integrarán en la app más adelante (fase 3). · Decisión del cliente. El registro de activaciones guarda el método, así que se podrán admitir los demás sin rediseñar.
- ~~**D-024 · 2026-10-16** · El proyecto Supabase **dev** queda en **Irlanda (`eu-west-1`)**; **producción irá en Londres (`eu-west-2`)**, como dice D-016. · Segunda medición (20 muestras): medianas parecidas (Irlanda 162 ms, Londres 151 ms), pero Irlanda tiene picos mucho peores (el 10 % más lento pasa de 369 ms, frente a 167 ms en Londres). Para desarrollar da igual; en producción manda la estabilidad.~~ Sustituida por D-067.
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
- **D-031 · 2026-10-16** · **Identidad visual: dirección A "Atlántico"**: azul `#0B4F8A` + naranja `#F2662B` (siempre con texto oscuro) y un símbolo que mezcla burbuja de chat y etiqueta (sustituido el 2026-11-03 por la "b" con la etiqueta, D-063). Detalle en [IDENTIDAD.md](IDENTIDAD.md). · Transmite confianza, clave con el pago fuera de la app, y se distingue de Jiji, que es verde. Decisión del cliente entre tres direcciones.
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
- ~~**D-036 · 2026-10-16** · **Mientras no exista el proyecto Supabase de producción, el despliegue de producción de Vercel apunta al proyecto dev.** Antes del lanzamiento hay que cambiar sus variables. · De momento solo se publica una página estática, sin datos reales.~~ Sustituida por D-067.
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
- **D-047 · 2026-10-17** · **Datos de demostración en el proyecto dev:** 7 vendedores ficticios (2 Premium) y 24 anuncios con fotos de Unsplash, descargadas en WebP y subidas a nuestro Storage como las de un anuncio real. Las cuentas llevan `user_metadata.demo = true` y teléfonos `+240000000xxx`, para borrarlas de una vez. · Petición del cliente, para probar el catálogo con contenido variado. No pasan al proyecto de producción (D-036).
- **D-048 · 2026-10-17** · **Chat (matiza MODELO-DATOS §5.5 y §8):**
  - Los mensajes se envían con la RPC `send_message`, no con un insert directo: las reglas (bloqueos, cuenta activa, foto válida y límite por minuto) están en un solo sitio.
  - El tiempo real usa `realtime.send` a canales privados, en lugar de `broadcast_changes`, para enviar solo los campos necesarios.
  - La conversación se crea con el primer mensaje.
  - Al suscribirse, el cliente se pone al día, para no perder lo que llegue mientras conecta o sin red.
  - La notificación push saldrá de la Server Action que envía el mensaje, sin Database Webhook.

  · Probado con dos navegadores: sin ponerse al día, un mensaje que llegaba en los 1–2 s de conexión se perdía.
- **D-049 · 2026-10-17** · **La ficha pasa a pantalla completa, sin barra inferior,** con la barra fija "WhatsApp · Chatear", como en el wireframe 04. Quien ve su propio anuncio tiene "Editar mi anuncio". · Dos barras fijas apiladas ocupaban demasiado en 360 px.
- **D-050 · 2026-10-17** · **WhatsApp sin el teléfono en la página:**
  - El botón es un formulario. Al pulsarlo, el servidor pide el teléfono con `whatsapp_contact` (sesión, ajuste del vendedor, bloqueos y tope diario) y redirige a `wa.me` con el título y el enlace del anuncio.
  - No hay botón de "Llamar" en el MVP: WhatsApp ya permite llamar.

  · Así nadie puede recolectar teléfonos leyendo páginas, ni siquiera con sesión.
- **D-051 · 2026-10-17** · **Notificaciones push web:**
  - Salen de la Server Action del mensaje con `after()` y `web-push` (sin Database Webhook). Las claves VAPID van en variables de entorno; la privada, solo en el servidor.
  - Se ofrecen con una invitación en la bandeja y en la conversación ("Ahora no" la oculta 7 días) y un ajuste por móvil en Mi cuenta. Nunca se pide permiso sin que el usuario pulse un botón.
  - Un móvil está suscrito con una sola cuenta: al suscribirse con otra, pasa a ella, y al cerrar sesión se da de baja.
  - En iPhone solo funcionarán con la web instalada en la pantalla de inicio (fase 2).

  · Es lo más simple que cumple ALCANCE §4.6 ("si el vendedor no se entera, el chat muere") sin más servicios ni secretos.
- **D-052 · 2026-10-17** · **La hora y la precarga de Next 16:** con Cache Components, Next no deja leer la hora al prerenderizar, lo que incluye el App Shell de la precarga parcial y las fichas que se cachean en segundo plano.
  - `getSessionUser` empieza con `await io()`.
  - Los "hace X" de las páginas públicas usan `fetchedAt`, la hora guardada con los datos cacheados: como mucho se desvían un minuto.

  · Lo detectaron las pruebas con el servidor de producción: errores en el registro y fichas que no se llegaban a cachear.
- **D-053 · 2026-10-17** · **Denuncias:**
  - Se denuncia en pantallas propias (`/anuncio/<slug>/denunciar` y `/mensajes/<id>/denunciar`) que funcionan sin JavaScript. Sin sesión, se pasa por entrar y se vuelve al formulario.
  - En el chat solo valen los motivos que tienen sentido para una persona: estafa, ofensivo, prohibido u otro. "Bloquear también" viene marcado.
  - "Otro motivo" exige explicación.
  - La denuncia de un anuncio guarda también al vendedor; la del chat, a la persona y la conversación, sin anuncio, así que no cuenta para ocultarlo.
  - Se crean por RPC (`report_listing`, `report_conversation`), con un tope diario (`reports_per_day`, 20).
  - El auto‑ocultado lo hace un trigger y se apunta en `moderation_log` como acción del sistema (`admin_id` null). La denuncia que lo oculta invalida la caché de las páginas públicas.

  · Lo más simple que cumple ALCANCE §5.5. El riesgo de que tres cuentas falsas oculten un anuncio ajeno se asume: lo revisa un admin, y el registro tiene límite por IP.
- **D-054 · 2026-10-17** · **Las pantallas con sesión redirigen a entrar en el proxy**, no en la página (`/cuenta`, `/favoritos`, `/mis-anuncios`, `/mensajes`, `/publicar` y las de denunciar). Las páginas lo siguen comprobando.

  · Next 16 deja montadas en segundo plano las páginas visitadas. Si la redirección la hacía la página, al volver tras entrar la página vieja la repetía y el usuario acababa otra vez en `/entrar`. Pasaba también con la barra inferior desde la 1.1. `refresh()` y `revalidatePath` no lo arreglaban.
- **D-055 · 2026-10-17** · **Borrar la cuenta:**
  - Se pide la contraseña, con 5 intentos cada 15 minutos.
  - El servidor borra el usuario de Supabase Auth y las claves foráneas hacen el resto (MODELO-DATOS §11).
  - Quita las cookies de la sesión e invalida la caché de sus anuncios y de su perfil.
  - Las fotos de Storage las borra justo después, con `after()` y `account_storage_objects()`, en lugar de esperar a un cron.

  · Las fotos están en un bucket público: no deben seguir accesibles después de borrar la cuenta. La contraseña evita que alguien con el móvil desbloqueado borre la cuenta de otro.
- **D-056 · 2026-10-17** · **Términos prohibidos y textos legales:**
  - Los términos prohibidos se buscan como palabras completas, admitiendo el plural (-s/-es). Antes se buscaban dentro del texto, así que "arma" habría saltado con "armario".
  - La lista inicial pasa a 37 términos (drogas, medicamentos con receta, armas, documentos y dinero falsos, fauna protegida y servicios sexuales). Se evitan los que dan falsos positivos, como "pistola" (de silicona), "fusil" (de pesca) o "granada" (la fruta).
  - Términos y privacidad en `es.json` (`legal`), como secciones de párrafos y listas, para poder traducirlos.
  - Edad mínima de 18 años y contacto `hello@bklnsoftware.tech`, pendientes de confirmar (ver Pendientes).
- **D-057 · 2026-10-17** · **Hazte Premium y panel de administración (1.6, primera parte):**
  - `/premium` es pública: comparativa, precios y formas de pago salen de `plans`, `plan_prices` y `app_settings.office`. Para pedir Premium hace falta sesión.
  - La solicitud pendiente es una sola: elegir otro periodo o forma de pago la cambia en vez de crear otra.
  - El cobro se registra en la ficha del usuario del panel, que se abre desde "Pagos". El formulario viene relleno con la solicitud y el importe se puede cambiar (descuentos, Premium gratis a tiendas fundadoras…), pero la referencia es obligatoria.
  - El panel está en `/admin`. A quien no es admin le responde "no existe". Todas las acciones van por RPC que comprueban el rol, y ninguna se puede aplicar a otro admin.
  - Banear corta también el acceso en Supabase Auth (10 años). Quitar el baneo devuelve el acceso, pero sus anuncios siguen bloqueados hasta restaurarlos uno a uno.
  - El rol de admin se da con SQL; no hay pantalla para eso en el MVP.

  · ALCANCE §4.11 y §5.3 con el mínimo de pantallas: el admin hace casi todo desde la ficha del usuario y la del anuncio denunciado.
- **D-058 · 2026-11-03** · **Editar el perfil y la cuenta:**
  - Perfil público en `/cuenta/perfil`: foto, nombre, usuario, ciudad y descripción.
    - Cambiar el usuario cambia la dirección `/u/<usuario>` y los enlaces antiguos dejan de funcionar (se avisa en el formulario).
    - La caché del perfil, del nombre antiguo y del nuevo, y la de los anuncios se invalida al momento.
  - La foto se recorta en cuadrado y se reduce en el móvil (400 px, WebP o JPEG). Se sube a una URL firmada del bucket `profile-media`, cada vez con un nombre nuevo (`{user_id}/avatar-{uuid}`) para que la CDN no sirva la vieja, y la anterior se borra. Un trigger impide apuntar a la foto de otro.
  - Email, teléfono y contraseña en `/cuenta/acceso`: cada cambio pide la contraseña actual.
    - Solo cuentan los fallos: 5 cada 15 minutos.
    - El email lo cambia el servidor con la API de admin; hay que volver a confirmarlo para publicar.
    - El teléfono se guarda normalizado. No se verifica por SMS (fase 2).
    - Cambiar la contraseña cierra la sesión en los demás dispositivos.

  · ALCANCE §4.3. Pedir la contraseña protege los datos con los que se entra si alguien coge el móvil con la sesión abierta.
- **D-059 · 2026-11-03** · **Tienda Premium:**
  - Se crea y se edita en `/cuenta/tienda`, solo con Premium (lo exige la RLS de `stores`).
    - Sin Premium, la pantalla explica la tienda y lleva a "Hazte Premium".
    - Si caduca, dice que no se ve y que no se ha borrado nada.
  - La dirección (`/t/<slug>`) propone por defecto el nombre de usuario con guiones y se normaliza lo que se escribe (sin tildes, espacios a guiones).
  - Logo cuadrado de 400 px y portada de 1200 px, reducidos en el móvil y subidos como la foto de perfil (D-058): `profile-media`, nombre nuevo cada vez y un trigger que solo acepta fotos del dueño.
  - Página pública cacheada e indexable. Las pestañas "En venta" y "Vendidos" son enlaces (`?ver=vendidos`), así que funcionan sin JavaScript.
  - El WhatsApp de la tienda sigue las reglas de la ficha (D-050): solo con sesión y si el dueño lo activó; el teléfono se pide al pulsar, con el mismo tope diario.
  - La ficha enlaza a la tienda en lugar de al perfil cuando el vendedor la tiene.

  · ALCANCE §4.8 con el mínimo: sin plantillas ni colores propios, que se pueden añadir más adelante.
- **D-060 · 2026-11-03** · **Catálogo y ajustes en el panel:**
  - Las categorías y las ciudades no se borran, porque hay anuncios y perfiles que dependen de ellas: se desactivan. Desactivar una categoría principal desactiva también sus subcategorías. Sus anuncios siguen publicados.
  - Los atributos se pueden eliminar: los anuncios guardan el dato, pero deja de verse y de pedirse. Su clave y su tipo no se cambian después de crearlos, porque los anuncios ya guardan valores con ellos.
  - La dirección de una ciudad (filtro `ciudad=`) no cambia. La de una categoría sí se puede cambiar, avisando de que los enlaces antiguos dejan de funcionar.
  - En "Ajustes" se editan los límites de los planes, los precios de Premium (un periodo se retira sin borrarlo), la oficina, los términos prohibidos y el umbral de denuncias. Los límites de ritmo quedan fuera del panel: se cambian con SQL.
  - Se escribe con la sesión del admin y la RLS de cada tabla. Se invalida la caché que toca: `catalog`, `plans` o `app-settings`.

  · ALCANCE §4.11 con formularios sencillos. Desactivar en vez de borrar evita romper anuncios ya publicados.
- **D-061 · 2026-11-03** · **Avisos programados y caducidad de Premium:**
  - Un solo cron diario de Vercel (`/api/cron/daily`, 08:00 UTC, que en Malabo son las 9:00), protegido con `CRON_SECRET`. Sin el secreto no hace nada.
  - De momento envía el aviso push de Premium a 7 días; ahí irán también los de anuncios por caducar y, con Resend, los emails.
  - `notification_log` apunta cada aviso antes de enviarlo (único por usuario, tipo, referencia y canal): no se repite aunque el cron corra dos veces. La referencia de Premium es la fecha de fin, así que al renovar el periodo nuevo tiene su propio aviso.
  - Además, aviso en la web (Mi cuenta y Mis anuncios), que no depende del cron ni de tener los avisos activados.

  · ALCANCE §5.3 y §4.6 con la infraestructura que ya hay (push). Mientras no haya email, el aviso en la web cubre a quien no tiene push.
- **D-062 · 2026-11-03** · **Cada despliegue lleva su identificador** (`deploymentId: VERCEL_DEPLOYMENT_ID` en `next.config.ts`).
  - Una pestaña abierta desde antes de un despliegue recarga la página entera al navegar, en lugar de usar código o Server Actions de la versión anterior.
  - La caché `use cache` también se separa por despliegue.

  · Como se despliega con cada push a `main`, en los logs salía "Failed to find Server Action" cuando una pestaña vieja usaba una acción que había cambiado (pasó al reorganizar las del panel). Es inofensivo: a esa persona le basta con recargar. Comprobado en local con dos despliegues seguidos.
  · Al pasar a Vercel Pro (1.7), mirar también su *Skew Protection*, que sigue sirviendo la versión anterior a las pestañas abiertas.
- **D-063 · 2026-11-03** · **Marca nueva y web instalable:**
  - Símbolo nuevo: la "b" minúscula azul con una etiqueta de precio blanca y dos trazos naranjas. Sustituye a la burbuja de D-031; los colores y la tipografía no cambian. Detalle y medidas en IDENTIDAD §2; SVG maestros en `docs/marca/`.
  - El diseño lo generó el cliente con ChatGPT. El SVG que dio ChatGPT no coincidía con su propia imagen (la etiqueta se salía de la "b" y sobre azul desaparecía), así que se redibujó a mano y se comprobó de 16 a 320 px.
  - Con él: logo de la web, favicon, iconos de la app (Android adaptable e iPhone), icono de las notificaciones e imagen para compartir de 1200×630 (la de la marca en todas las páginas, salvo los anuncios y las tiendas, que comparten su foto).
  - **La web se puede instalar** desde el MVP (`src/app/manifest.ts`: nombre "BKLN", inicio en `/`, sin barra del navegador, iconos y colores de la marca). Se adelanta de la fase 2 porque solo era el manifiesto y los iconos; el modo sin conexión y un botón propio de "Instalar" siguen en la fase 2 (ALCANCE 1.8).

  · El cliente quería una marca que le convenciera antes del lanzamiento. Instalar la web da un icono en la pantalla de inicio, como una app, sin tienda de aplicaciones, y en iPhone es lo que permite recibir avisos push (iOS 16.4 o posterior).
- **D-064 · 2026-11-04** · **Pruebas de extremo a extremo en el repo** (`e2e/`, `pnpm e2e`): scripts de Node con `playwright-core` y comprobaciones propias (`ok`, `finish`), en vez de `@playwright/test`.
  - Prueban contra el proyecto Supabase de `.env.local` y una web en local (`pnpm start -p 3100`). Cada script crea y borra sus propios datos.
  - Lo común (variables, cliente de Supabase, Chromium y errores de la página) está en `e2e/lib.mjs`; cómo se usan, en `e2e/README.md`.
  - No van en el CI: necesitan la clave secreta de Supabase y tocan la base de datos compartida.

  · Hasta ahora vivían en una carpeta temporal y se borraron. Se recuperaron del historial de la sesión y se pasaron tal cual, para no reescribir más de 500 comprobaciones que ya funcionaban. Al ejecutarlas de nuevo se actualizaron las que habían quedado atrás de la web (el formulario único del panel, la redirección a entrar en el proxy y las páginas que Next deja montadas).
- **D-065 · 2026-11-04** · **Tiendas fundadoras:** a las primeras empresas que suban sus anuncios antes del lanzamiento se les ofrece:
  - **6 meses de Premium gratis** (valen 23.250 FCFA, D-022), **contados desde la apertura** (D-068). Se activa al registrarse, para que preparen su tienda, con un solo cobro de 0 FCFA en el panel por los meses que falten hasta la apertura más 6 (8 si se activa en noviembre, 7 en diciembre). La referencia es `FUNDADORA-<empresa>` (D-057).
  - **Visibilidad**: con Premium, sus anuncios salen en Destacados y tienen su tienda en `/t/<tienda>`.
  - **Publicidad**: se las nombra como tiendas fundadoras en la campaña del lanzamiento (nota de prensa y redes).

  Se les escribe por WhatsApp y email con una propuesta en PDF hecha para cada empresa, con sus productos, sus precios y su dirección: tienen que notar que las hemos elegido a ellas. Contactos y correos en [LANZAMIENTO-CONTACTOS.md](LANZAMIENTO-CONTACTOS.md). · Decisión del cliente. Una web de clasificados vacía no atrae a nadie: hace falta que vehículos e inmuebles tengan anuncios de calidad desde el primer día.
- **D-066 · 2026-11-04** · **Aviso de versión previa:** hasta el lanzamiento, las pantallas con la barra inferior (inicio, búsqueda, categorías, perfiles, tiendas y cuenta) llevan arriba «Versión previa. Los anuncios que ves son de demostración y se borrarán al abrir.» Cuando publique la primera tienda fundadora, el texto pasa a «Muchos anuncios son de demostración…», para no tachar los suyos de demostración. Desaparece solo al poner `SITE_INDEXABLE=true` (D-043). Los anuncios de demostración (D-047) se quedan hasta entonces y se borran antes de abrir. · Petición del cliente: sin ellos la web se ve vacía mientras las tiendas fundadoras suben lo suyo. Ligarlo a la indexación evita otra variable que acordarse de quitar.
- **D-067 · 2026-11-04** · **El proyecto de Supabase actual (`xujlsrezhctlovncsywu`, Irlanda `eu-west-1`) es el de producción.** No habrá un proyecto nuevo en Londres. Sustituye a D-016, D-024 y D-036.
  - Las funciones de Vercel pasan de `lhr1` a **`dub1` (Dublín)**, junto a la base de datos (ARQUITECTURA §1, regla 3).
  - Antes de abrir: plan **Pro** de Supabase en este mismo proyecto (copias de seguridad diarias y más Storage) y borrar las cuentas de demostración (D-047, D-066).
  - Hace falta un **proyecto de desarrollo aparte**, en Irlanda, antes de la próxima migración y, en cualquier caso, antes de abrir. Hasta entonces, las migraciones y las pruebas `e2e/` escriben en producción.
  - Las propuestas y los correos del lanzamiento llevan el WhatsApp de BKLN, +240 222 798 086. El de los pagos de Premium sigue siendo el +240 555 220 846 (D-025).

  · Decisión del cliente. Las tiendas fundadoras (D-065) pueden registrarse ya sin tener que trasladar sus cuentas después, y los anuncios de demostración se quedan hasta el lanzamiento. A cambio, la región ya no se puede cambiar: en la medición de ARQUITECTURA §1, Irlanda daba 11 ms más de mediana que Londres y picos peores.
- **D-068 · 2026-11-04** · **Lanzamiento previsto para enero de 2027**, sin día fijo todavía. Las propuestas a las tiendas fundadoras salen la semana del 4 de noviembre, y el día exacto se les anuncia a principios de enero. · Decisión del cliente. Quedan unas cinco o seis semanas útiles antes de las fiestas para que las tiendas suban sus anuncios: esperar a diciembre sería abrir con la web casi vacía.
- **D-069 · 2026-11-04** · **Patrocinio del lanzamiento:**
  - Se pide una aportación **económica o en especie**, según la empresa (difusión a sus clientes, la sala o el cóctel del acto, navegar por la web sin gastar datos…).
  - Se ofrece: su marca en la **campaña** y en el **acto de presentación** (en Malabo, en enero de 2027), su **logo en el pie de la web** («Con el apoyo de») y, si la quiere, la **exclusividad**, sea en su sector o como único patrocinador.
  - Las propuestas **no llevan precio**: la cifra se habla en la reunión.
  - Una propuesta personalizada por empresa (Muni, GETESA, BANGE, Martínez Hermanos, Ventage Group, Afri Mall, Galería JM & Hermanos y Viteoca Market), con una maqueta del pie con su logo cuando lo hay. Los grupos y centros comerciales reciben además la oferta de tienda fundadora para sus tiendas. La exclusividad es por sector: operadores, distribución y comercio, centros comerciales y bancos. Contactos y correos en [LANZAMIENTO-CONTACTOS.md](LANZAMIENTO-CONTACTOS.md).
  - El pie con los logos se programa cuando firme el primer patrocinador. Es la única publicidad dentro de la web: los banners entre los anuncios siguen fuera (ALCANCE §8, versión 1.9).

  · Decisión del cliente. Con una web que aún no tiene usuarios, es más fácil cerrar algo en especie que en dinero. Y sin precio en el papel, la cifra se ajusta a lo que ofrezca cada empresa.
- **D-070 · 2026-11-04** · **Categoría «Oficina y papelería»** (`oficina-papeleria`, icono de maletín), con tres subcategorías: papelería y material escolar, material de oficina y mobiliario de oficina. Precio obligatorio y estado nuevo/usado, sin atributos propios. Va la 13.ª, antes de «Otros»: sale en «Ver todas», no en la cuadrícula del inicio (12). Se creó con la clave de servicio, igual que la crearía el panel; el icono necesitó código (`category-icon.tsx`). · Petición del cliente: tiendas como The Computer Store, la papelería de Martínez Hermanos o la tienda de electrónica y oficina de Ventage no tenían dónde poner el material de oficina y de papelería.
- **D-071 · 2026-11-04** · **El panel de admin se adapta al ordenador.** Desde el ancho de un portátil (`lg`, 1024 px), el menú pasa a la izquierda y el contenido usa el ancho de la pantalla:
  - Resumen, pagos, denuncias, catálogo y ajustes, a dos columnas.
  - Usuarios, en una tabla con el email y el teléfono en sus columnas.
  - La ficha del usuario, con Premium a la izquierda y la moderación y el historial a la derecha.
  - En las denuncias, el formulario de moderación queda a la derecha, siempre a la vista.
  - Los formularios sueltos (nueva categoría, ciudad) no se estiran.

  En el móvil, el panel sigue igual. Solo cambia el CSS (`AdminShell`, `AdminColumns`), sin datos ni permisos nuevos. · Petición del cliente: el panel se va a usar mucho desde el ordenador, también por recepción o agentes.
- **D-072 · 2026-11-04** · **Analítica y errores, sin SDK y sin coste.**
  - **Visitas y búsquedas:** Vercel Web Analytics, que ya estaba (vistas de `/buscar` incluidas). Los eventos propios exigen el plan Pro y no hacen falta.
  - **Métricas de validación (ALCANCE §9):** en el resumen del panel, bajo «Validación del mercado»: % de anuncios publicados en 30 días que reciben algún mensaje, mediana del tiempo de respuesta de los vendedores (el que calcula el cron diario), usuarios activos en 7 días (escribieron o publicaron) con los que vuelven y los nuevos, y solicitudes y activaciones de Premium en 30 días. Se calculan en el servidor con la clave secreta (`lib/admin/validation-metrics.ts`) y no en SQL, porque no se prueban migraciones en producción (D-067). Cuando exista el proyecto de desarrollo, conviene pasarlas a `admin_metrics`: con mucho volumen, traer las filas pesaría.
  - **Errores: Sentry (plan gratuito) sin su SDK**, como Resend. `instrumentation.ts` (`onRequestError`) manda los del servidor (pantallas, Server Actions, rutas de la API y proxy) y `/api/errors` los del navegador, que recoge un componente de menos de 1 KB (errores sin capturar y las pantallas de error). El SDK de Next.js arrastra OpenTelemetry, alarga el arranque en frío y su script de cliente pesa decenas de KB en 3G.
  - Se manda lo justo: tipo, mensaje, pila, ruta **sin la query** (puede llevar tokens), método y navegador. Ni cookies ni otras cabeceras, ni la IP del usuario (sale del servidor). Se descartan los cortes de conexión (`Failed to fetch`, `ChunkLoadError`…), como mucho 5 avisos por visita y sin repetir.
  - Sin `SENTRY_DSN` no se manda nada. Lo crea el cliente: cuenta gratuita en Sentry, proyecto de Next.js y el DSN en Vercel; el aviso del navegador se monta al compilar, así que hace falta un despliegue nuevo.
  · Hace falta para validar el mercado (ALCANCE §4.11 y §9), con la regla de peso mínimo en 3G.
- **D-073 · 2026-11-04** · **Limpieza diaria de Storage** (`lib/storage/cleanup.ts`), en el cron diario (`/api/cron/daily`, 9:00 en Malabo):
  - **Se borra:** lo de cuentas que ya no existen (por ejemplo, las borradas desde el panel de Supabase o los ficheros que no cupieron en el borrado de la cuenta, que lee como mucho 1000), lo de anuncios que ya no existen, las fotos de los anuncios borrados hace **más de 30 días** (con sus filas de `listing_images`) y los ficheros que nadie usa con **más de 24 h** (subidas que se cortaron antes de guardarse, avatares y logos que no se llegaron a guardar).
  - **No se toca:** las fotos de anuncios borrados hace menos de 30 días, por si hay que revisar una denuncia; las de borradores, caducados, vendidos y bloqueados; las del chat, porque los mensajes no se borran, y cualquier ruta que no haya creado la web.
  - Se lista Storage antes de leer la base de datos, y cualquier error de lectura para la limpieza entera. **Freno:** si en un día saldrían más de 100 ficheros y más de la cuarta parte del total, no borra nada y el error llega a Sentry.
  - Sin migración (D-067): usa la API de Storage y el RPC `account_storage_objects` del borrado de cuenta, una llamada por usuario. Con muchos usuarios convendrá hacerlo en SQL.
  - `/api/cron/daily?dry=1` (con `CRON_SECRET`) solo calcula lo que borraría, sin borrar ni avisar. El 2026-11-04 en producción: 10 usuarios con ficheros, 86 ficheros y nada que borrar.
  · ROADMAP 1.2 y ARQUITECTURA §5.2 y §5.5; el plan Free de Supabase tiene 1 GB de Storage.
