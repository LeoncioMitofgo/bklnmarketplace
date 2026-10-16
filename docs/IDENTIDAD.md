# Identidad visual — BKLN Marketplace

> Versión 1.0 — 2026-10-16. Dirección A, **"Atlántico"** (D-031, D-032).
> Lienzo con las tres propuestas y los wireframes: https://claude.ai/artifact/MZ6e1a5Qp5W8V5LfJZU2RN. Es privado; para que otros lo vean hay que compartirlo desde su menú.

---

## 1. Concepto

- **Azul del Atlántico** (el golfo de Guinea y el triángulo de la bandera) para transmitir **confianza**, que es lo que más importa cuando el pago se hace fuera de la app.
- **Naranja coral** para la **acción**: publicar y Premium.
- **Símbolo:** una burbuja de chat con el agujero de una etiqueta de precio. Resume la idea de "compra, vende y habla".

## 2. Logo

```svg
<svg width="44" height="44" viewBox="0 0 44 44">
  <path d="M10 4h24a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H17l-7 7v-7a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8z" fill="#0B4F8A"/>
  <circle cx="11" cy="13" r="3" fill="#FFFFFF"/>
  <path d="M17 19h16M17 25h10" stroke="#F2662B" stroke-width="3" stroke-linecap="round"/>
</svg>
```

- **Logotipo:** **bkln** (peso 800) + marketplace (peso 500), en minúsculas y con Plus Jakarta Sans. En producción se convierte a trazados SVG para no depender de la fuente.
- **Versiones:**
  - Positiva: símbolo azul y texto azul sobre blanco.
  - Negativa: símbolo y texto blancos sobre azul, con el agujero en azul.
  - Las dos líneas del símbolo van **siempre en naranja**.
- **Icono de la app y favicon:** solo el símbolo. Tamaño mínimo, 24 px.

## 3. Colores

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--color-primary` | `#0B4F8A` | Botones principales, enlaces, precios, selección | Texto blanco encima: 8,4:1 |
| `--color-primary-hover` | `#083A66` | Pulsado o hover del primario | — |
| `--color-accent` | `#F2662B` | Botón Publicar, insignia Premium, "Mejor precio" | **Siempre con texto oscuro** (`#0F172A`): 5,7:1. Con texto blanco solo llega a 3,1:1 |
| `--color-text` | `#0F172A` | Texto principal | — |
| `--color-text-muted` | `#475569` | Texto secundario, metadatos | 7,6:1 sobre blanco |
| `--color-bg` | `#FFFFFF` | Fondo | — |
| `--color-surface` | `#F3F6FA` | Cajas, campos, avisos | — |
| `--color-border` | `#D8DEE6` | Bordes y separadores | — |
| `--color-placeholder` | `#E3E9F1` | Huecos de imagen mientras carga | — |
| `--color-success` | `#15803D` | Confirmaciones | Texto blanco: 5,0:1 |
| `--color-danger` | `#B91C1C` | Errores y acciones destructivas | Texto blanco: 6,5:1 |

Reglas:
- **Solo se usan los tokens**; ningún componente lleva un hex suelto.
- El naranja es **solo para la acción de publicar y para Premium**. Nunca para errores ni para texto pequeño.
- Todo texto debe tener un contraste de al menos 4,5:1.

## 4. Tipografía

- **Títulos y precios:** Plus Jakarta Sans, **un solo peso (800)**. Se aloja en nuestro propio servidor con `next/font`, solo con los caracteres latinos y con `display: swap`. Son unos 20–25 KB que se descargan una vez y quedan en caché.
- **Todo lo demás:** la fuente del sistema, `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Pesa 0 KB y en Android es Roboto.

| Uso | Tamaño / interlineado | Fuente y peso |
|---|---|---|
| Título de página (h1) | 24 / 1,2 | Plus Jakarta Sans 800 |
| Título de sección (h2) | 17 / 1,3 | Plus Jakarta Sans 800 |
| Precio en la ficha | 26 | Plus Jakarta Sans 800, primario |
| Precio en una tarjeta | 15–17 | Plus Jakarta Sans 800, primario |
| Cuerpo | 15 / 1,5 | Sistema 400 |
| Secundario | 13 | Sistema 400, `text-muted` |
| Mínimo absoluto | 12 | — |
| Campos de formulario | **16 como mínimo** (evita el zoom automático en iOS) | Sistema |

## 5. Formas, espacio e iconos

- **Radios:** 12 px en botones y campos · 14 px en tarjetas · 999 px en chips e insignias.
- **Alturas:** botón principal 52 px (48 como mínimo) · campos 52 px · chips 36–40 px · **cualquier zona táctil, 44 px como mínimo**.
- **Espaciado:** base de 4 (8 / 12 / 16 / 24). Margen lateral de pantalla, 16 px.
- **Sin sombras ni degradados:** bordes de 1 px. Pesa menos y se ve nítido en pantallas baratas.
- **Iconos:** Lucide, trazo de 2, entre 20 y 24 px. Los que no llevan texto necesitan `aria-label`.

## 6. Componentes base

- **Barra inferior:** Inicio · Buscar · **Publicar** (botón redondo naranja) · Mensajes (con contador de no leídos) · Perfil.
- **Tarjeta de anuncio:**
  - Foto en 4:3, insignia PREMIUM y botón de favorito.
  - Precio (Plus Jakarta Sans, azul).
  - Título en un máximo de 2 líneas.
  - "Barrio · hace X".
- **Ficha:** barra fija abajo con **WhatsApp** (contorno, solo con sesión y si el vendedor lo activó) y **Chatear** (relleno).
- **Aviso de seguridad:** caja de superficie con icono de escudo, en la ficha y al principio de cada conversación.
- **Estados obligatorios** en cada pantalla:
  - Carga, vacío y error.
  - Sin conexión, con "Reintentar".
  - "Borrador guardado" en los formularios largos.

## 7. Pantallas (wireframes v1, en el lienzo)

| # | Pantalla | Decisiones de diseño |
|---|---|---|
| 01 | Inicio | Categorías en rejilla de 4×3 · "Destacados" (Premium) en carrusel · "Recientes en <ciudad>" · botón **"Ver más anuncios"** en lugar de scroll infinito, para que el usuario decida cuándo gasta datos |
| 02 | Resultados | Filtros activos como chips que se pueden quitar · lista con miniatura a la izquierda · orden |
| 03 | Filtros | Hoja inferior con los atributos de la categoría · el botón muestra cuántos resultados hay ("Ver 37 resultados") |
| 04 | Ficha | Galería con contador · precio + "Negociable" · detalles · vendedor con tiempo de respuesta · consejos de seguridad · similares · denunciar |
| 05 | Tienda Premium | Portada, logo, URL `/t/…`, horario, dirección · pestañas "En venta" / "Vendidos" |
| 06 | Entrar | Un solo campo "Usuario, email o teléfono" · explica por qué hace falta la cuenta y que se volverá al anuncio |
| 07 | Crear cuenta | `+240` fijo · comprobación del usuario en directo · explicación de para qué sirven el teléfono y el email |
| 08 | Publicar · fotos | **4 pasos** · estados de subida (progreso, error con "Reintentar") · "Guardado" |
| 09 | Publicar · detalles | Atributos de la categoría, descripción, precio en FCFA + negociable, ciudad y barrio, todo en un paso |
| 10 | Mensajes | Filtro Comprando / Vendiendo · estados "Vendido", "Usuario eliminado" y "Anuncio eliminado" |
| 11 | Conversación | Anuncio fijado arriba · aviso de seguridad · foto · "Visto" · bloquear o denunciar desde el menú |
| 12 | Hazte Premium | Comparativa Normal/Premium · 4 periodos con precio por mes · oficina y agencia · botón de WhatsApp para el código |
| 13 | Admin | Usable desde el móvil · denuncias con acceso al chat denunciado · pagos por confirmar con referencia única y fecha de fin calculada |
