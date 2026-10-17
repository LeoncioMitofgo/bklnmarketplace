import { describe, expect, it } from "vitest";
import { bestValue, pricePerMonth, savingsXaf } from "./pricing";

// Precios de D-022.
const PRICES = [
  { months: 1, price_xaf: 5000 },
  { months: 3, price_xaf: 13300 },
  { months: 6, price_xaf: 23250 },
  { months: 12, price_xaf: 33000 },
];

describe("precios de Premium", () => {
  it("calcula el ahorro frente a pagar mes a mes", () => {
    expect(savingsXaf(PRICES, 1)).toBe(0);
    expect(savingsXaf(PRICES, 3)).toBe(1700);
    expect(savingsXaf(PRICES, 6)).toBe(6750);
    expect(savingsXaf(PRICES, 12)).toBe(27000);
  });

  it("sin precio mensual o sin ese periodo, no hay ahorro", () => {
    expect(savingsXaf(PRICES.slice(1), 3)).toBe(0);
    expect(savingsXaf(PRICES, 2)).toBe(0);
  });

  it("precio por mes redondeado", () => {
    expect(pricePerMonth(PRICES[1])).toBe(4433);
    expect(pricePerMonth(PRICES[3])).toBe(2750);
  });

  it("el mejor precio es el de 12 meses", () => {
    expect(bestValue(PRICES)?.months).toBe(12);
    expect(bestValue([])).toBeUndefined();
  });
});
