// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusChip, type Status } from "./status-chip";

const words: Record<Status, string> = {
  needs_you: "Needs you",
  notes: "Note saved",
  writing: "Writing",
  checked: "Checked",
  flagged: "Flagged",
  stale: "Out of date",
  approved: "Approved",
  sent: "Sent",
  skipped: "Skipped",
  no_notes: "No notes",
  couldnt_read: "Couldn't read",
};

describe("StatusChip", () => {
  it.each(Object.entries(words) as [Status, string][])("%s shows an icon and the word %s", (status, word) => {
    const { container } = render(<StatusChip status={status} />);
    const chip = container.querySelector(`[data-status="${status}"]`);
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toBe(word);
    const icon = chip!.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("aria-hidden")).toBe("true");
  });

  it("gives Out of date a border so it never reads as Checked", () => {
    const { container } = render(<StatusChip status="stale" />);
    expect(container.firstElementChild!.className).toMatch(/border-caution-border/);
  });
});
