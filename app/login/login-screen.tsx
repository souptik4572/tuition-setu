"use client";

import { ChevronDown, CircleAlert, Clock, Eye, EyeOff, Lock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { AppMark } from "@/components/ts/app-mark";
import { inputClass } from "@/components/ts/field";
import { Key, KeyLink } from "@/components/ts/key";
import { PinPad } from "@/components/ts/pin-pad";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/util/platform";
import { login } from "./actions";
import { ResetSteps } from "./reset-steps";

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** M1, F3-WrongPin, F3-Locked, F3-Desktop; the passphrase variant is D-32. `reset` is set only on the laptop. */
export function LoginScreen({ firstName, kind, lockedForMs, reset }: { firstName: string; kind: "pin" | "passphrase"; lockedForMs: number; reset: Platform | null }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [lockEnd, setLockEnd] = useState(() => (lockedForMs > 0 ? Date.now() + lockedForMs : null));
  const [left, setLeft] = useState(lockedForMs);
  const [reopened, setReopened] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const noun = kind === "pin" ? "PIN" : "passphrase";
  const locked = lockEnd !== null;

  useEffect(() => {
    if (lockEnd === null) return;
    const id = setInterval(() => {
      const ms = lockEnd - Date.now();
      if (ms > 0) return setLeft(ms);
      setLockEnd(null);
      setLeft(0);
      setReopened(true);
    }, 250);
    return () => clearInterval(id);
  }, [lockEnd]);

  const submit = (secret: string) =>
    startTransition(async () => {
      setUnreachable(false);
      setReopened(false);
      try {
        // A right PIN redirects, so only failures come back.
        const result = await login(secret);
        if (!result) return;
        setValue("");
        if ("lockedForMs" in result) {
          setTriesLeft(null);
          setLockEnd(Date.now() + result.lockedForMs);
          setLeft(result.lockedForMs);
        } else {
          setTriesLeft(result.triesLeft);
          setErrorKey((k) => k + 1);
        }
      } catch {
        setValue("");
        setUnreachable(true);
      }
    });

  const wrong = triesLeft !== null && !locked;
  const message = (
    <div id="login-msg" aria-live="assertive" className="flex min-h-12 justify-center">
      {wrong && (
        <p role="alert" className="flex max-w-82.5 animate-rise items-start gap-2 text-base leading-[1.45] font-extrabold text-on-danger-tint">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
          <span>
            That {noun} didn&apos;t match. {triesLeft === 1 ? "1 try" : `${triesLeft} tries`} left before a 10-minute pause.
          </span>
        </p>
      )}
      {locked && (
        <div role="status" className="flex w-full items-center gap-3 rounded-md bg-field px-3.5 py-3 text-ink">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-ink-strong">
            <Clock className="size-5.5" strokeWidth={2.4} />
          </span>
          <span className="flex flex-col gap-0.5 text-[15px] leading-[1.45]">
            <strong className="text-[17px] font-extrabold">
              Too many tries. Try again in <span className="tabular-nums">{clock(left)}</span>
            </strong>
            <span>The pause keeps guessers out. Your notes are safe.</span>
          </span>
        </div>
      )}
      {reopened && !wrong && (
        <p role="status" className="animate-rise text-center text-base font-extrabold text-on-sky-tint">
          You can try your {noun} again now.
        </p>
      )}
      {unreachable && (
        <p role="alert" className="flex max-w-82.5 items-start gap-2 text-base leading-[1.45] font-extrabold text-on-danger-tint">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
          <span>Couldn&apos;t reach TuitionSetu. Check that it&apos;s running on the laptop, then try again.</span>
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:bg-field">
      <header className="hidden border-b-2 border-hairline bg-surface lg:block">
        <div className="mx-auto flex min-h-17.5 max-w-274 items-center gap-2.5 px-4">
          <AppMark />
          <span className="font-display text-2xl font-extrabold tracking-[-0.4px] text-ink-strong">TuitionSetu</span>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-[max(60px,env(safe-area-inset-top))] pb-[max(34px,env(safe-area-inset-bottom))] lg:items-start lg:py-12">
        <section
          aria-labelledby="login-title"
          className="flex w-full max-w-100 flex-col gap-5 lg:max-w-130 lg:gap-5.5 lg:rounded-lg lg:border-2 lg:border-b-4 lg:border-hairline lg:bg-surface lg:p-9"
        >
          <div className="flex items-center justify-center gap-2.5 lg:hidden">
            <AppMark />
            <span className="font-display text-2xl font-extrabold tracking-[-0.4px] text-ink-strong">TuitionSetu</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 id="login-title" className="text-[28px] leading-[1.2] font-extrabold text-ink-strong lg:font-display lg:text-4xl lg:leading-[1.1] lg:tracking-[-0.9px]">
              Hello, {firstName}
            </h1>
            <label htmlFor="login-secret" className="text-[17px] leading-normal text-muted-foreground">
              {kind === "pin" ? "Enter your 6-digit PIN" : "Enter your passphrase"}
            </label>
          </div>

          {kind === "pin" ? (
            <PinPad
              id="login-secret"
              value={value}
              onChange={(v) => {
                setValue(v);
                if (v) setReopened(false);
              }}
              onComplete={submit}
              error={wrong}
              errorKey={errorKey}
              locked={locked}
              busy={pending}
              describedBy="login-msg"
              message={message}
            />
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (value.trim()) submit(value);
              }}
            >
              <div className="relative">
                <input
                  id="login-secret"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  value={value}
                  disabled={locked}
                  readOnly={pending}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={wrong}
                  aria-describedby="login-msg"
                  className={cn(inputClass(wrong && !value), "pr-24", locked && "bg-field")}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-pressed={show}
                  aria-label={show ? "Hide passphrase" : "Show passphrase"}
                  className="absolute top-1 right-1 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[15px] font-extrabold text-ocean"
                >
                  {show ? <EyeOff aria-hidden className="size-5" strokeWidth={2.4} /> : <Eye aria-hidden className="size-5" strokeWidth={2.4} />}
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              {message}
              <Key type="submit" size="big" disabled={locked || pending || !value.trim()}>
                {pending ? "Checking…" : "Unlock"}
              </Key>
            </form>
          )}

          {reset ? (
            <>
              <button
                type="button"
                onClick={() => setForgotOpen(!forgotOpen)}
                aria-expanded={forgotOpen}
                aria-controls="login-forgot"
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-center px-3 text-[15px] font-extrabold tracking-[0.8px] text-ocean uppercase"
              >
                Forgot {noun}?
                <ChevronDown aria-hidden className={cn("size-5 transition-transform", forgotOpen && "rotate-180")} strokeWidth={2.6} />
              </button>
              <div id="login-forgot" hidden={!forgotOpen}>
                <div className="flex animate-rise flex-col gap-3 rounded-md bg-field p-4 lg:bg-field">
                  <span className="text-base leading-normal">You&apos;re on the laptop, so you can reset it now — the pause doesn&apos;t stop this.</span>
                  <ResetSteps platform={reset} onLaptop numbered={false} />
                  <span className="text-sm text-muted-foreground">Every phone will need the new {noun} afterwards.</span>
                </div>
              </div>
            </>
          ) : (
            <KeyLink href="/login/forgot" variant="text" className="self-center">
              Forgot {noun}?
            </KeyLink>
          )}

          <p className="mt-auto flex items-center justify-center gap-2 text-sm leading-[1.45] text-muted-foreground lg:mt-0">
            <Lock aria-hidden className="size-4.5 shrink-0" strokeWidth={2.4} />
            Your students&apos; details stay on your machine
          </p>
        </section>
      </main>
    </div>
  );
}
