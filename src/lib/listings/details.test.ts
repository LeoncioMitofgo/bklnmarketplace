import { describe, expect, it } from "vitest";
import type { AttributeDef, Category } from "@/lib/catalog-types";
import { type DetailsInput, parsePrice, validateDetails } from "./details";

const phones: Category = {
  id: 20,
  parent_id: 3,
  slug: "moviles",
  name: "Móviles",
  icon: null,
  price_required: true,
  price_period: "total",
  has_condition: true,
};

const services: Category = {
  ...phones,
  id: 40,
  slug: "limpieza",
  price_required: false,
  has_condition: false,
};

const attrs: AttributeDef[] = [
  {
    id: 1,
    category_id: 20,
    key: "brand",
    label: "Marca",
    type: "select",
    options: ["Apple", "Samsung"],
    unit: null,
    is_required: true,
    is_filterable: false,
  },
  {
    id: 2,
    category_id: 20,
    key: "storage",
    label: "Almacenamiento",
    type: "select",
    options: ["64 GB", "128 GB"],
    unit: null,
    is_required: false,
    is_filterable: false,
  },
  {
    id: 3,
    category_id: 3,
    key: "year",
    label: "Año",
    type: "number",
    options: null,
    unit: null,
    is_required: false,
    is_filterable: false,
  },
  {
    id: 4,
    category_id: 3,
    key: "boxed",
    label: "Con caja",
    type: "boolean",
    options: null,
    unit: null,
    is_required: false,
    is_filterable: false,
  },
];

const cities = new Set([1, 2]);

const valid: DetailsInput = {
  title: "  iPhone 13 128 GB, como nuevo ",
  description: "Batería al 91 %.",
  condition: "used",
  price: "350.000",
  negotiable: true,
  cityId: "1",
  neighborhood: "Ela Nguema",
  attributes: { brand: "Apple", storage: "", year: "2021", boxed: "on" },
};

describe("parsePrice", () => {
  it.each([
    ["350.000", 350000],
    ["350 000", 350000],
    ["5000", 5000],
    ["", null],
  ] as const)("%s → %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each(["12,5", "abc", "-3", "."])("rechaza %s", (input) => {
    expect(Number.isNaN(parsePrice(input))).toBe(true);
  });
});

describe("validateDetails", () => {
  it("acepta un anuncio completo y normaliza los valores", () => {
    const { data, errors } = validateDetails(valid, phones, attrs, cities);
    expect(errors).toEqual({});
    expect(data).toEqual({
      title: "iPhone 13 128 GB, como nuevo",
      description: "Batería al 91 %.",
      condition: "used",
      price_xaf: 350000,
      is_negotiable: true,
      city_id: 1,
      neighborhood: "Ela Nguema",
      attributes: { brand: "Apple", year: 2021, boxed: true },
    });
  });

  it("señala cada campo que falla", () => {
    const { data, errors } = validateDetails(
      {
        ...valid,
        title: "abc",
        description: " ",
        condition: "",
        price: "",
        cityId: "99",
        attributes: { brand: "Nokia", year: "dos mil" },
      },
      phones,
      attrs,
      cities,
    );
    expect(data).toBeUndefined();
    expect(errors).toEqual({
      title: "title_length",
      description: "description_required",
      condition: "condition_required",
      price: "price_required",
      cityId: "city_required",
      attr_brand: "attribute_option",
      attr_year: "attribute_number",
    });
  });

  it("en Servicios el precio y el estado son opcionales", () => {
    const { data, errors } = validateDetails(
      { ...valid, condition: "", price: "", attributes: {} },
      services,
      [],
      cities,
    );
    expect(errors).toEqual({});
    expect(data?.price_xaf).toBeNull();
    expect(data?.condition).toBeNull();
  });

  it("exige los atributos obligatorios", () => {
    const { errors } = validateDetails({ ...valid, attributes: {} }, phones, attrs, cities);
    expect(errors).toEqual({ attr_brand: "attribute_required" });
  });
});
