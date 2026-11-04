import { describe, expect, it } from "vitest";
import { listingOf, planCleanup } from "./cleanup-plan";

const NOW = Date.parse("2026-11-04T08:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const U = "11111111-1111-4111-8111-111111111111"; // con perfil
const GONE = "22222222-2222-4222-8222-222222222222"; // cuenta borrada
const L = "33333333-3333-4333-8333-333333333333"; // activo
const OLD = "44444444-4444-4444-8444-444444444444"; // borrado hace 40 días
const RECENT = "55555555-5555-4555-8555-555555555555"; // borrado hace 5 días
const MISSING = "66666666-6666-4666-8666-666666666666"; // ya no existe
const IMG = "77777777-7777-4777-8777-777777777777";

const photo = (user: string, listing: string, suffix = "l.webp") => ({
  bucket: "listing-images",
  name: `${user}/${listing}/${IMG}-${suffix}`,
});
const media = (user: string, file: string) => ({
  bucket: "profile-media",
  name: `${user}/${file}`,
});

const base = {
  profiles: new Set([U]),
  listings: new Map([
    [L, { status: "active", deletedAt: null }],
    [OLD, { status: "deleted", deletedAt: daysAgo(40) }],
    [RECENT, { status: "deleted", deletedAt: daysAgo(5) }],
  ]),
  inUse: new Set([
    `listing-images/${U}/${L}/${IMG}-l.webp`,
    `listing-images/${U}/${RECENT}/${IMG}-l.webp`,
    `profile-media/${U}/avatar-a.webp`,
  ]),
  now: NOW,
};

describe("planCleanup", () => {
  it("deja lo que se usa y las fotos de un anuncio borrado hace menos de 30 días", () => {
    const plan = planCleanup({
      ...base,
      objects: [photo(U, L), photo(U, RECENT), media(U, "avatar-a.webp")],
    });
    expect(plan).toEqual({ remove: [], purgedListings: [], orphans: [] });
  });

  it("borra lo de cuentas y anuncios que ya no existen y lo de anuncios borrados hace más de 30 días", () => {
    const plan = planCleanup({
      ...base,
      objects: [photo(GONE, L), media(GONE, "avatar-b.webp"), photo(U, MISSING), photo(U, OLD)],
    });
    expect(plan.remove).toHaveLength(4);
    expect(plan.purgedListings).toEqual([OLD]);
    expect(plan.orphans).toEqual([]);
  });

  it("lo que no usa nadie queda pendiente de la edad (subidas a medias)", () => {
    const plan = planCleanup({
      ...base,
      objects: [photo(U, L, "t.webp"), media(U, "avatar-viejo.webp"), media(U, "logo-x.webp")],
    });
    expect(plan.remove).toEqual([]);
    expect(plan.orphans).toHaveLength(3);
  });

  it("no toca rutas que la web no crea", () => {
    const plan = planCleanup({
      ...base,
      objects: [
        { bucket: "listing-images", name: `${GONE}/suelto.webp` },
        { bucket: "listing-images", name: `${U}/no-es-uuid/${IMG}-l.webp` },
        { bucket: "profile-media", name: `${GONE}/carpeta/avatar.webp` },
        { bucket: "chat-images", name: `${GONE}/foto.webp` },
        { bucket: "listing-images", name: "pruebas/foto.webp" },
      ],
    });
    expect(plan).toEqual({ remove: [], purgedListings: [], orphans: [] });
  });
});

describe("listingOf", () => {
  it("solo para fotos de anuncios", () => {
    expect(listingOf(photo(U, L))).toBe(L);
    expect(listingOf(media(U, "avatar-a.webp"))).toBeUndefined();
  });
});
