import { describe, expect, it } from "vitest";
import { formatDate, formatGqPhone, formatNumber, formatXaf, normalizeGqPhone } from "./format";

describe("formatNumber / formatXaf", () => {
  it("agrupa miles con punto, también con 4 cifras", () => {
    expect(formatNumber(5000)).toBe("5.000");
    expect(formatNumber(150000)).toBe("150.000");
    expect(formatNumber(14500000)).toBe("14.500.000");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });

  it("redondea y respeta el signo", () => {
    expect(formatNumber(13312.5)).toBe("13.313");
    expect(formatNumber(-2500)).toBe("-2.500");
  });

  it("añade FCFA", () => {
    expect(formatXaf(33000)).toBe("33.000 FCFA");
  });
});

describe("normalizeGqPhone", () => {
  it.each([
    ["222123456", "+240222123456"],
    ["222 123 456", "+240222123456"],
    ["+240 555 220 846", "+240555220846"],
    ["00240555220846", "+240555220846"],
    ["240555220846", "+240555220846"],
    ["(+240) 222-123-456", "+240222123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeGqPhone(input)).toBe(expected);
  });

  it.each([
    ["12345678"],
    ["2221234567"],
    ["abc222123456"],
    [""],
    ["+34 600 123 456"],
  ])("rechaza %s", (input) => {
    expect(normalizeGqPhone(input)).toBeNull();
  });
});

describe("formatGqPhone", () => {
  it("separa en grupos de tres", () => {
    expect(formatGqPhone("+240555220846")).toBe("+240 555 220 846");
  });

  it("deja igual lo que no reconoce", () => {
    expect(formatGqPhone("555")).toBe("555");
  });
});

describe("formatDate", () => {
  it("usa dd/mm/aaaa y la hora de Malabo (UTC+1)", () => {
    // 23:30 UTC del 15 de octubre ya es 16 de octubre en Malabo.
    expect(formatDate("2026-10-15T23:30:00Z")).toBe("16/10/2026");
  });
});
