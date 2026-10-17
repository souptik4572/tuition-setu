// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_SCRIPT } from "@/lib/client/theme";
import { ThemeSync, ThemeToggle } from "./theme-toggle";

let osDark = false;
let osListeners: (() => void)[] = [];

function setOs(dark: boolean) {
  osDark = dark;
  act(() => osListeners.forEach((fn) => fn()));
}

beforeEach(() => {
  osDark = false;
  osListeners = [];
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  // jsdom has no matchMedia.
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === "(prefers-color-scheme: dark)" && osDark;
    },
    addEventListener: (_: string, fn: () => void) => osListeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => (osListeners = osListeners.filter((l) => l !== fn)),
  })) as unknown as typeof window.matchMedia;
});

const theme = () => document.documentElement.dataset.theme;

describe("THEME_SCRIPT", () => {
  it("uses the OS setting until a choice is saved", () => {
    osDark = true;
    new Function(THEME_SCRIPT)();
    expect(theme()).toBe("dark");
    localStorage.setItem("ts:theme", "light");
    new Function(THEME_SCRIPT)();
    expect(theme()).toBe("light");
  });
});

describe("ThemeToggle", () => {
  it("switches the theme, remembers it and stops following the OS", () => {
    osDark = true;
    render(
      <>
        <ThemeSync />
        <ThemeToggle />
      </>,
    );
    const toggle = screen.getByRole("button", { name: "Dark mode" });
    expect(theme()).toBe("dark");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);
    expect(theme()).toBe("light");
    expect(localStorage.getItem("ts:theme")).toBe("light");

    setOs(false);
    setOs(true);
    expect(theme()).toBe("light");
  });

  it("follows the OS as it changes while nothing is saved", () => {
    render(<ThemeSync />);
    expect(theme()).toBe("light");
    setOs(true);
    expect(theme()).toBe("dark");
  });
});
