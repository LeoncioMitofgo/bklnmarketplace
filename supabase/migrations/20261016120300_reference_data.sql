-- Datos de referencia que producción también necesita: planes, precios, ajustes, ciudades y categorías.
-- Fuentes: D-013 (límites), D-022 (precios), D-025 (oficina y pagos), ALCANCE §5.6 y §6, D-028 (Inmuebles).
-- Se pueden editar después desde el admin; esta migración solo pone los valores iniciales.

-- ─── Planes y precios ────────────────────────────────────────────────────────

insert into public.plans (id, max_active_listings, max_photos, listing_duration_days, auto_renew, has_store, is_featured) values
  ('normal', 10, 6, 30, false, false, false),
  ('premium', 200, 15, 60, true, true, true);

insert into public.plan_prices (plan_id, months, price_xaf) values
  ('premium', 1, 5000),
  ('premium', 3, 13300),
  ('premium', 6, 23250),
  ('premium', 12, 33000);

-- ─── Ajustes ─────────────────────────────────────────────────────────────────

insert into public.app_settings (key, value, is_public) values
  ('office', jsonb_build_object(
      'name', 'BKLN Software & Systems',
      'address', 'Banapa, Malabo',
      'hours', 'Lunes a viernes 8:00–16:00 · Sábados 11:00–14:00',
      'payments_whatsapp', '+240555220846',
      'agency_beneficiary', 'BKLN Marketplace'
    ), true),
  ('report_hide_threshold', '3'::jsonb, false),
  ('renew_window_days', '3'::jsonb, false),
  ('rate_limits', jsonb_build_object(
      'new_account_days', 7,
      'listings_per_day', 20,
      'listings_per_day_new_account', 5,
      'conversations_per_hour', 30,
      'conversations_per_hour_new_account', 10,
      'whatsapp_reveals_per_day', 30,
      'login_attempts_per_15_min', 5
    ), false),
  ('banned_terms', '["cocaína", "marihuana", "munición", "billetes falsos", "dni falso", "pasaporte falso", "marfil", "pangolín"]'::jsonb, false),
  ('reserved_usernames', '["admin", "administrador", "soporte", "ayuda", "bkln", "bklnmarketplace", "marketplace", "anuncio", "anuncios", "categoria", "buscar", "publicar", "mensajes", "perfil", "tienda", "premium", "ajustes", "entrar", "registro", "api", "www", "root", "system"]'::jsonb, false);

-- ─── Ciudades (ALCANCE §5.6) ─────────────────────────────────────────────────

insert into public.cities (slug, name, sort_order) values
  ('malabo', 'Malabo', 1),
  ('bata', 'Bata', 2),
  ('aconibe', 'Aconibe', 10),
  ('anisok', 'Añisok', 10),
  ('baney', 'Baney', 10),
  ('ciudad-de-la-paz', 'Ciudad de la Paz', 10),
  ('cogo', 'Cogo', 10),
  ('ebebiyin', 'Ebebiyín', 10),
  ('evinayong', 'Evinayong', 10),
  ('luba', 'Luba', 10),
  ('mbini', 'Mbini', 10),
  ('micomeseng', 'Micomeseng', 10),
  ('mongomo', 'Mongomo', 10),
  ('niefang', 'Niefang', 10),
  ('riaba', 'Riaba', 10),
  ('san-antonio-de-pale', 'San Antonio de Palé', 10);

-- ─── Categorías principales (ALCANCE §6) ────────────────────────────────────

insert into public.categories (slug, name, icon, price_required, has_condition, sort_order) values
  ('vehiculos', 'Vehículos', 'car', true, true, 1),
  ('inmuebles', 'Inmuebles', 'building-2', true, false, 2),
  ('moviles-tablets', 'Móviles y tablets', 'smartphone', true, true, 3),
  ('electronica', 'Electrónica', 'monitor', true, true, 4),
  ('hogar', 'Hogar y muebles', 'sofa', true, true, 5),
  ('moda-belleza', 'Moda y belleza', 'shirt', true, true, 6),
  ('bebes-ninos', 'Bebés y niños', 'baby', true, true, 7),
  ('construccion-herramientas', 'Construcción y herramientas', 'hammer', true, true, 8),
  ('agricultura-alimentacion', 'Agricultura y alimentación', 'sprout', true, true, 9),
  ('animales-mascotas', 'Animales y mascotas', 'paw-print', true, false, 10),
  ('deporte-ocio', 'Deporte y ocio', 'dumbbell', true, true, 11),
  ('servicios', 'Servicios', 'wrench', false, false, 12),
  ('otros', 'Otros', 'package', true, true, 13);

-- ─── Subcategorías (heredan las banderas del padre salvo excepción) ─────────

insert into public.categories (parent_id, slug, name, price_required, price_period, has_condition, sort_order)
select p.id, s.slug, s.name,
       coalesce(s.price_required, p.price_required),
       coalesce(s.price_period, 'total')::public.price_period,
       coalesce(s.has_condition, p.has_condition),
       s.sort_order
from (values
  ('vehiculos', 'coches', 'Coches', null::boolean, null::text, null::boolean, 1),
  ('vehiculos', 'motos', 'Motos', null, null, null, 2),
  ('vehiculos', 'camiones-furgonetas', 'Camiones y furgonetas', null, null, null, 3),
  ('vehiculos', 'piezas-accesorios-vehiculos', 'Piezas y accesorios', null, null, null, 4),

  ('inmuebles', 'casas-pisos-venta', 'Casas y pisos en venta', null, 'total', null, 1),
  ('inmuebles', 'casas-pisos-alquiler', 'Casas y pisos en alquiler', null, 'month', null, 2),
  ('inmuebles', 'terrenos', 'Terrenos', null, 'total', null, 3),
  ('inmuebles', 'locales-oficinas-venta', 'Locales y oficinas en venta', null, 'total', null, 4),
  ('inmuebles', 'locales-oficinas-alquiler', 'Locales y oficinas en alquiler', null, 'month', null, 5),

  ('moviles-tablets', 'moviles', 'Móviles', null, null, null, 1),
  ('moviles-tablets', 'tablets', 'Tablets', null, null, null, 2),
  ('moviles-tablets', 'accesorios-moviles', 'Accesorios', null, null, null, 3),

  ('electronica', 'tv-audio', 'TV y audio', null, null, null, 1),
  ('electronica', 'ordenadores', 'Ordenadores', null, null, null, 2),
  ('electronica', 'consolas', 'Consolas y videojuegos', null, null, null, 3),
  ('electronica', 'camaras', 'Cámaras', null, null, null, 4),

  ('hogar', 'muebles', 'Muebles', null, null, null, 1),
  ('hogar', 'electrodomesticos', 'Electrodomésticos', null, null, null, 2),
  ('hogar', 'cocina', 'Cocina y menaje', null, null, null, 3),
  ('hogar', 'decoracion', 'Decoración', null, null, null, 4),

  ('moda-belleza', 'ropa-hombre', 'Ropa de hombre', null, null, null, 1),
  ('moda-belleza', 'ropa-mujer', 'Ropa de mujer', null, null, null, 2),
  ('moda-belleza', 'ropa-ninos', 'Ropa de niños', null, null, null, 3),
  ('moda-belleza', 'calzado', 'Calzado', null, null, null, 4),
  ('moda-belleza', 'bolsos-accesorios', 'Bolsos y accesorios', null, null, null, 5),
  ('moda-belleza', 'joyas-relojes', 'Joyas y relojes', null, null, null, 6),
  ('moda-belleza', 'belleza-cuidado', 'Belleza y cuidado personal', null, null, null, 7),

  ('bebes-ninos', 'ropa-bebe', 'Ropa de bebé', null, null, null, 1),
  ('bebes-ninos', 'carritos-sillas', 'Carritos y sillas', null, null, null, 2),
  ('bebes-ninos', 'juguetes', 'Juguetes', null, null, null, 3),

  ('construccion-herramientas', 'materiales-construccion', 'Materiales de construcción', null, null, null, 1),
  ('construccion-herramientas', 'herramientas', 'Herramientas', null, null, null, 2),
  ('construccion-herramientas', 'generadores-energia', 'Generadores y energía', null, null, null, 3),
  ('construccion-herramientas', 'fontaneria-electricidad', 'Fontanería y electricidad', null, null, null, 4),

  ('agricultura-alimentacion', 'productos-agricolas', 'Productos agrícolas', null, null, false, 1),
  ('agricultura-alimentacion', 'maquinaria-agricola', 'Maquinaria agrícola', null, null, true, 2),
  ('agricultura-alimentacion', 'alimentacion', 'Alimentos y bebidas', null, null, false, 3),

  ('animales-mascotas', 'mascotas', 'Mascotas', null, null, null, 1),
  ('animales-mascotas', 'accesorios-mascotas', 'Accesorios para mascotas', null, null, true, 2),

  ('deporte-ocio', 'material-deportivo', 'Material deportivo', null, null, null, 1),
  ('deporte-ocio', 'instrumentos-musicales', 'Instrumentos musicales', null, null, null, 2),
  ('deporte-ocio', 'libros-revistas', 'Libros y revistas', null, null, null, 3),

  ('servicios', 'reparaciones', 'Reparaciones y mantenimiento', null, null, null, 1),
  ('servicios', 'limpieza', 'Limpieza', null, null, null, 2),
  ('servicios', 'clases-formacion', 'Clases y formación', null, null, null, 3),
  ('servicios', 'eventos-catering', 'Eventos y catering', null, null, null, 4),
  ('servicios', 'transporte-mudanzas', 'Transporte y mudanzas', null, null, null, 5),
  ('servicios', 'belleza-estetica', 'Belleza y estética', null, null, null, 6),

  ('otros', 'varios', 'Varios', null, null, null, 1)
) as s (parent_slug, slug, name, price_required, price_period, has_condition, sort_order)
join public.categories p on p.slug = s.parent_slug;

-- ─── Atributos por categoría (ALCANCE §6) ───────────────────────────────────

insert into public.category_attributes (category_id, key, label, type, options, unit, is_required, is_filterable, sort_order)
select c.id, a.key, a.label, a.type::public.attribute_type, a.options::jsonb, a.unit, a.is_required, a.is_filterable, a.sort_order
from (values
  -- Coches
  ('coches', 'brand', 'Marca', 'select', '["Toyota", "Hyundai", "Nissan", "Mitsubishi", "Kia", "Mercedes-Benz", "Ford", "Honda", "Suzuki", "Volkswagen", "Peugeot", "Renault", "Lexus", "Land Rover", "BMW", "Otra"]', null::text, true, true, 1),
  ('coches', 'model', 'Modelo', 'text', null, null, true, false, 2),
  ('coches', 'year', 'Año', 'number', null, null, true, true, 3),
  ('coches', 'mileage_km', 'Kilometraje', 'number', null, 'km', false, true, 4),
  ('coches', 'fuel', 'Combustible', 'select', '["Gasolina", "Diésel", "Híbrido", "Eléctrico"]', null, false, true, 5),
  ('coches', 'transmission', 'Cambio', 'select', '["Manual", "Automático"]', null, false, true, 6),
  -- Motos
  ('motos', 'brand', 'Marca', 'text', null, null, true, true, 1),
  ('motos', 'model', 'Modelo', 'text', null, null, false, false, 2),
  ('motos', 'year', 'Año', 'number', null, null, false, true, 3),
  ('motos', 'mileage_km', 'Kilometraje', 'number', null, 'km', false, true, 4),
  -- Camiones y furgonetas
  ('camiones-furgonetas', 'brand', 'Marca', 'text', null, null, true, true, 1),
  ('camiones-furgonetas', 'model', 'Modelo', 'text', null, null, false, false, 2),
  ('camiones-furgonetas', 'year', 'Año', 'number', null, null, false, true, 3),
  ('camiones-furgonetas', 'mileage_km', 'Kilometraje', 'number', null, 'km', false, true, 4),
  ('camiones-furgonetas', 'fuel', 'Combustible', 'select', '["Gasolina", "Diésel", "Híbrido", "Eléctrico"]', null, false, true, 5),
  -- Casas y pisos (venta y alquiler)
  ('casas-pisos-venta', 'property_type', 'Tipo', 'select', '["Casa", "Piso", "Apartamento", "Chalet"]', null, true, true, 1),
  ('casas-pisos-venta', 'bedrooms', 'Habitaciones', 'number', null, null, true, true, 2),
  ('casas-pisos-venta', 'bathrooms', 'Baños', 'number', null, null, false, true, 3),
  ('casas-pisos-venta', 'area_m2', 'Superficie', 'number', null, 'm²', false, true, 4),
  ('casas-pisos-venta', 'furnished', 'Amueblado', 'boolean', null, null, false, true, 5),
  ('casas-pisos-alquiler', 'property_type', 'Tipo', 'select', '["Casa", "Piso", "Apartamento", "Habitación", "Chalet"]', null, true, true, 1),
  ('casas-pisos-alquiler', 'bedrooms', 'Habitaciones', 'number', null, null, true, true, 2),
  ('casas-pisos-alquiler', 'bathrooms', 'Baños', 'number', null, null, false, true, 3),
  ('casas-pisos-alquiler', 'area_m2', 'Superficie', 'number', null, 'm²', false, true, 4),
  ('casas-pisos-alquiler', 'furnished', 'Amueblado', 'boolean', null, null, false, true, 5),
  -- Terrenos y locales
  ('terrenos', 'area_m2', 'Superficie', 'number', null, 'm²', true, true, 1),
  ('locales-oficinas-venta', 'area_m2', 'Superficie', 'number', null, 'm²', false, true, 1),
  ('locales-oficinas-alquiler', 'area_m2', 'Superficie', 'number', null, 'm²', false, true, 1),
  -- Móviles y tablets
  ('moviles', 'brand', 'Marca', 'select', '["Apple", "Samsung", "Tecno", "Infinix", "Itel", "Xiaomi", "Huawei", "Oppo", "Nokia", "Otra"]', null, true, true, 1),
  ('moviles', 'model', 'Modelo', 'text', null, null, false, false, 2),
  ('moviles', 'storage', 'Almacenamiento', 'select', '["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"]', null, false, true, 3),
  ('tablets', 'brand', 'Marca', 'select', '["Apple", "Samsung", "Tecno", "Infinix", "Xiaomi", "Huawei", "Lenovo", "Otra"]', null, true, true, 1),
  ('tablets', 'model', 'Modelo', 'text', null, null, false, false, 2),
  ('tablets', 'storage', 'Almacenamiento', 'select', '["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"]', null, false, true, 3),
  -- Electrónica (se aplica a todas sus subcategorías)
  ('electronica', 'brand', 'Marca', 'text', null, null, false, true, 1),
  -- Moda
  ('ropa-hombre', 'size', 'Talla', 'text', null, null, false, true, 1),
  ('ropa-mujer', 'size', 'Talla', 'text', null, null, false, true, 1),
  ('ropa-ninos', 'size', 'Talla', 'text', null, null, false, true, 1),
  ('calzado', 'size', 'Talla', 'text', null, null, false, true, 1),
  ('calzado', 'gender', 'Para', 'select', '["Hombre", "Mujer", "Unisex", "Niños"]', null, false, true, 2)
) as a (category_slug, key, label, type, options, unit, is_required, is_filterable, sort_order)
join public.categories c on c.slug = a.category_slug;
