// Light or dark: the choice saved on this device, else the OS setting (IMPL D-39). Not a
// "use client" module, so the root layout can render THEME_SCRIPT.

export type Theme = "light" | "dark";

const KEY = "ts:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs in <head> before the first paint, so a saved dark theme never flashes light. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}")}catch(e){}document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("${DARK_QUERY}").matches?"dark":"light"`;

export function savedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage off (private window): the choice lasts until the page reloads.
  }
  const apply = () => {
    document.documentElement.dataset.theme = theme;
  };
  // The page cross-fades (timing in globals.css); browsers without view transitions switch at once.
  if (document.startViewTransition) document.startViewTransition(apply);
  else apply();
}
