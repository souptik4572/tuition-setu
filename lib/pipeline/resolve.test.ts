import { describe, expect, it } from "vitest";
import { resolve, type RosterEntry } from "./resolve";

const roster: RosterEntry[] = [
  { id: "riya", fullName: "Riya Sen", messageName: "Riya", aliases: [] },
  { id: "arjun", fullName: "Arjun Das", messageName: "Arjun", aliases: [] },
  { id: "payel", fullName: "Payel Dutta", messageName: "Payel", aliases: [] },
  { id: "tanmoy", fullName: "তন্ময় ঘোষ", messageName: "তন্ময়", aliases: ["Tanmoy"] },
];

describe("resolve", () => {
  it("matches a full name or the message name exactly, ignoring case and punctuation", () => {
    expect(resolve("riya sen", roster)).toMatchObject({ resolution: "exact", studentId: "riya" });
    expect(resolve("Arjun.", roster)).toMatchObject({ resolution: "exact", studentId: "arjun" });
  });

  it("matches a nickname", () => {
    expect(resolve("TANMOY", roster)).toMatchObject({ resolution: "alias", studentId: "tanmoy" });
  });

  it("takes one close spelling as fuzzy: one edit for short names, two for longer", () => {
    expect(resolve("Riyu", roster)).toMatchObject({ resolution: "fuzzy", studentId: "riya" });
    expect(resolve("Payal", roster)).toMatchObject({ resolution: "fuzzy", studentId: "payel" });
    expect(resolve("Arjoon Das", roster)).toMatchObject({ resolution: "fuzzy", studentId: "arjun" });
    expect(resolve("Ruyu", roster)).toMatchObject({ resolution: "unmatched", candidates: [{ studentId: "riya", distance: 2 }] });
  });

  it("asks when two students share the name", () => {
    const twins = [...roster, { id: "riya2", fullName: "Riya Bose", messageName: "Riya", aliases: [] }];
    expect(resolve("Riya", twins)).toEqual({ resolution: "unmatched", candidates: [{ studentId: "riya", distance: 0 }, { studentId: "riya2", distance: 0 }] });
  });

  it("asks when two spellings are equally close", () => {
    const withRiyo = [...roster, { id: "riyo", fullName: "Riyo Pal", messageName: "Riyo", aliases: [] }];
    expect(resolve("Riye", withRiyo)).toEqual({ resolution: "unmatched", candidates: [{ studentId: "riya", distance: 1 }, { studentId: "riyo", distance: 1 }] });
  });

  it("finds no one for a new name, with no suggestions", () => {
    expect(resolve("Sohini", roster)).toEqual({ resolution: "unmatched", candidates: [] });
    expect(resolve("  ", roster)).toEqual({ resolution: "unmatched", candidates: [] });
  });

  it("keeps Bengali names whole: vowel signs are part of the name", () => {
    expect(resolve("তন্ময়", roster)).toMatchObject({ resolution: "exact", studentId: "tanmoy" });
    expect(resolve("তনময়", roster)).toMatchObject({ resolution: "fuzzy", studentId: "tanmoy" });
  });
});
