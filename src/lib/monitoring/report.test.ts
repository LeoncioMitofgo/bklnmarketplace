import { describe, expect, it } from "vitest";
import { buildEnvelope, describeError, isNoise, parseDsn, parseStack } from "./report";

const DSN = "https://abc123@o42.ingest.de.sentry.io/4507";
const ENV = { environment: "production", release: "sha1", site: "https://www.bklnmarketplace.com" };

describe("parseDsn", () => {
  it("saca la dirección de los sobres y la clave", () =>
    expect(parseDsn(DSN)).toEqual({
      url: "https://o42.ingest.de.sentry.io/api/4507/envelope/",
      publicKey: "abc123",
    }));
  it("respeta un prefijo de ruta", () =>
    expect(parseDsn("https://k@sentry.ejemplo.com/sub/7")?.url).toBe(
      "https://sentry.ejemplo.com/sub/api/7/envelope/",
    ));
  it("vacío o mal escrito → null", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("no es una url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4507")).toBeNull();
  });
});

describe("parseStack", () => {
  it("lee las pilas de Chrome y de Safari, de la más antigua a la más reciente", () => {
    const v8 = parseStack(
      "Error: x\n    at fallo (/var/task/.next/server/chunks/a.js:10:5)\n    at /var/task/node_modules/react/b.js:3:1\n    at async Promise.all (index 0)",
    );
    expect(v8.map((f) => [f.function, f.lineno, f.in_app])).toEqual([
      ["?", 3, false],
      ["fallo", 10, true],
    ]);
    const safari = parseStack(
      "enviar@https://www.bklnmarketplace.com/_next/static/chunks/c.js:1:200",
    );
    expect(safari[0]).toMatchObject({ function: "enviar", lineno: 1, colno: 200 });
  });
});

describe("isNoise", () => {
  it("descarta los cortes de conexión", () => {
    expect(isNoise({ type: "TypeError", message: "Failed to fetch" })).toBe(true);
    expect(isNoise({ type: "ChunkLoadError", message: "Loading chunk 3 failed." })).toBe(true);
    expect(isNoise({ type: "Error", message: "Script error." })).toBe(true);
    expect(isNoise({ type: "TypeError", message: "x is undefined" })).toBe(false);
  });
});

describe("describeError", () => {
  it("lee el digest de React y acepta lo que no es un Error", () => {
    const err = Object.assign(new Error("boom"), { digest: "123" });
    expect(describeError(err)).toMatchObject({ type: "Error", message: "boom", digest: "123" });
    expect(describeError("texto")).toEqual({ type: "Error", message: "texto" });
  });
});

describe("buildEnvelope", () => {
  it("tres líneas JSON y la ruta sin la query", () => {
    const lines = buildEnvelope(
      {
        source: "server",
        type: "Error",
        message: "boom",
        path: "/auth/confirmar?token_hash=secreto",
        method: "GET",
        route: "/auth/confirmar",
        tags: { route_type: "render", render_source: undefined },
      },
      DSN,
      ENV,
      new Date("2026-11-04T10:00:00Z"),
    ).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1])).toEqual({ type: "event" });
    const event = JSON.parse(lines[2]);
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(event.timestamp).toBe(1793786400);
    expect(event.transaction).toBe("/auth/confirmar");
    expect(event.request.url).toBe("https://www.bklnmarketplace.com/auth/confirmar");
    expect(lines.join("")).not.toContain("secreto");
    expect(event.tags).toEqual({ source: "server", route_type: "render" });
    expect(event.exception.values[0]).toEqual({ type: "Error", value: "boom" });
  });
});
