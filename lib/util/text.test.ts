import { describe, expect, it } from "vitest";
import { levenshtein } from "./levenshtein";
import { normalizeName, wholeWord } from "./text";

describe("normalizeName", () => {
  it("lowercases, trims, collapses spaces and drops punctuation", () => {
    expect(normalizeName("  Riya   SEN. ")).toBe("riya sen");
    expect(normalizeName("D'Souza")).toBe("dsouza");
    expect(normalizeName("Riya-Sen")).toBe("riya sen");
  });

  it("strips Latin accents only", () => {
    expect(normalizeName("Zoë")).toBe("zoe");
    expect(normalizeName("তন্ময়")).toBe("তন্ময়");
    expect(normalizeName("कबीर")).toBe("कबीर");
  });

  it("treats the composed and decomposed Bengali য় alike", () => {
    expect(normalizeName("তন্ময়")).toBe(normalizeName("তন্ময়"));
  });
});

describe("wholeWord", () => {
  it("matches a name followed by an apostrophe but not inside a longer name", () => {
    expect(wholeWord("Riya").test("Riya's test")).toBe(true);
    expect(wholeWord("Riya").test("Riyaz did well")).toBe(false);
    expect(wholeWord("riya").test("RIYA")).toBe(true);
  });

  it("works for Bengali, where \\b does not", () => {
    expect(wholeWord("তন্ময়").test("এই সপ্তাহে তন্ময় ভালো করেছে")).toBe(true);
    expect(wholeWord("তন্ময়").test("তন্ময়ী")).toBe(false);
  });

  it("escapes regex characters in the term", () => {
    expect(wholeWord("A.B").test("AxB")).toBe(false);
  });
});

describe("levenshtein", () => {
  it.each([
    ["riya", "riya", 0],
    ["riyu", "riya", 1],
    ["payal", "payel", 1],
    ["arjun", "arjan", 1],
    ["", "abc", 3],
    ["tanmoy", "tanmay", 1],
    ["kitten", "sitting", 3],
  ])("%s → %s is %i", (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d);
  });
});
