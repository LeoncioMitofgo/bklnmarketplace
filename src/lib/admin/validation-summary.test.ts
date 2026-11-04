import { describe, expect, it } from "vitest";
import { median, summarizeValidation } from "./validation-summary";

const empty = {
  publishedIds: [],
  conversationListingIds: [],
  responseTimes: [],
  activeUserIds: [],
  newUserIds: [],
  premiumRequests: 0,
  premiumActivations: 0,
};

describe("median", () => {
  it("vacío → null", () => expect(median([])).toBeNull());
  it("impar: el del medio", () => expect(median([30, 5, 120])).toBe(30));
  it("par: la media de los dos del medio", () => expect(median([10, 40, 20, 90])).toBe(30));
});

describe("summarizeValidation", () => {
  it("sin datos no divide por cero", () => {
    const m = summarizeValidation(empty);
    expect(m.listingsWithMessagePct).toBeNull();
    expect(m.medianResponseMinutes).toBeNull();
    expect(m.activeUsers).toBe(0);
  });

  it("cuenta cada anuncio una vez y solo si se publicó en el periodo", () => {
    const m = summarizeValidation({
      ...empty,
      publishedIds: ["a", "b", "c", "d"],
      // Dos conversaciones del mismo anuncio, una sin anuncio y otra de un anuncio más antiguo.
      conversationListingIds: ["a", "a", "b", null, "viejo"],
    });
    expect(m.listingsWithMessage).toBe(2);
    expect(m.listingsWithMessagePct).toBe(50);
  });

  it("los que vuelven son los activos que no se registraron esta semana", () => {
    const m = summarizeValidation({
      ...empty,
      activeUserIds: ["u1", "u1", "u2", "u3", null],
      newUserIds: ["u3", "u4"],
    });
    expect(m.activeUsers).toBe(3);
    expect(m.returningUsers).toBe(2);
  });
});
