"use client";

import { Eye, EyeOff, KeyRound, Hash } from "lucide-react";
import { useRef, useState } from "react";
import { PASSPHRASE_MIN, passphraseLength, validateSecret, type Secret } from "@/lib/schemas/secret";
import { cn } from "@/lib/utils";
import { FieldError, FieldOk, helpClass, inputClass, labelClass } from "./field";
import { PinBoxes, pinDigits, pinInputClass, useDigitsGoTo } from "./pin-pad";

export type PinSetterValue = { mode: "pin" | "passphrase"; p1: string; p2: string; a1: string; a2: string; show: boolean };

export const EMPTY_PIN_SETTER: PinSetterValue = { mode: "pin", p1: "", p2: "", a1: "", a2: "", show: false };

function check(v: PinSetterValue) {
  const easy = v.p1.length === 6 && validateSecret({ kind: "pin", value: v.p1 }) === "easy";
  const pinsDone = v.p1.length === 6 && v.p2.length === 6 && !easy;
  const longEnough = validateSecret({ kind: "passphrase", value: v.a1 }) === null;
  const a1 = v.a1.trim();
  const a2 = v.a2.trim();
  return {
    easy,
    pinMismatch: pinsDone && v.p1 !== v.p2,
    pinMatch: pinsDone && v.p1 === v.p2,
    longEnough,
    passMismatch: longEnough && a2.length >= a1.length && a2 !== a1,
    passMatch: longEnough && a2 === a1,
  };
}

/** The secret to save once both entries agree, or why the Save key is still off (G2). */
export function pinSetterResult(v: PinSetterValue): { secret: Secret | null; why: string } {
  const c = check(v);
  if (v.mode === "pin") {
    if (c.pinMatch) return { secret: { kind: "pin", value: v.p1 }, why: "" };
    return { secret: null, why: c.easy ? "Choose a harder PIN to continue" : "Enter the same PIN twice to continue" };
  }
  if (c.passMatch) return { secret: { kind: "passphrase", value: v.a1 }, why: "" };
  return { secret: null, why: c.longEnough ? "Enter the same passphrase twice to continue" : "Use at least 8 characters to continue" };
}

const linkKey = "inline-flex min-h-11 cursor-pointer items-center gap-2 self-start text-base font-extrabold text-ocean";

/**
 * Choose a PIN or passphrase and type it twice (G2 ×4). The parent owns the value and the Save key.
 * Focus follows the typing: the first row on arrival, the second once the first holds a usable PIN.
 */
export function PinSetter({ value: v, onChange }: { value: PinSetterValue; onChange: (v: PinSetterValue) => void }) {
  const set = (patch: Partial<PinSetterValue>) => onChange({ ...v, ...patch });
  const c = check(v);
  const row1 = useRef<HTMLInputElement>(null);
  const row2 = useRef<HTMLInputElement>(null);
  const [focusedRow, setFocusedRow] = useState<1 | 2 | null>(null);
  useDigitsGoTo(() => (v.mode !== "pin" ? null : v.p1.length < 6 || c.easy ? row1.current : row2.current));
  const noun = v.mode === "pin" ? "PIN" : "passphrase";

  const showToggle = (
    <button
      type="button"
      onClick={() => set({ show: !v.show })}
      aria-pressed={v.show}
      aria-label={v.show ? `Hide ${noun}` : `Show ${noun}`}
      className="-mr-2 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[15px] font-extrabold text-ocean"
    >
      {v.show ? <EyeOff aria-hidden className="size-5" strokeWidth={2.4} /> : <Eye aria-hidden className="size-5" strokeWidth={2.4} />}
      {v.show ? "Hide" : "Show"}
    </button>
  );

  if (v.mode === "pin") {
    return (
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <div className="flex max-w-[352px] items-center justify-between gap-3">
            <label htmlFor="pin1" className={labelClass}>
              Choose a 6-digit PIN
            </label>
            {showToggle}
          </div>
          <div className="relative h-[60px] w-full max-w-[352px] rounded-[10px] focus-within:shadow-[0_0_0_3px_var(--sky-tint)]">
            <PinBoxes value={v.p1} size="setter" show={v.show} focused={focusedRow === 1} bad={c.easy} />
            <input
              ref={row1}
              id="pin1"
              type={v.show ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="new-password"
              autoFocus
              value={v.p1}
              onChange={(e) => {
                const p1 = pinDigits(e.target.value);
                set({ p1 });
                if (p1.length === 6 && validateSecret({ kind: "pin", value: p1 }) !== "easy") row2.current?.focus();
              }}
              onFocus={() => setFocusedRow(1)}
              onBlur={() => setFocusedRow(null)}
              aria-invalid={c.easy}
              aria-describedby="pin1-msg"
              className={pinInputClass}
            />
          </div>
          {c.easy ? (
            <span role="alert">
              <FieldError id="pin1-msg">Choose something harder to guess than 123456. Avoid repeats, runs like 456789 and birthdays.</FieldError>
            </span>
          ) : (
            <span id="pin1-msg" className={helpClass}>
              Six numbers you&apos;ll remember but others won&apos;t guess.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="pin2" className={labelClass}>
            Enter it again
          </label>
          <div className="relative h-[60px] w-full max-w-[352px] rounded-[10px] focus-within:shadow-[0_0_0_3px_var(--sky-tint)]">
            <PinBoxes value={v.p2} size="setter" show={v.show} focused={focusedRow === 2} bad={c.pinMismatch} />
            <input
              ref={row2}
              id="pin2"
              type={v.show ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="new-password"
              value={v.p2}
              onChange={(e) => set({ p2: pinDigits(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !v.p2) row1.current?.focus();
              }}
              onFocus={() => setFocusedRow(2)}
              onBlur={() => setFocusedRow(null)}
              aria-invalid={c.pinMismatch}
              aria-describedby="pin2-msg"
              className={pinInputClass}
            />
          </div>
          {c.pinMismatch && (
            <span id="pin2-msg" role="alert" className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-[1.4] font-extrabold text-on-danger-tint">
              <FieldError>The two PINs don&apos;t match. Type the second one again, or</FieldError>
              <button
                type="button"
                onClick={() => {
                  set({ p1: "", p2: "" });
                  row1.current?.focus();
                }}
                className="h-11 cursor-pointer px-1 text-ocean underline"
              >
                start over
              </button>
            </span>
          )}
          {c.pinMatch && <FieldOk id="pin2-msg">PINs match</FieldOk>}
        </div>

        <button type="button" onClick={() => set({ mode: "passphrase", p1: "", p2: "" })} className={linkKey}>
          <KeyRound aria-hidden className="size-5" strokeWidth={2.4} />
          Use a passphrase instead
        </button>
      </div>
    );
  }

  const n = passphraseLength(v.a1);
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex max-w-[460px] flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="pass1" className={labelClass}>
            Choose a passphrase
          </label>
          {showToggle}
        </div>
        <input
          id="pass1"
          type={v.show ? "text" : "password"}
          autoComplete="new-password"
          value={v.a1}
          onChange={(e) => set({ a1: e.target.value })}
          aria-describedby="pass1-msg"
          className={inputClass()}
        />
        {c.longEnough ? (
          <FieldOk id="pass1-msg">Long enough</FieldOk>
        ) : (
          <span id="pass1-msg" className={cn(helpClass, "flex flex-col gap-1.5")}>
            <span>At least 8 characters. A few words you&apos;ll remember works well — spaces are fine.</span>
            <span aria-hidden className="block h-1.5 overflow-hidden rounded-[3px] bg-hairline">
              <span className="block h-1.5 rounded-[3px] bg-sky" style={{ width: `${Math.min(100, Math.round((n / PASSPHRASE_MIN) * 100))}%` }} />
            </span>
            <span className="font-extrabold text-ink-strong">
              {n} of {PASSPHRASE_MIN} characters
            </span>
          </span>
        )}
      </div>
      <div className="flex max-w-[460px] flex-col gap-2">
        <label htmlFor="pass2" className={labelClass}>
          Enter it again
        </label>
        <input
          id="pass2"
          type={v.show ? "text" : "password"}
          autoComplete="new-password"
          value={v.a2}
          onChange={(e) => set({ a2: e.target.value })}
          aria-invalid={c.passMismatch}
          aria-describedby="pass2-msg"
          className={inputClass(c.passMismatch)}
        />
        {c.passMismatch && (
          <span role="alert">
            <FieldError id="pass2-msg">The two passphrases don&apos;t match. Type the second one again.</FieldError>
          </span>
        )}
        {c.passMatch && <FieldOk id="pass2-msg">Passphrases match</FieldOk>}
      </div>
      <button type="button" onClick={() => set({ mode: "pin", a1: "", a2: "" })} className={linkKey}>
        <Hash aria-hidden className="size-5" strokeWidth={2.4} />
        Use a 6-digit PIN instead
      </button>
    </div>
  );
}
