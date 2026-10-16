import { describe, expect, it } from "vitest";
import type { AttributeDef, Catalog, Category } from "@/lib/catalog-types";
import {
  countActiveFilters,
  MAX_PAGES,
  PAGE_SIZE,
  parseSearchParams,
  searchHref,
  toRpcArgs,
} from "./params";

const category = (over: Partial<Category>): Category => ({
  id: 0,
  parent_id: null,
  slug: "",
  name: "",
  icon: null,
  price_required: true,
  price_period: "total",
  has_condition: true,
  ...over,
});

const attribute = (over: Partial<AttributeDef>): AttributeDef => ({
  id: 0,
  category_id: 0,
  key: "",
  label: "",
  type: "text",
  options: null,
  unit: null,
  is_required: false,
  is_filterable: true,
  ...over,
});

const vehicles = category({ id: 1, slug: "vehiculos", name: "Vehículos" });
const cars = category({ id: 17, parent_id: 1, slug: "coches", name: "Coches" });
const property = category({ id: 2, slug: "inmuebles", name: "Inmuebles", has_condition: false });
const rentals = category({
  id: 22,
  parent_id: 2,
  slug: "casas-pisos-alquiler",
  name: "Casas y pisos en alquiler",
  price_period: "month",
  has_condition: false,
});

const catalog: Catalog = {
  categories: [vehicles, cars, property, rentals],
  attributes: [
    attribute({
      id: 1,
      category_id: 17,
      key: "brand",
      label: "Marca",
      type: "select",
      options: ["Toyota", "Mercedes-Benz"],
    }),
    attribute({ id: 2, category_id: 17, key: "model", label: "Modelo", is_filterable: false }),
    attribute({ id: 3, category_id: 17, key: "year", label: "Año", type: "number" }),
    attribute({ id: 4, category_id: 17, key: "mileage_km", label: "Kilometraje", type: "number" }),
    attribute({ id: 5, category_id: 22, key: "furnished", label: "Amueblado", type: "boolean" }),
    attribute({ id: 6, category_id: 22, key: "bathrooms", label: "Baños", type: "number" }),
  ],
  cities: [
    { id: 1, slug: "malabo", name: "Malabo" },
    { id: 15, slug: "ciudad-de-la-paz", name: "Ciudad de la Paz" },
  ],
};

describe("parseSearchParams", () => {
  it("sin parámetros: todo vacío, relevancia y una página", () => {
    const filters = parseSearchParams({}, catalog);
    expect(filters).toMatchObject({
      q: "",
      category: null,
      city: null,
      sort: "relevancia",
      pages: 1,
    });
    expect(countActiveFilters(filters)).toBe(0);
  });

  it("lee categoría, ciudad, precios, estado y atributos de la categoría", () => {
    const filters = parseSearchParams(
      {
        q: " hilux ",
        categoria: "coches",
        ciudad: "ciudad-de-la-paz",
        precio_min: "1.000.000",
        precio_max: "15000000",
        estado: "usado",
        marca: "Toyota",
        anio_min: "2015",
        kilometraje_max: "120 000",
        orden: "precio-asc",
        n: "3",
      },
      catalog,
    );
    expect(filters.q).toBe("hilux");
    expect(filters.category?.id).toBe(17);
    expect(filters.city?.id).toBe(15);
    expect(filters.priceMin).toBe(1_000_000);
    expect(filters.priceMax).toBe(15_000_000);
    expect(filters.condition).toBe("used");
    expect(filters.attributes).toEqual({ brand: "Toyota" });
    expect(filters.ranges).toEqual({ year: [2015, null], mileage_km: [null, 120_000] });
    expect(filters.sort).toBe("precio-asc");
    expect(filters.pages).toBe(3);
    expect(countActiveFilters(filters)).toBe(7);
  });

  it("descarta valores que no existen o no tocan", () => {
    const filters = parseSearchParams(
      {
        categoria: "no-existe",
        ciudad: "paris",
        precio_min: "barato",
        estado: "roto",
        marca: "Toyota",
        orden: "aleatorio",
        n: "999",
      },
      catalog,
    );
    expect(filters.category).toBeNull();
    expect(filters.city).toBeNull();
    expect(filters.priceMin).toBeNull();
    expect(filters.condition).toBeNull();
    expect(filters.attributes).toEqual({});
    expect(filters.sort).toBe("relevancia");
    expect(filters.pages).toBe(MAX_PAGES);
  });

  it("ignora opciones de lista que no están en el catálogo y el estado si la categoría no lo usa", () => {
    const filters = parseSearchParams(
      { categoria: "casas-pisos-alquiler", marca: "Toyota", estado: "nuevo", amueblado: "si" },
      catalog,
    );
    expect(filters.condition).toBeNull();
    expect(filters.attributes).toEqual({ furnished: true });
  });

  it("intercambia el precio mínimo y el máximo si vienen al revés", () => {
    const filters = parseSearchParams({ precio_min: "500", precio_max: "100" }, catalog);
    expect([filters.priceMin, filters.priceMax]).toEqual([100, 500]);
  });

  it("la categoría de la ruta manda sobre el parámetro", () => {
    const filters = parseSearchParams({ categoria: "inmuebles" }, catalog, cars);
    expect(filters.category?.slug).toBe("coches");
  });
});

describe("searchHref", () => {
  it("es la inversa de parseSearchParams", () => {
    const raw = {
      q: "hilux",
      categoria: "coches",
      ciudad: "malabo",
      precio_max: "15000000",
      marca: "Mercedes-Benz",
      anio_min: "2015",
      orden: "recientes",
      n: "2",
    };
    const href = searchHref("/buscar", parseSearchParams(raw, catalog), catalog);
    const params = Object.fromEntries(new URL(href, "https://x.test").searchParams);
    expect(params).toEqual(raw);
  });

  it("omite la categoría cuando va en la ruta y no repite los valores por defecto", () => {
    const filters = parseSearchParams({ n: "1", orden: "relevancia" }, catalog, cars);
    expect(searchHref("/categoria/coches", filters, catalog, { omitCategory: true })).toBe(
      "/categoria/coches",
    );
  });

  it("usa nombres de parámetro en español sin eñes", () => {
    const filters = parseSearchParams(
      { categoria: "casas-pisos-alquiler", banios_min: "2" },
      catalog,
    );
    expect(searchHref("/buscar", filters, catalog)).toBe(
      "/buscar?categoria=casas-pisos-alquiler&banios_min=2",
    );
  });
});

describe("toRpcArgs", () => {
  it("convierte los filtros en argumentos de search_listings", () => {
    const filters = parseSearchParams(
      { q: "hilux", categoria: "coches", marca: "Toyota", anio_min: "2015", n: "2" },
      catalog,
    );
    expect(toRpcArgs(filters)).toEqual({
      p_query: "hilux",
      p_category_id: 17,
      p_city_id: undefined,
      p_price_min: undefined,
      p_price_max: undefined,
      p_condition: undefined,
      p_attributes: { brand: "Toyota" },
      p_ranges: { year: [2015, null] },
      p_sort: "relevance",
      p_limit: 2 * PAGE_SIZE,
    });
  });
});
