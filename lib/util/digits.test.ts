import { describe, expect, it } from "vitest";
import { extractNumbers, normalizeDigits } from "./digits";

const shape = (s: string) => extractNumbers(s).map((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== "start" && k !== "end")));

describe("normalizeDigits", () => {
  it("turns Bengali and Devanagari digits into 0-9 without moving offsets", () => {
    expect(normalizeDigits("১৭/২৫")).toBe("17/25");
    expect(normalizeDigits("१४ अंक")).toBe("14 अंक");
    expect(normalizeDigits("কুইজে ১৭").length).toBe("কুইজে ১৭".length);
  });
});

describe("extractNumbers", () => {
  it("finds fractions with and without spaces", () => {
    expect(shape("scored 14/20 and 9 / 10")).toEqual([
      { kind: "pair", a: 14, b: 20 },
      { kind: "pair", a: 9, b: 10 },
    ]);
  });

  it("reads 'out of' with the score first", () => {
    expect(shape("14.5 out of 20")).toEqual([{ kind: "pair", a: 14.5, b: 20 }]);
  });

  it("reads Bengali and Hindi totals first", () => {
    expect(shape("২০ এর মধ্যে ১৪")).toEqual([{ kind: "pair", a: 14, b: 20 }]);
    expect(shape("২০-এর মধ্যে ১৪ পেয়েছে")).toEqual([{ kind: "pair", a: 14, b: 20 }]);
    expect(shape("20 में से 14 अंक")).toEqual([{ kind: "pair", a: 14, b: 20 }]);
  });

  it("finds percentages, decimals and plain numbers without reusing parts of a pair", () => {
    expect(shape("14/20 (70%), up from 58%, Chapter 5, ex 5.3")).toEqual([
      { kind: "pair", a: 14, b: 20 },
      { kind: "percent", v: 70 },
      { kind: "percent", v: 58 },
      { kind: "number", v: 5 },
      { kind: "number", v: 5.3 },
    ]);
  });

  it("finds numbers stuck to letters, as in shorthand", () => {
    expect(shape("Riya ch5 test")).toEqual([{ kind: "number", v: 5 }]);
  });

  it("returns offsets into the original text, Bengali digits included", () => {
    const text = "কুইজে ও ১৭/২৫ পেয়েছে";
    const [t] = extractNumbers(text);
    expect(text.slice(t.start, t.end)).toBe("১৭/২৫");
  });

  it("does not read numbers written as words", () => {
    expect(extractNumbers("missed homework twice")).toEqual([]);
  });
});
