// Cálculos de precios de Premium. Funciones puras: sirven en servidor y cliente.

export type PremiumPrice = { months: number; price_xaf: number };

/** Lo que se ahorra frente a pagar mes a mes (13.300 por 3 meses → 1.700). */
export function savingsXaf(prices: PremiumPrice[], months: number): number {
  const monthly = prices.find((p) => p.months === 1)?.price_xaf;
  const price = prices.find((p) => p.months === months)?.price_xaf;
  if (monthly === undefined || price === undefined) return 0;
  return Math.max(monthly * months - price, 0);
}

/** Precio por mes redondeado (13.300 / 3 → 4.433). */
export function pricePerMonth(price: PremiumPrice): number {
  return Math.round(price.price_xaf / price.months);
}

/** El periodo más barato por mes (a igualdad, el primero). */
export function bestValue(prices: PremiumPrice[]): PremiumPrice | undefined {
  return prices.reduce<PremiumPrice | undefined>(
    (best, p) => (!best || pricePerMonth(p) < pricePerMonth(best) ? p : best),
    undefined,
  );
}
