import { describe, expect, it } from "vitest";
import { defaultStoreSlug, isStoreMediaPath, normalizeStoreSlug, STORE_SLUG_PATTERN } from "./slug";

describe("dirección de la tienda", () => {
  it("por defecto sale del nombre de usuario", () => {
    expect(defaultStoreSlug("julio_nkulu")).toBe("julio-nkulu");
    expect(defaultStoreSlug("tienda.malabo_2")).toBe("tienda-malabo-2");
    expect(defaultStoreSlug("ana__.lopez_")).toBe("ana-lopez");
    expect(STORE_SLUG_PATTERN.test(defaultStoreSlug("julio_nkulu"))).toBe(true);
  });

  it("normaliza lo que escribe el usuario", () => {
    expect(normalizeStoreSlug("  Móviles Ñúñez Bata ")).toBe("moviles-nunez-bata");
    expect(normalizeStoreSlug("Tienda_de.Ana")).toBe("tienda-de-ana");
    expect(normalizeStoreSlug("--¡Ofertas!--")).toBe("ofertas");
  });

  it("valida el formato", () => {
    expect(STORE_SLUG_PATTERN.test("ab")).toBe(false);
    expect(STORE_SLUG_PATTERN.test("1tienda")).toBe(false);
    expect(STORE_SLUG_PATTERN.test("tienda-malabo")).toBe(true);
  });

  it("solo acepta fotos del propio dueño y del tipo pedido", () => {
    const user = "8a1f6c1e-2b3c-4d5e-8f90-123456789abc";
    const id = "0f9e8d7c-6b5a-4c3d-9e2f-abcdef012345";
    expect(isStoreMediaPath(`${user}/logo-${id}.webp`, user, "logo")).toBe(true);
    expect(isStoreMediaPath(`${user}/cover-${id}.jpg`, user, "cover")).toBe(true);
    expect(isStoreMediaPath(`${user}/cover-${id}.webp`, user, "logo")).toBe(false);
    expect(isStoreMediaPath(`otro/logo-${id}.webp`, user, "logo")).toBe(false);
  });
});
