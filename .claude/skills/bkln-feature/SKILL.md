---
name: bkln-feature
description: Checklist de producto de BKLN Marketplace. Úsala SIEMPRE antes de planificar, diseñar o implementar cualquier funcionalidad, pantalla, componente, modelo de datos o endpoint del marketplace (anuncios, búsqueda, chat, perfiles/tiendas, favoritos, Premium, moderación, admin, notificaciones), y cuando una petición pueda salirse del alcance del MVP o contradecir una decisión tomada.
---

# bkln-feature — mantener la línea del producto

Sirve para que cada funcionalidad respete el alcance, las reglas de negocio y las particularidades de Guinea Ecuatorial sin tener que releer todo el proyecto.

## 1. Ubicar la tarea (antes de escribir nada)

1. Busca la tarea en `docs/ROADMAP.md`: ¿en qué fase está?
   - Si es de **fase 2/3**, o aparece en "Fuera de alcance" (`docs/ALCANCE.md` §8): **para y avisa**. Propón la versión mínima compatible con el MVP o pide confirmación para adelantarla.
2. Lee **solo la sección relevante** de `docs/ALCANCE.md`: permisos §3, funcionalidad §4.x, reglas §5.x, categorías §6. Si la tarea toca datos, lee también la parte correspondiente de `docs/MODELO-DATOS.md` (tablas §3, estados §5.3, RLS §6).
3. Revisa `docs/DECISIONES.md`:
   - No contradigas ninguna decisión tomada sin avisar.
   - Si la tarea depende de una **pendiente** (stack, método de login, precios…), pregunta antes de asumir nada.

## 2. Checklist de diseño e implementación

**Mobile y conexión lenta**
- [ ] Diseñado primero a 360 px; zonas táctiles de al menos 44 px; acción principal al alcance del pulgar.
- [ ] Páginas públicas renderizadas en servidor y con el mínimo JS de cliente.
- [ ] Imágenes comprimidas en el dispositivo, miniaturas, carga diferida y EXIF eliminado.
- [ ] Estados de carga, vacío, error y "sin conexión / reintentar". Nunca se pierde lo que el usuario escribió (formularios, mensajes, borradores).
- [ ] Listados paginados; nunca se carga todo.

**Reglas de negocio**
- [ ] Permisos claros para visitante, usuario, Premium y admin (ALCANCE §3).
- [ ] Los límites (anuncios, fotos, duración) se leen de la **configuración de planes**, sin números mágicos.
- [ ] Si un visitante intenta algo que requiere cuenta: login y **vuelta exacta** al punto de origen.
- [ ] Teléfono y email del usuario nunca expuestos en páginas públicas, HTML indexable ni metadatos.
- [ ] Transiciones de estado del anuncio válidas (ALCANCE §5.1).
- [ ] Nada de carrito, checkout ni pedidos: la unidad es el anuncio + la conversación.

**Particularidades de GE**
- [ ] Textos en ficheros i18n (`es`), nunca escritos directamente en el código.
- [ ] Precio entero en XAF → `150.000 FCFA`; teléfonos `+240` + 9 dígitos; hora `Africa/Malabo`.
- [ ] Si la página es pública: URL legible en español y Open Graph para compartir por WhatsApp.

**Confianza y seguridad**
- [ ] Validación en el servidor; cada usuario solo lee o modifica lo suyo.
- [ ] ¿Hace falta aquí reportar, bloquear o un límite de ritmo?
- [ ] ¿Corresponde un aviso anti‑estafa?

**Simplicidad**
- [ ] ¿Es la versión más simple que valida la idea? Sin abstracciones "por si acaso".
- [ ] Aun así, no impide lo previsto en fases futuras (pagos in-app, francés, más niveles de Premium).

**Identidad** (ver `docs/IDENTIDAD.md`)
- [ ] Solo tokens de color, tipografía, radios y alturas; ningún hex suelto.
- [ ] Naranja (`--color-accent`) solo para Publicar y Premium, y siempre con texto oscuro.
- [ ] Plus Jakarta Sans solo en títulos y precios; el resto, con la fuente del sistema.
- [ ] Si la pantalla está en los wireframes, sigue su estructura (IDENTIDAD §7) salvo que se acuerde otra cosa.

**Técnico** (ver `docs/ARQUITECTURA.md`)
- [ ] Server Component por defecto; `"use client"` solo donde haya interacción real.
- [ ] Una pantalla = una ida y vuelta: los datos se piden en el servidor y en paralelo; nada de cascadas de peticiones desde el cliente.
- [ ] Tabla nueva → migración SQL a mano en `supabase/migrations/` con **RLS activado y sus políticas en la misma migración**; después, regenerar los tipos.
- [ ] Las reglas críticas (límites de plan, email confirmado para publicar, estados del anuncio, bloqueos) se aplican también en la base de datos (RLS o trigger), no solo en la interfaz.
- [ ] Mutaciones con Server Actions + Zod, invalidando la caché de las páginas públicas afectadas.
- [ ] Secretos solo en el servidor (`SUPABASE_SECRET_KEY`, VAPID privada, Resend, `CRON_SECRET`), nunca en variables `NEXT_PUBLIC_`.
- [ ] Rendimiento medido en una preview de Vercel, no en local: en local la base de datos queda a ~150 ms.

## 3. Al terminar

- Marca la casilla correspondiente en `docs/ROADMAP.md`.
- Si se tomó o cambió una decisión, añádela a `docs/DECISIONES.md` con número y fecha.
- Si cambió el alcance (con el visto bueno del cliente), actualiza `docs/ALCANCE.md` y su versión.
