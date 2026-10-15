"use client";

import { Delete } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { normalizeDigits } from "@/lib/util/digits";
import { cn } from "@/lib/utils";

/** Up to six digits from whatever was typed, pasted or autofilled; Bengali and Hindi keyboards type their own digits. */
export const pinDigits = (s: string) => normalizeDigits(s).replace(/\D/g, "").slice(0, 6);

const finePointer = () => window.matchMedia("(pointer: fine)");

/** A mouse or trackpad means a keyboard to type on; touch phones use the on-screen keys. Null until mounted. */
function useKeyboardDevice(): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const query = finePointer();
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => finePointer().matches,
    () => null,
  );
}

/**
 * Digits typed while nothing editable has focus go to the PIN, so a laptop user can type without
 * clicking a box first, or right after pressing Show or Forgot PIN. Focusing during keydown makes
 * the browser deliver that same key to the field.
 */
export function useDigitsGoTo(target: () => HTMLInputElement | null) {
  const focus = useEffectEvent(() => target()?.focus());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !/^[0-9০-৯०-९]$/.test(e.key)) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Six boxes drawn over one real input (IMPL §6.4), so typing, pasting, password managers and
 * screen readers all work. `pad` is the sign-in size (M1); `setter` the wider setup rows (G2).
 * The next box lights up only while `focused`: lit boxes over an unfocused input invite typing
 * that goes nowhere.
 */
export function PinBoxes({
  value,
  size,
  show = false,
  focused,
  bad = false,
  locked = false,
  shakeKey,
}: {
  value: string;
  size: "pad" | "setter";
  show?: boolean;
  focused: boolean;
  bad?: boolean;
  locked?: boolean;
  shakeKey?: number;
}) {
  return (
    <div
      key={shakeKey}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 grid gap-2", size === "pad" ? "grid-cols-[repeat(6,44px)]" : "grid-cols-6", bad && "animate-shake")}
    >
      {Array.from({ length: 6 }, (_, i) => {
        const digit = value[i];
        const next = focused && !locked && i === value.length;
        return (
          <span
            key={i}
            className={cn(
              "flex items-center justify-center border-2 text-[28px] font-extrabold text-ink",
              size === "pad" ? "h-14 rounded-md" : "h-[60px] rounded-[10px]",
              locked
                ? "border-hairline bg-field"
                : bad
                  ? "border-danger bg-danger-tint"
                  : next
                    ? "border-sky bg-surface shadow-[0_0_0_3px_var(--sky-tint)]"
                    : digit
                      ? cn("bg-surface", size === "pad" ? "border-ink-strong" : "border-skip-border")
                      : cn("border-hairline", size === "pad" ? "bg-surface" : "bg-field"),
            )}
          >
            {digit && (show ? digit : <span className="size-3.5 rounded-full bg-ink" />)}
            {next && size === "setter" && <span className="block h-7 w-0.5 animate-caret bg-ink" />}
          </span>
        );
      })}
    </div>
  );
}

export const pinInputClass = "absolute inset-0 size-full border-0 bg-transparent text-base text-transparent caret-transparent outline-none";

/** Sign-in PIN entry (M1, F3): submits 160 ms after the 6th digit. The keypad is for phones; the laptop types. */
export function PinPad({
  id,
  value,
  onChange,
  onComplete,
  error = false,
  errorKey,
  locked = false,
  busy = false,
  describedBy,
  message,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (pin: string) => void;
  error?: boolean;
  errorKey?: number;
  locked?: boolean;
  busy?: boolean;
  describedBy?: string;
  /** Shown between the boxes and the keypad, as on M1. */
  message?: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const keyboard = useKeyboardDevice();
  const disabled = locked || busy;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // Phones use the keypad, so only a keyboard device takes focus; a phone's own keyboard stays closed.
    if (!locked && keyboard) input.current?.focus();
  }, [locked, keyboard]);
  useDigitsGoTo(() => input.current);

  const update = (next: string) => {
    const digits = pinDigits(next);
    clearTimeout(timer.current);
    onChange(digits);
    if (digits.length === 6) timer.current = setTimeout(() => onComplete(digits), 160);
  };

  const key = "h-16 cursor-pointer rounded-lg text-[28px] font-extrabold transition-[transform,box-shadow] duration-[90ms] disabled:cursor-not-allowed";
  const digitKey = cn(
    key,
    "border-2 border-hairline shadow-[0_2px_0_0_var(--hairline)] enabled:active:translate-y-0.5 enabled:active:shadow-none",
    locked ? "bg-field text-muted-foreground" : "bg-surface text-ink",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-14 w-[304px] self-center rounded-md focus-within:shadow-[0_0_0_3px_var(--sky-tint)]">
        <PinBoxes value={value} size="pad" focused={focused || keyboard === false} bad={error && !value} locked={locked} shakeKey={errorKey} />
        <input
          ref={input}
          id={id}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          value={value}
          // Read-only while checking, not disabled: a disabled field drops focus, and the next try would type into nothing.
          disabled={locked}
          readOnly={busy}
          onChange={(e) => update(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-describedby={describedBy}
          className={pinInputClass}
        />
      </div>
      {message}
      <div role="group" aria-label="Number pad" className={cn("grid grid-cols-3 gap-3 lg:hidden", locked && "opacity-55")}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => update(value + d)} className={digitKey}>
            {d}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" disabled={disabled} onClick={() => update(value + "0")} className={digitKey}>
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Delete last digit"
          onClick={() => update(value.slice(0, -1))}
          className={cn(key, "flex items-center justify-center", locked ? "text-muted-foreground" : "text-ink")}
        >
          <Delete aria-hidden className="size-7" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
