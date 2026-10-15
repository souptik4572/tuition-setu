import { describe, expect, it } from "vitest";
import { addDays, cycleRangeFor, formatRange, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses the workspace time zone, not UTC", () => {
    const lateSundayUtc = new Date("2026-10-18T23:30:00Z");
    expect(todayIn("UTC", lateSundayUtc)).toBe("2026-10-18");
    expect(todayIn("Asia/Kolkata", lateSundayUtc)).toBe("2026-10-19");
  });

  it("puts 23:30 UTC on Sunday into next week's cycle in India", () => {
    expect(cycleRangeFor(todayIn("Asia/Kolkata", new Date("2026-10-18T23:30:00Z")))).toEqual({ from: "2026-10-19", to: "2026-10-25" });
  });
});

describe("cycleRangeFor", () => {
  it.each([
    ["2026-10-12", "2026-10-12"],
    ["2026-10-15", "2026-10-12"],
    ["2026-10-18", "2026-10-12"],
  ])("puts %s in the week starting %s", (day, monday) => {
    expect(cycleRangeFor(day)).toEqual({ from: monday, to: addDays(monday, 6) });
  });

  it("crosses month and year ends", () => {
    expect(cycleRangeFor("2026-10-01")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(cycleRangeFor("2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });
});

describe("formatRange", () => {
  it("formats one month and two months", () => {
    expect(formatRange("2026-10-12", "2026-10-18")).toBe("12–18 Oct");
    expect(formatRange("2026-09-28", "2026-10-04")).toBe("28 Sep–4 Oct");
  });

  it("keeps Latin digits in Bengali and Hindi", () => {
    expect(formatRange("2026-10-12", "2026-10-18", "bn")).toMatch(/^12–18 \D+$/);
    expect(formatRange("2026-10-12", "2026-10-18", "hi")).toMatch(/^12–18 \D+$/);
  });
});
