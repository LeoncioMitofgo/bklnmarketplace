import { describe, expect, it } from "vitest";
import { detectIdentifierKind, isValidUsername, maskEmail } from "./identifiers";

describe("maskEmail", () => {
  it("deja la primera letra y el dominio", () => {
    expect(maskEmail("juan.perez@gmail.com")).toBe("j***@gmail.com");
    expect(maskEmail("a@b.gq")).toBe("a***@b.gq");
  });

  it("no revela nada si no parece un email", () => {
    expect(maskEmail("sinarroba")).toBe("***");
    expect(maskEmail("@gmail.com")).toBe("***");
  });
});

describe("detectIdentifierKind", () => {
  it.each([
    ["maria@email.com", "email"],
    ["  Maria@Email.com ", "email"],
    ["222 123 456", "phone"],
    ["+240555220846", "phone"],
    ["maria.nchama", "username"],
    ["maria22", "username"],
  ] as const)("%s → %s", (input, expected) => {
    expect(detectIdentifierKind(input)).toBe(expected);
  });
});

describe("isValidUsername", () => {
  it.each(["maria.nchama", "pedro_92", "abc", "Maria"])("acepta %s", (input) => {
    expect(isValidUsername(input)).toBe(true);
  });

  it.each([
    "ab",
    "92pedro",
    "maria nchama",
    "maría",
    "a".repeat(21),
    "_maria",
  ])("rechaza %s", (input) => {
    expect(isValidUsername(input)).toBe(false);
  });
});
