"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, savedTheme, setTheme } from "@/lib/client/theme";
import { cn } from "@/lib/utils";

/**
 * Keeps <html data-theme> right after the head script: React's dev remount clears the attribute,
 * and with no saved choice the theme follows the OS as it changes.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const media = matchMedia(DARK_QUERY);
    const apply = () => {
      document.documentElement.dataset.theme = savedTheme() ?? (media.matches ? "dark" : "light");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return null;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Moon in light mode, sun in dark; the icons swap in CSS so the first paint is already right. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  return (
    <button
      type="button"
      aria-label="Dark mode"
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("flex size-10 items-center justify-center rounded-md text-ink-strong hover:bg-field", className)}
    >
      <Moon aria-hidden className="size-6 dark:hidden" strokeWidth={2.4} />
      <Sun aria-hidden className="hidden size-6 dark:block" strokeWidth={2.4} />
    </button>
  );
}
