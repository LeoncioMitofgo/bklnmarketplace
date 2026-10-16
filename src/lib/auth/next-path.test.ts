import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    "/",
    "/cuenta",
    "/anuncio/iphone-13-a1b2c3?foto=2",
    "/u/maria.nchama#anuncios",
  ])("acepta %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "evil.com",
    "",
    null,
    undefined,
    42,
  ])("rechaza %s", (value) => {
    expect(safeNextPath(value, "/fallback")).toBe("/fallback");
  });
});
