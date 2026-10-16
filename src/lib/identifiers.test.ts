import { describe, expect, it } from "vitest";
import { detectIdentifierKind, isValidUsername } from "./identifiers";

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
