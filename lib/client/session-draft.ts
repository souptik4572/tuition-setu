"use client";

import { useSyncExternalStore } from "react";

const KEY = "ts:note-draft";
const listeners = new Set<() => void>();
// Storage can be off (private windows); the text then lives here for as long as the page does.
let memory: string | null = null;

function read(): string {
  if (memory !== null) return memory;
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value: string) {
  memory = value;
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((l) => l());
}

/**
 * The note being typed, kept in sessionStorage from the first keystroke until it's saved (§S1
 * Failure), so a failed save or a closed tab never loses it.
 */
export function useNoteDraft(): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => "",
  );
  return [value, write];
}
