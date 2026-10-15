// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { PinPad, pinDigits } from "./pin-pad";
import { EMPTY_PIN_SETTER, PinSetter } from "./pin-setter";

beforeAll(() => {
  // jsdom has no matchMedia; a laptop has a fine pointer.
  window.matchMedia = ((query: string) => ({ matches: query === "(pointer: fine)", addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

function Setter() {
  const [value, setValue] = useState(EMPTY_PIN_SETTER);
  return <PinSetter value={value} onChange={setValue} />;
}

const lit = (input: HTMLElement) => input.parentElement!.querySelectorAll(".border-sky").length;
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

describe("PinSetter focus", () => {
  it("starts in the first row and moves to the second once the PIN is usable", () => {
    const { container } = render(<Setter />);
    const [pin1, pin2] = [container.querySelector<HTMLInputElement>("#pin1")!, container.querySelector<HTMLInputElement>("#pin2")!];
    expect(document.activeElement).toBe(pin1);

    type(pin1, "123456");
    expect(document.activeElement).toBe(pin1);
    type(pin1, "482915");
    expect(document.activeElement).toBe(pin2);

    fireEvent.keyDown(pin2, { key: "Backspace" });
    expect(document.activeElement).toBe(pin1);
  });

  it("lights a box only in the row that has focus", () => {
    const { container, getByRole } = render(<Setter />);
    const [pin1, pin2] = [container.querySelector<HTMLInputElement>("#pin1")!, container.querySelector<HTMLInputElement>("#pin2")!];
    expect([lit(pin1), lit(pin2)]).toEqual([1, 0]);

    const show = getByRole("button", { name: "Show PIN" });
    act(() => show.focus());
    expect([lit(pin1), lit(pin2)]).toEqual([0, 0]);

    fireEvent.keyDown(show, { key: "4" });
    expect(document.activeElement).toBe(pin1);
  });
});

describe("PinPad", () => {
  it("keeps focus while a try is checked, so the next try can be typed", () => {
    const { container, rerender } = render(<PinPad id="pin" value="" onChange={() => {}} onComplete={() => {}} />);
    const input = container.querySelector<HTMLInputElement>("#pin")!;
    expect(document.activeElement).toBe(input);

    rerender(<PinPad id="pin" value="" onChange={() => {}} onComplete={() => {}} busy />);
    expect(input.disabled).toBe(false);
    expect(input.readOnly).toBe(true);
  });
});

describe("pinDigits", () => {
  it("keeps six digits from typing, pasting and autofill, in any script", () => {
    expect(pinDigits("482 915")).toBe("482915");
    expect(pinDigits("৪৮২৯১৫")).toBe("482915");
    expect(pinDigits("४८२९१५७")).toBe("482915");
    expect(pinDigits("saved-password")).toBe("");
  });
});
