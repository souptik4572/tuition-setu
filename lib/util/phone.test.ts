import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each(["+91 98000-00001", "098000 00001", "+919800000001", "919800000001"])("tidies %s to an Indian number", (input) => {
    expect(normalizePhone(input)).toEqual({ ok: true, digits: "919800000001", display: "+91 98000 00001", international: false, tidied: true });
  });

  it("keeps a bare 10-digit number as typed", () => {
    expect(normalizePhone("9800000001")).toMatchObject({ ok: true, digits: "919800000001", tidied: false });
  });

  it("gives the digit count when a number is too short", () => {
    expect(normalizePhone("98000 0001")).toEqual({ ok: false, reason: "too_short", digitCount: 9 });
    expect(normalizePhone("+91 98000 0001")).toEqual({ ok: false, reason: "too_short", digitCount: 9 });
  });

  it("keeps numbers from other countries, with the country's name", () => {
    expect(normalizePhone("+44 7700 900123")).toEqual({
      ok: true,
      digits: "447700900123",
      display: "+44 7700 900123",
      international: true,
      tidied: false,
      country: "United Kingdom",
    });
  });

  it("rejects empty input, letters and impossible numbers", () => {
    expect(normalizePhone("  ")).toEqual({ ok: false, reason: "empty", digitCount: 0 });
    expect(normalizePhone("98000abc01")).toMatchObject({ ok: false, reason: "invalid" });
    expect(normalizePhone("98000000011234")).toMatchObject({ ok: false, reason: "invalid" });
    expect(normalizePhone("+1 2")).toMatchObject({ ok: false, reason: "invalid" });
  });
});
