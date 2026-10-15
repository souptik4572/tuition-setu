import { describe, expect, it } from "vitest";
import { validateSecret } from "@/lib/schemas/secret";
import { hashPin, verifyPin } from "./pin";

describe("validateSecret", () => {
  it.each([
    ["482915", null],
    ["123456", "easy"],
    ["111111", "easy"],
    ["102030", "easy"],
    ["12345", "format"],
    ["1234567", "format"],
    ["48a915", "format"],
    ["４８２９１５", "format"],
  ])("PIN %s → %s", (value, problem) => {
    expect(validateSecret({ kind: "pin", value })).toBe(problem);
  });

  it.each([
    ["mango", "short"],
    ["mango tree", null],
    ["   mango  ", "short"],
    ["আমার বাগান", null],
  ])("passphrase %j → %s", (value, problem) => {
    expect(validateSecret({ kind: "passphrase", value })).toBe(problem);
  });
});

describe("hashPin / verifyPin", () => {
  it("accepts the same PIN and rejects another, with a fresh salt each time", async () => {
    const pin = { kind: "pin" as const, value: "482915" };
    const a = await hashPin(pin);
    const b = await hashPin(pin);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toContain("482915");
    expect(await verifyPin(pin, a.hash, a.salt)).toBe(true);
    expect(await verifyPin({ kind: "pin", value: "482951" }, a.hash, a.salt)).toBe(false);
  });

  it("ignores spaces at the ends of a passphrase", async () => {
    const stored = await hashPin({ kind: "passphrase", value: "mango tree" });
    expect(await verifyPin({ kind: "passphrase", value: "  mango tree " }, stored.hash, stored.salt)).toBe(true);
    expect(await verifyPin({ kind: "passphrase", value: "mango  tree" }, stored.hash, stored.salt)).toBe(false);
  });
});
