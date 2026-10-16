# BKLN Marketplace — Documento de alcance

> **Fuente de verdad del producto.** Versión 1.6 — 2026-10-16 (1.1: registro e inicio de sesión · 1.2–1.4: precios y pago de Premium, nombre y dominio · 1.5: ajustes del modelo de datos · 1.6: ajustes de los wireframes).
> Cualquier cambio de alcance se refleja aquí y se registra en [DECISIONES.md](DECISIONES.md).

---

## 1. Visión

Marketplace de clasificados **generalista** para Guinea Ecuatorial, en la línea de Jiji (Ghana/Nigeria), con **perfiles de vendedor y catálogo** como en Vinted. Cualquier persona puede comprar y vender; los negocios pueden tener una tienda online, gratis o Premium.

Propuesta de valor:

- **Comprador**: encontrar productos y servicios locales con fotos, precio y ubicación, y hablar con el vendedor sin dar su número.
- **Vendedor particular**: publicar en un minuto desde el móvil y tener un catálogo que puede compartir por WhatsApp.
- **Negocio (Premium)**: tienda propia con URL, más visibilidad y más credibilidad.

## 2. Tipo de producto

- **Web app responsive, mobile first.** No hay app nativa por ahora (posible PWA más adelante).
- **Clasificados C2C + B2C.** La plataforma **pone en contacto, pero no intermedia ni pagos ni entregas** en v1. No hay carrito, pedidos ni checkout. La unidad central es el **anuncio** y la **conversación**.
- **Mercado:** solo Guinea Ecuatorial. **Moneda:** XAF (FCFA). **Idioma:** español, preparado para francés.
- **Nombre:** BKLN Marketplace. **Dominio:** `bklnmarketplace.com`.
- **Monetización:** suscripción Premium. Comisiones solo cuando existan pagos dentro de la app (fase 3).

## 3. Actores y permisos

| Acción | Visitante | Usuario | Premium | Admin |
|---|:-:|:-:|:-:|:-:|
| Ver home, categorías, búsqueda, anuncios, perfiles y tiendas | ✅ | ✅ | ✅ | ✅ |
| Compartir anuncio o tienda | ✅ | ✅ | ✅ | ✅ |
| Chatear con un vendedor | ❌ → se le pide registro | ✅ | ✅ | ✅ |
| Ver botón WhatsApp/llamar (si el vendedor lo activa) | ❌ | ✅ | ✅ | ✅ |
| Guardar favoritos | ❌ → se le pide registro | ✅ | ✅ | ✅ |
| Publicar anuncios | ❌ → se le pide registro | ✅ límites Normal | ✅ límites Premium | ✅ |
| Tienda personalizada (logo, portada, URL propia…) | ❌ | ❌ | ✅ | — |
| Reportar anuncio o usuario, bloquear usuario | ❌ | ✅ | ✅ | ✅ |
| Moderar, gestionar categorías y usuarios, activar Premium | ❌ | ❌ | ❌ | ✅ |

Una sola cuenta sirve para comprar y vender. "Vendedor" no es un tipo de cuenta: es cualquier usuario que tiene anuncios.

## 4. Funcionalidades del MVP

### 4.1 Catálogo público
- Home: categorías, sección "Destacados" (anuncios de vendedores Premium, en rotación) y anuncios recientes.
- Búsqueda por texto con filtros de categoría/subcategoría, ciudad, rango de precio y estado (nuevo/usado), más los atributos clave de la categoría.
- Orden: relevancia (Premium primero a igualdad de relevancia), más recientes, precio ascendente y descendente.
- Listados paginados con un botón **"Ver más"** y sin scroll infinito, para que el usuario decida cuándo gasta datos. Miniaturas ligeras.

### 4.2 Ficha de anuncio
- Galería de fotos ligera, título, precio (o "Negociable" / "A consultar" en servicios), descripción, atributos, ciudad + barrio, fecha y número de vistas.
- Tarjeta del vendedor: foto, nombre, insignia Premium, ciudad, miembro desde, tiempo de respuesta y enlace a su perfil o tienda.
- Acciones: **Chatear**, WhatsApp/llamar (si está activado y hay sesión), favorito, compartir y reportar.
- Bloque fijo de consejos de seguridad.
- Anuncios similares.

### 4.3 Cuentas y perfil
- **Registro** en un solo formulario: nombre visible, nombre de usuario, teléfono (+240), email, contraseña y aceptación de los términos. **Todo obligatorio.** Reglas en §5.7.
- **Inicio de sesión**: un único campo "Usuario, email o teléfono" + contraseña.
- **Recuperar contraseña** por email (enlace), escribiendo cualquiera de los tres identificadores.
- Si un visitante intenta una acción que requiere cuenta, se registra o inicia sesión y **vuelve exactamente a donde estaba** (por ejemplo, con el chat del anuncio ya abierto).
- Perfil: nombre visible, @usuario, foto, ciudad, descripción corta, teléfono (privado) y opción "mostrar botón WhatsApp/llamar" (desactivada por defecto). URL pública: `/u/<usuario>`.
- Ajustes: notificaciones, cambiar datos (usuario, email y teléfono con las mismas reglas de unicidad), cambiar contraseña y **borrar cuenta**.

### 4.4 Publicación y gestión de anuncios
- Asistente de publicación en **4 pasos** pensado para móvil: fotos → categoría → detalles (atributos, descripción, precio y ubicación) → revisar y publicar.
- Fotos comprimidas en el dispositivo antes de subir, con progreso, reintento y metadatos EXIF (GPS) eliminados.
- Guardado de borrador, para no perder nada si se cae la conexión.
- "Mis anuncios": activos, pausados, vendidos, caducados. Acciones: editar, pausar/reactivar, marcar como vendido, renovar y eliminar.
- Para publicar hace falta tener el **email confirmado** (§5.7) y **al menos una foto** (en Servicios vale un logo o un cartel). Se comprueban los límites del plan al publicar o reactivar.

### 4.5 Chat
- Una conversación por (anuncio, comprador, vendedor), en tiempo real.
- Mensajes de texto e imagen. Cada conversación muestra arriba la tarjeta del anuncio.
- Bandeja de mensajes con contador de no leídos y estado leído/no leído.
- Bloquear y reportar usuario desde el chat.
- Aviso anti‑estafa al iniciar una conversación.
- Si el anuncio se vende o se elimina, la conversación se conserva y muestra su nuevo estado.

### 4.6 Notificaciones
**Es crítico**: si el vendedor no se entera de que le han escrito, el chat muere y todo vuelve a WhatsApp.
- Contador de no leídos dentro de la app.
- **Push web** (bien soportado en Android, que es mayoritario).
- **Email** de respaldo para mensajes nuevos, si el usuario tiene email, con agrupación para no saturar.
- Avisos de anuncio por caducar, anuncio caducado, Premium por caducar y anuncio bloqueado por moderación.

### 4.7 Favoritos
- Guardar o quitar anuncios y ver la lista. Si un favorito se vende o caduca, se indica.

### 4.8 Perfil público y tienda
- **Perfil (Normal)**: foto, nombre, ciudad, miembro desde, tiempo de respuesta y catálogo de anuncios activos (más los vendidos recientes, marcados como tales).
- **Tienda (Premium)**: lo anterior, más logo, portada, descripción, horario, dirección, enlace de WhatsApp de la tienda e **URL propia `/t/<slug>`**, compartible e indexable.

### 4.9 Premium
Ver reglas en §5.3. En el MVP: solicitud desde la app, pago en efectivo en la oficina, activación manual por admin, límites ampliados, insignia, tienda, prioridad en resultados y presencia en "Destacados".

### 4.10 Moderación y seguridad
Ver reglas en §5.5. En el MVP: reportes, auto‑ocultado por umbral, palabras y categorías prohibidas, límites de ritmo (rate limits) y bloqueo entre usuarios.

### 4.11 Panel de administración
- Cola de reportes: revisar, bloquear o restaurar el anuncio, suspender o banear al usuario, siempre con motivo.
- Usuarios: buscar, ver detalle, suspender o banear, **activar o extender Premium** (periodo, importe, método de pago, número de recibo).
- Categorías y atributos: crear, editar, ordenar y desactivar.
- Ciudades: lista editable.
- Métricas básicas: anuncios publicados, usuarios nuevos, conversaciones iniciadas y Premium activos.

---

## 5. Reglas de negocio

### 5.1 Estados del anuncio

```
borrador ──publicar──▶ activo ──▶ pausado ──reactivar──▶ activo
                         │
                         ├──▶ vendido   (sale de la búsqueda; visible en el perfil como "Vendido")
                         ├──▶ caducado  (al vencer su duración; el vendedor puede renovar → activo)
                         ├──▶ bloqueado (por moderación; el vendedor ve el motivo)
                         └──▶ eliminado (borrado lógico)
```

- Solo los anuncios **activos** aparecen en búsqueda, home y destacados.
- Los anuncios **pausados no cuentan** para el límite de activos. Reactivar comprueba el límite.
- Solo se puede **renovar** un anuncio caducado o que esté en sus últimos 3 días. Al renovar se reinicia la duración.
- Un anuncio bloqueado no se puede reactivar sin pasar por el admin.

### 5.2 Límites por plan (valores iniciales, configurables)

| | Normal (gratis) | Premium |
|---|---|---|
| Anuncios activos simultáneos | 10 | 200 |
| Fotos por anuncio | 6 | 15 |
| Duración del anuncio | 30 días | 60 días |
| Renovación | Manual | Automática mientras Premium esté activo |
| Perfil | Básico | Tienda personalizada + `/t/<slug>` |
| Insignia | — | Premium |
| Visibilidad | Normal | Prioridad en resultados + sección "Destacados" |

Estos valores viven en **una única configuración de planes** y el código nunca los repite. Están pendientes de validar (ver DECISIONES).

### 5.3 Premium
- **Plan único** para vendedores. El descuento es proporcional a la duración (el año completo tiene un 45 %):

| Periodo | Precio | Descuento | Equivale a |
|---|---|---|---|
| 1 mes | **5.000 FCFA** | — | 5.000 FCFA/mes |
| 3 meses | **13.300 FCFA** | 11,25 % | ~4.433 FCFA/mes |
| 6 meses | **23.250 FCFA** | 22,5 % | 3.875 FCFA/mes |
| 12 meses | **33.000 FCFA** | 45 % | 2.750 FCFA/mes |

- Los precios viven en la configuración de planes, igual que los límites. El precio exacto de 3 meses sería 13.312,5 y se redondea a la centena.
- **Formas de pago en el MVP** (fuera de la app, comprobadas a mano por el admin):
  - **En Malabo: efectivo en la oficina.** BKLN Software & Systems, Banapa, Malabo. De lunes a viernes de 8:00 a 16:00 y los sábados de 11:00 a 14:00.
  - **Fuera de Malabo: envío de dinero por agencia.** El usuario envía el importe por una agencia de envío de dinero **a nombre de BKLN Marketplace** y comparte el código del envío por WhatsApp al **+240 555 220 846**.
  - La transferencia bancaria y Rosa Money (mobile money) se integrarán en la app más adelante (fase 3).
  - La dirección, el horario, el WhatsApp de pagos y el beneficiario de los envíos van en la configuración de la app, no en el código.
- **Flujo:**
  1. El usuario pulsa "Hazte Premium" y ve las ventajas, los precios y las dos formas de pago.
  2. Elige el periodo y envía la solicitud, que queda "pendiente de pago".
  3. Paga en la oficina, o bien envía el dinero por agencia y pulsa "Enviar código por WhatsApp". Se abre WhatsApp con un mensaje ya escrito (usuario, periodo, importe y un hueco para el código).
  4. El admin comprueba el cobro, lo registra (importe, método, número de recibo o código de envío) y activa Premium con fecha de fin.
  5. El usuario recibe un aviso. Queda registro de la activación: quién la hizo, cuándo, importe, método y referencia.
- **Cada referencia** (recibo o código de envío) solo se puede usar una vez.
- **Renovar estando activo**: el nuevo periodo se suma a la fecha de fin actual, no a la de hoy.
- **Aviso 7 días antes** de que caduque.
- **Al caducar** vuelve a Normal:
  - Si tiene más anuncios activos que el límite Normal, se **pausan automáticamente los más antiguos** y el usuario elige cuáles reactivar.
  - La tienda personalizada deja de mostrarse, pero **sus datos se conservan** por si renueva.
  - Las duraciones de los anuncios vigentes se mantienen hasta que venzan.
- El diseño debe permitir más adelante: pago automático de Premium, varios niveles y destacados sueltos.

### 5.4 Contacto
- El chat requiere cuenta. El visitante que pulsa "Chatear" pasa por registro o inicio de sesión y vuelve al chat de ese anuncio.
- El botón de WhatsApp/llamar es **opcional por vendedor** (desactivado por defecto) y **solo visible con sesión iniciada**. Usa `wa.me` con un mensaje prellenado con el título y el enlace del anuncio.
- El teléfono y el email **nunca** aparecen en páginas públicas, en HTML indexable ni en metadatos.
- Un vendedor no puede chatear consigo mismo en su propio anuncio.

### 5.5 Moderación
- **Publicación inmediata**, sin revisión previa. La moderación es a posteriori.
- **Contenido prohibido** (lista editable): armas, drogas, medicamentos con receta, documentos oficiales, fauna protegida, contenido sexual, falsificaciones, servicios ilegales.
- **Reportes** con motivo: estafa, prohibido, duplicado, categoría incorrecta, ofensivo u otro. Con **3 reportes** de usuarios distintos (configurable) el anuncio se **oculta automáticamente** hasta que lo revise un admin.
- **Límites de ritmo**: tope de anuncios al día y de conversaciones nuevas por hora, más estrictos para cuentas recién creadas.
- Detección básica de duplicados: mismo usuario, título y fotos muy parecidos.
- Bloqueo entre usuarios: un usuario bloqueado no puede escribir a quien lo bloqueó.

### 5.6 Formatos locales
- **Precio**: entero en XAF, sin decimales, mostrado como `150.000 FCFA`. Lleva marca "Negociable". En Servicios el precio es opcional ("A consultar"). En alquileres se muestra "/mes".
- **Teléfono**: `+240` + 9 dígitos, normalizado al guardar.
- **Fecha y hora**: `dd/mm/aaaa`, zona horaria `Africa/Malabo` (UTC+1). Fechas relativas en listados ("hace 2 h").
- **Ubicación**: ciudad (lista cerrada y editable) + barrio o zona (texto libre). Sin mapas ni geolocalización en el MVP.
- Lista inicial de ciudades (editable desde el admin): Malabo, Bata, Ebebiyín, Mongomo, Luba, Evinayong, Aconibe, Añisok, Mbini, Cogo, Niefang, Micomeseng, Riaba, Baney, Ciudad de la Paz, San Antonio de Palé.

### 5.7 Cuentas e identificadores
- **Tres identificadores únicos**: nombre de usuario, teléfono y email. Cualquiera de ellos, con la contraseña, sirve para iniciar sesión.
- **Nombre de usuario**:
  - De 3 a 20 caracteres: minúsculas, números, `.` y `_`.
  - **Tiene que empezar por una letra**, para no confundirse nunca con un teléfono.
  - Único sin distinguir mayúsculas.
  - Hay una lista de nombres reservados (admin, soporte, bkln, anuncio, t, u…).
  - Es público (@usuario).
- **Teléfono**:
  - `+240` + 9 dígitos, normalizado al guardar (se aceptan espacios y con o sin prefijo).
  - Es el identificador preferente y el que usa el botón WhatsApp/llamar.
  - **No se verifica por SMS en el MVP**, por coste. Queda como "no verificado" hasta que exista la verificación (fase 2).
- **Email**:
  - Se guarda en minúsculas y se envía un enlace de confirmación.
  - La cuenta funciona desde el primer momento (navegar, chatear, favoritos), pero **para publicar hay que confirmar el email**, porque es el único canal gratuito para recuperar la contraseña.
- **Reconocer el identificador al iniciar sesión**: si contiene `@` es un email; si solo tiene dígitos, espacios o `+` es un teléfono; en cualquier otro caso es un nombre de usuario. La búsqueda de la cuenta se hace siempre en el servidor.
- **Contraseña**: mínimo 8 caracteres, sin reglas de complejidad que frenen, con botón de mostrar/ocultar.
- **Seguridad**:
  - Mensaje de error genérico ("Usuario o contraseña incorrectos"), sin revelar qué identificador existe.
  - Límite de intentos: por ejemplo, 5 fallos por identificador cada 15 minutos.
  - El email y el teléfono solo se muestran al propio usuario. En la recuperación de contraseña aparecen enmascarados (`j***@gmail.com`).
- **Conflictos**: si alguien registra un teléfono que no es suyo, lo resuelve el admin a mano hasta que exista la verificación de teléfono.
- **Borrar la cuenta** elimina todo lo del usuario: perfil, tienda, anuncios, fotos y favoritos. Hay dos excepciones:
  - Sus mensajes en conversaciones con otros se conservan como "Usuario eliminado", para que la otra persona no pierda su historial ni las pruebas si hubo una estafa.
  - Los cobros de Premium se guardan por contabilidad.

## 6. Categorías iniciales

Generalista tipo Jiji. Los atributos se definen **por categoría** (configurables desde el admin, sin tocar código):

| Categoría | Subcategorías (ejemplos) | Atributos específicos |
|---|---|---|
| Vehículos | Coches, motos, camiones y furgonetas, piezas y accesorios | Marca, modelo, año, km, combustible, transmisión |
| Inmuebles | Casas y pisos en venta, casas y pisos en alquiler, terrenos, locales y oficinas en venta, locales y oficinas en alquiler | Tipo, habitaciones, baños, m², amueblado. La subcategoría decide si el precio lleva "/mes" |
| Móviles y tablets | Móviles, tablets, accesorios | Marca, modelo, almacenamiento |
| Electrónica | TV y audio, ordenadores, consolas, cámaras | Marca |
| Hogar y muebles | Muebles, electrodomésticos, cocina, decoración | — |
| Moda y belleza | Ropa de hombre/mujer/niños, calzado, bolsos, joyas, cosmética | Talla, género |
| Bebés y niños | Ropa, carritos, juguetes | — |
| Construcción y herramientas | Materiales, herramientas, generadores, fontanería y electricidad | — |
| Agricultura y alimentación | Productos agrícolas, maquinaria, alimentación | — |
| Animales y mascotas | Mascotas, accesorios (con restricciones) | — |
| Deporte y ocio | Deporte, instrumentos, libros | — |
| Servicios | Reparaciones, limpieza, clases, eventos, transporte, belleza | Precio opcional |
| Otros | — | — |

Todos los anuncios tienen además: estado (nuevo/usado, cuando aplique), precio, negociable, ciudad y barrio.
**Empleo queda fuera del MVP** (fase 2).

## 7. Requisitos no funcionales

- **Mobile first**: diseño base a 360 px, zonas táctiles de al menos 44 px y barra inferior (Inicio · Buscar · **Publicar** · Mensajes · Perfil).
- **Rendimiento con conexión lenta**: páginas públicas renderizadas en servidor y con poco JavaScript. La primera carga tiene que ser usable en 3G y en Android de gama baja. Las imágenes van en WebP, con un máximo de ~1600 px en el lado largo, miniaturas generadas y carga diferida.
- **Robustez**: subidas con reintento, borradores guardados, estados claros de carga, error y sin conexión. El usuario nunca pierde lo que ha escrito.
- **SEO**: URLs legibles (`/anuncio/iphone-13-128gb-malabo-a1b2c3`), metadatos, sitemap, datos estructurados (Product/Offer) y tiendas indexables.
- **Compartir**: Open Graph con foto, título, precio y ciudad, para que la vista previa en WhatsApp y Facebook se vea bien.
- **i18n**: todos los textos de la interfaz en ficheros de traducción (`es`) desde el día 1.
- **Privacidad**: teléfono y email nunca públicos, EXIF eliminado, posibilidad de borrar la cuenta, términos de uso y política de privacidad.
- **Seguridad**: validación en el servidor, cada usuario solo puede modificar lo suyo (permisos por fila), subidas validadas por tipo y tamaño, límites de ritmo.
- **Medición**: analítica básica (vistas, búsquedas, anuncios publicados, conversaciones iniciadas, tiempo de respuesta) y monitorización de errores. Hace falta para validar el mercado.
- **Accesibilidad básica**: contraste, etiquetas en los formularios y textos alternativos.

## 8. Fuera de alcance del MVP

| Funcionalidad | Fase prevista |
|---|---|
| Estadísticas por anuncio para Premium (vistas, contactos, favoritos) | 2 |
| Respuestas rápidas en el chat (Premium) | 2 |
| Valoraciones de vendedores (ligadas a una conversación real) | 2 |
| Verificación de vendedores (insignia "Verificado") | 2 |
| Verificación de teléfono (OTP por SMS o WhatsApp) y recuperación de contraseña por teléfono | 2 |
| Alertas de búsqueda guardada | 2 |
| Categoría Empleo | 2 |
| Francés | 2 |
| PWA instalable / modo sin conexión básico | 2 |
| Aviso de mensajes nuevos por WhatsApp/SMS | 2 |
| Pagos dentro de la app (Rosa Money, transferencia bancaria) y pago automático de Premium | 3 |
| Envíos / integración con delivery | 3 |
| App móvil nativa | 3 |
| Expansión a otros países (CEMAC) | 3+ |
| Ideas a evaluar (no comprometidas): destacados sueltos de pago, niveles Pro/Tienda, ofertas formales de precio, banners publicitarios | — |

## 9. Métricas de validación

- Anuncios activos y publicaciones por semana.
- % de anuncios que reciben al menos un mensaje.
- Tiempo medio de primera respuesta del vendedor.
- Usuarios que vuelven cada semana.
- Solicitudes y activaciones de Premium.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Los vendedores no se enteran de los mensajes y el chat muere | Push web + email desde el MVP; aviso por WhatsApp/SMS en fase 2; mostrar el tiempo de respuesta en el perfil |
| Estafas, porque el pago va fuera de la app | Avisos de seguridad, reportes, bloqueo, auto‑ocultado y verificación de vendedores (fase 2) |
| Huevo y gallina: pocos anuncios al principio | Sembrar con vendedores y tiendas fundadoras (por ejemplo, Premium gratis los primeros meses) y compartir por WhatsApp sin fricción |
| Conexión lenta y datos caros | El rendimiento es un requisito; imágenes comprimidas en el dispositivo |
| Coste o entrega poco fiable de los SMS | Login con contraseña, sin códigos por SMS; recuperación por email; verificación de teléfono en fase 2 (SMS o WhatsApp) |
| Gestión manual de Premium que no escala | Aceptable para validar; el diseño debe permitir automatizarlo con pagos in-app |
| Los vendedores de otras ciudades no pueden pagar en la oficina | Envío por agencia con el código por WhatsApp (D-025); transferencia y Rosa Money integrados en la fase 3 |
| Códigos de envío falsos o reutilizados | El admin solo activa tras comprobar el cobro en la agencia; cada código se guarda y no puede repetirse |
