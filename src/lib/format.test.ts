import { describe, expect, it } from "vitest";
import {
  calendarDaysAgo,
  dayKey,
  formatClock,
  formatDate,
  formatGqPhone,
  formatLongDate,
  formatNumber,
  formatXaf,
  inboxTime,
  normalizeGqPhone,
  responseTimeParts,
} from "./format";

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

describe("responseTimeParts", () => {
  it("elige minutos, horas o días", () => {
    expect(responseTimeParts(0)).toEqual({ unit: "minutes", count: 1 });
    expect(responseTimeParts(45)).toEqual({ unit: "minutes", count: 45 });
    expect(responseTimeParts(130)).toEqual({ unit: "hours", count: 2 });
    expect(responseTimeParts(3000)).toEqual({ unit: "days", count: 2 });
  });
});

describe("fechas del chat (hora de Malabo, UTC+1)", () => {
  const now = new Date("2026-10-17T10:00:00Z"); // 11:00 en Malabo

  it("hora y día en Malabo", () => {
    expect(formatClock("2026-10-17T09:42:00Z")).toBe("10:42");
    expect(dayKey("2026-10-16T23:30:00Z")).toBe("2026-10-17"); // ya es día 17 en Malabo
  });

  it("hora de la bandeja", () => {
    expect(inboxTime("2026-10-17T08:05:00Z", now)).toEqual({ kind: "today", text: "09:05" });
    expect(inboxTime("2026-10-16T12:00:00Z", now).kind).toBe("yesterday");
    expect(inboxTime("2026-10-13T12:00:00Z", now)).toEqual({ kind: "week", text: "mar" });
    expect(inboxTime("2026-10-02T12:00:00Z", now)).toEqual({ kind: "older", text: "2 oct" });
  });

  it("separador de día", () => {
    expect(formatLongDate("2026-10-12T12:00:00Z")).toBe("12 de octubre");
    expect(calendarDaysAgo("2026-10-16T22:59:00Z", now)).toBe(1);
  });
});
