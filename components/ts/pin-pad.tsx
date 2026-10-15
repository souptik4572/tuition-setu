"use client";

import { Delete } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Six boxes drawn over one real input (IMPL §6.4), so typing, pasting, password managers and
 * screen readers all work. `pad` is the sign-in size (M1); `setter` the wider setup rows (G2).
 */
export function PinBoxes({
  value,
  size,
  show = false,
  active = true,
  bad = false,
  locked = false,
  shakeKey,
}: {
  value: string;
  size: "pad" | "setter";
  show?: boolean;
  active?: boolean;
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
        const next = active && !locked && i === value.length;
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
  const disabled = locked || busy;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // Phones get the keypad instead, so only a wide screen takes focus (and its keyboard).
    if (!locked && window.matchMedia("(min-width: 1024px)").matches) input.current?.focus();
  }, [locked]);

  const update = (next: string) => {
    const digits = next.replace(/\D/g, "").slice(0, 6);
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
        <PinBoxes value={value} size="pad" bad={error && !value} locked={locked} shakeKey={errorKey} />
        <input
          ref={input}
          id={id}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="current-password"
          maxLength={6}
          value={value}
          disabled={disabled}
          onChange={(e) => update(e.target.value)}
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
