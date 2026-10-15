import { describe, expect, it } from "vitest";
import { weekStatus } from "./week-status";

const confirmed = { confirmedAt: "2026-10-15T15:00:00.000Z", resolution: "exact" };
const waiting = { confirmedAt: null, resolution: "exact" };

describe("weekStatus", () => {
  it("shows the live draft first, even when something else is waiting", () => {
    expect(weekStatus("ready", [waiting])).toBe("checked");
    expect(weekStatus("generating", [])).toBe("writing");
    expect(weekStatus("stale", [confirmed])).toBe("stale");
  });

  it("then Needs you, then Note saved, then No notes", () => {
    expect(weekStatus(undefined, [confirmed, waiting])).toBe("needs_you");
    expect(weekStatus(undefined, [confirmed])).toBe("notes");
    expect(weekStatus(undefined, [])).toBe("no_notes");
  });

  it("doesn't count an ignored line as waiting", () => {
    expect(weekStatus(undefined, [{ confirmedAt: null, resolution: "ignored" }])).toBe("no_notes");
  });
});
