import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { listingPath, listingSlug, parseListingCode } from "./paths";

describe("slugify", () => {
  it("quita tildes, eñes y signos", () => {
    expect(slugify("Ciudad de la Paz")).toBe("ciudad-de-la-paz");
    expect(slugify("Añisok")).toBe("anisok");
    expect(slugify("  iPhone 13, 128 GB (como nuevo)!  ")).toBe("iphone-13-128-gb-como-nuevo");
  });

  it("recorta sin dejar guiones al final", () => {
    expect(slugify("aaaa bbbb", 5)).toBe("aaaa");
  });
});

describe("listingPath", () => {
  it("une título, ciudad y código", () => {
    expect(listingPath("xkkrp5h6", "Coche en venta", "Malabo")).toBe(
      "/anuncio/coche-en-venta-malabo-xkkrp5h6",
    );
  });

  it("sin título ni ciudad queda solo el código", () => {
    expect(listingSlug("xkkrp5h6", null, null)).toBe("xkkrp5h6");
  });
});

describe("parseListingCode", () => {
  it("lee el código del final del slug", () => {
    expect(parseListingCode("coche-en-venta-malabo-xkkrp5h6")).toBe("xkkrp5h6");
    expect(parseListingCode("xkkrp5h6")).toBe("xkkrp5h6");
  });

  it("rechaza lo que no es un código", () => {
    expect(parseListingCode("coche-en-venta")).toBeNull();
    expect(parseListingCode("coche-XKKRP5H6")).toBeNull();
    expect(parseListingCode("coche-abc10def")).toBeNull();
  });
});
