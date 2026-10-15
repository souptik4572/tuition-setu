"use client";

import { Check, ChevronDown, Info, KeyRound, Plus, ShieldCheck, X } from "lucide-react";
import { RadioGroup, Switch } from "radix-ui";
import { useRef, useState, useTransition } from "react";
import { AppMark } from "@/components/ts/app-mark";
import { Banner } from "@/components/ts/banner";
import { ErrorSummary } from "@/components/ts/error-summary";
import { FieldError, helpClass, inputClass, labelClass } from "@/components/ts/field";
import { Key } from "@/components/ts/key";
import { EMPTY_PIN_SETTER, PinSetter, pinSetterResult, type PinSetterValue } from "@/components/ts/pin-setter";
import { SetupAside, SetupColumns, SetupFrame, setupCard } from "@/components/ts/setup-frame";
import { FEE_LINE, greeting, signOff } from "@/lib/pipeline/assemble";
import type { Language, Tone } from "@/lib/schemas/common";
import type { SetupProfile } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";
import { completeSetup } from "./actions";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "हिन्दी" },
];

// G1's fixed sample sentences and fictional parent (D-29); the greeting, fee line and sign-off
// around them come from the same code as real messages.
const SAMPLE: Record<Language, { parent: string } & Record<Tone, string>> = {
  en: {
    parent: "Mrs Sen",
    warm: "Riya did really well this week — her 14/20 shows the practice is paying off.",
    neutral: "Riya scored 14/20 in this week’s test.",
    formal: "Riya obtained 14 out of 20 marks in this week’s assessment.",
  },
  bn: {
    parent: "মিসেস সেন",
    warm: "রিয়া এই সপ্তাহে দারুণ করেছে — 14/20 দেখেই বোঝা যায় অনুশীলনের ফল মিলছে।",
    neutral: "এই সপ্তাহের পরীক্ষায় রিয়া পেয়েছে 14/20।",
    formal: "এই সপ্তাহের মূল্যায়নে রিয়া 20-এর মধ্যে 14 নম্বর পেয়েছে।",
  },
  hi: {
    parent: "श्रीमती सेन",
    warm: "रिया ने इस हफ़्ते बहुत अच्छा किया — उसके 14/20 बताते हैं कि अभ्यास रंग ला रहा है।",
    neutral: "इस हफ़्ते की परीक्षा में रिया के 14/20 अंक आए।",
    formal: "इस सप्ताह के मूल्यांकन में रिया ने 20 में से 14 अंक प्राप्त किए।",
  },
};

const TONES: { value: Tone; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "neutral", label: "Neutral" },
  { value: "formal", label: "Formal" },
];

// Date.getDay() numbers, listed from Monday as G1 does.
const DAYS = [
  { n: 1, name: "Monday" },
  { n: 2, name: "Tuesday" },
  { n: 3, name: "Wednesday" },
  { n: 4, name: "Thursday" },
  { n: 5, name: "Friday" },
  { n: 6, name: "Saturday" },
  { n: 0, name: "Sunday" },
];

const START: SetupProfile = {
  displayName: "",
  signature: "",
  subjects: [],
  defaultLanguage: "en",
  tone: "warm",
  reportDay: 0,
  includeFeeReminders: false,
};

export function SetupWizard() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [profile, setProfile] = useState(START);
  const [secret, setSecret] = useState<PinSetterValue>(EMPTY_PIN_SETTER);

  const go = (next: 0 | 1 | 2) => {
    setStep(next);
    window.scrollTo(0, 0);
  };

  if (step === 0) return <Welcome onStart={() => go(1)} />;
  if (step === 1) return <AboutYou profile={profile} onChange={setProfile} onContinue={() => go(2)} />;
  return <SetAPin profile={profile} value={secret} onChange={setSecret} onBack={() => go(1)} />;
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <SetupFrame>
      <section aria-labelledby="welcome-title" className={cn(setupCard, "mx-auto w-full max-w-[640px] flex-none items-start")}>
        <AppMark size={64} />
        <h1 id="welcome-title" className="font-display text-[clamp(32px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong">
          Welcome to TuitionSetu
        </h1>
        <p className="text-[17px] leading-normal text-muted-foreground">
          TuitionSetu turns your class notes into a short WhatsApp update for each parent. Everything stays on this laptop.
        </p>
        <Key size="big" onClick={onStart}>
          Get started
        </Key>
      </section>
    </SetupFrame>
  );
}

function AboutYou({ profile, onChange, onContinue }: { profile: SetupProfile; onChange: (p: SetupProfile) => void; onContinue: () => void }) {
  const [tried, setTried] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const summary = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<SetupProfile>) => onChange({ ...profile, ...patch });

  const nameErr = tried && !profile.displayName.trim();
  const sigErr = tried && !profile.signature.trim();
  const errors = Number(nameErr) + Number(sigErr);
  const signature = profile.signature.trim() || "…";
  const sample = SAMPLE[profile.defaultLanguage];

  const addSubject = () => {
    const subject = newSubject.trim();
    if (subject && !profile.subjects.some((s) => s.toLowerCase() === subject.toLowerCase())) set({ subjects: [...profile.subjects, subject] });
    setAdding(false);
    setNewSubject("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.displayName.trim() && profile.signature.trim()) return onContinue();
    setTried(true);
    requestAnimationFrame(() => summary.current?.focus());
  };

  const card = (on: boolean) =>
    cn(
      "flex cursor-pointer rounded-md border-2 border-b-4 text-left",
      on ? "border-sky bg-sky-tint" : "border-hairline bg-surface",
    );
  const dot = (on: boolean) => (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface", on ? "border-sky" : "border-skip-border")}>
      <span className={cn("size-2.5 rounded-full", on ? "bg-sky" : "bg-transparent")} />
    </span>
  );

  return (
    <SetupFrame step={1}>
      <SetupColumns>
        <form aria-labelledby="about-title" noValidate onSubmit={submit} className={cn(setupCard, "gap-7")}>
          <div className="flex flex-col gap-2">
            <h1 id="about-title" className="font-display text-[clamp(32px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong">
              About you
            </h1>
            <p className="max-w-[620px] text-[17px] leading-normal text-muted-foreground">
              This sets how your updates sound. You can change any of it later in Settings.
            </p>
          </div>

          {errors > 0 && (
            <ErrorSummary ref={summary} title={errors > 1 ? "Two things to fill in before you continue" : "One thing to fill in before you continue"}>
              Everything else you chose is kept. Fill in the highlighted {errors > 1 ? "fields" : "field"}, then press Continue.
            </ErrorSummary>
          )}

          <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
              <label htmlFor="setup-name" className={labelClass}>
                Your name
              </label>
              <input
                id="setup-name"
                type="text"
                autoComplete="name"
                value={profile.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
                aria-invalid={nameErr}
                aria-describedby={nameErr ? "setup-name-msg" : undefined}
                className={inputClass(nameErr)}
              />
              {nameErr && <FieldError id="setup-name-msg">Add your name so you can tell setups apart.</FieldError>}
            </div>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
              <label htmlFor="setup-sig" className={labelClass}>
                How you sign messages
              </label>
              <input
                id="setup-sig"
                type="text"
                value={profile.signature}
                placeholder="For example, Mita Ma'am"
                onChange={(e) => set({ signature: e.target.value })}
                aria-invalid={sigErr}
                aria-describedby={cn(sigErr && "setup-sig-msg", "setup-sig-preview")}
                className={inputClass(sigErr)}
              />
              {sigErr && <FieldError id="setup-sig-msg">Add how you sign off — it goes at the end of every update.</FieldError>}
              <div id="setup-sig-preview" className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm text-muted-foreground">Every update ends with</span>
                <span className="inline-flex min-h-8 items-center rounded-[12px_12px_12px_4px] bg-bubble px-3 py-1 text-base font-bold text-ink">{signOff(signature)}</span>
              </div>
            </div>
          </div>

          <fieldset className="flex min-w-0 flex-col gap-2.5">
            <legend className={cn(labelClass, "mb-2.5")}>Subjects you teach</legend>
            <div className="flex flex-wrap items-center gap-2.5">
              {profile.subjects.map((subject) => (
                <span key={subject} className="inline-flex h-11 items-center rounded-md border-2 border-sky bg-sky-tint pl-3.5 text-base font-extrabold text-on-sky-tint">
                  {subject}
                  <button
                    type="button"
                    aria-label={`Remove ${subject}`}
                    onClick={() => set({ subjects: profile.subjects.filter((s) => s !== subject) })}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-[10px]"
                  >
                    <X aria-hidden className="size-[18px]" strokeWidth={2.6} />
                  </button>
                </span>
              ))}
              {adding ? (
                <span className="inline-flex items-center gap-2">
                  <label htmlFor="setup-subject" className="sr-only">
                    New subject
                  </label>
                  <input
                    id="setup-subject"
                    type="text"
                    autoFocus
                    value={newSubject}
                    placeholder="e.g. English"
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubject();
                      }
                      if (e.key === "Escape") setAdding(false);
                    }}
                    className={cn(inputClass(), "h-11 w-[180px] text-base")}
                  />
                  <Key size="small" onClick={addSubject}>
                    Add
                  </Key>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border-2 border-hairline bg-surface px-3.5 text-base font-extrabold text-ocean"
                >
                  <Plus aria-hidden className="size-[18px]" strokeWidth={2.6} />
                  Add subject
                </button>
              )}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2.5">
            <span id="setup-lang-label" className={labelClass}>
              Default message language
            </span>
            <RadioGroup.Root
              value={profile.defaultLanguage}
              onValueChange={(value) => set({ defaultLanguage: value as Language })}
              aria-labelledby="setup-lang-label"
              aria-describedby="setup-lang-help"
              className="flex flex-wrap gap-2.5"
            >
              {LANGUAGES.map((l) => {
                const on = profile.defaultLanguage === l.code;
                return (
                  <RadioGroup.Item key={l.code} value={l.code} lang={l.code} className={cn(card(on), "h-[52px] min-w-[120px] items-center gap-2 px-[18px] text-[19px] font-bold", on ? "text-on-sky-tint" : "text-ink")}>
                    {dot(on)}
                    {l.label}
                  </RadioGroup.Item>
                );
              })}
            </RadioGroup.Root>
            <span id="setup-lang-help" className={helpClass}>
              You can set a different language for each student.
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span id="setup-tone-label" className={labelClass}>
              Tone
            </span>
            <RadioGroup.Root
              value={profile.tone}
              onValueChange={(value) => set({ tone: value as Tone })}
              aria-labelledby="setup-tone-label"
              className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3"
            >
              {TONES.map((t) => {
                const on = profile.tone === t.value;
                return (
                  <RadioGroup.Item key={t.value} value={t.value} className={cn(card(on), "flex-col items-start gap-2.5 rounded-lg p-4")}>
                    <span className={cn("flex items-center gap-2.5 text-[17px] font-extrabold", on ? "text-on-sky-tint" : "text-ink-strong")}>
                      {dot(on)}
                      {t.label}
                    </span>
                    <span className="text-base leading-normal text-ink">“{SAMPLE.en[t.value]}”</span>
                  </RadioGroup.Item>
                );
              })}
            </RadioGroup.Root>
          </div>

          <div className="flex flex-wrap gap-5">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
              <label htmlFor="setup-day" className={labelClass}>
                Report day
              </label>
              <span className="relative block">
                <select
                  id="setup-day"
                  value={profile.reportDay}
                  onChange={(e) => set({ reportDay: Number(e.target.value) })}
                  aria-describedby="setup-day-help"
                  className={cn(inputClass(), "cursor-pointer appearance-none pr-11")}
                >
                  {DAYS.map((d) => (
                    <option key={d.n} value={d.n}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute top-4 right-3.5 size-5 text-ink-strong" strokeWidth={2.4} />
              </span>
              <span id="setup-day-help" className={helpClass}>
                The day you review and send updates.
              </span>
            </div>
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
              <span id="setup-fee-label" className={labelClass}>
                Fee reminders
              </span>
              <div className="flex items-start gap-3.5">
                <Switch.Root
                  checked={profile.includeFeeReminders}
                  onCheckedChange={(on) => set({ includeFeeReminders: on })}
                  aria-labelledby="setup-fee-label"
                  aria-describedby="setup-fee-help"
                  className="group flex h-11 w-16 shrink-0 cursor-pointer items-center"
                >
                  <span aria-hidden className="relative block h-8 w-14 rounded-2xl bg-skip-border transition-colors duration-150 group-aria-checked:bg-sky">
                    <Switch.Thumb className="absolute top-1 left-1 block size-6 rounded-full bg-white shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-[left] duration-150 data-[state=checked]:left-7" />
                  </span>
                </Switch.Root>
                <span className="flex flex-col gap-0.5 pt-0.5">
                  <span className={cn("text-base font-extrabold", profile.includeFeeReminders ? "text-on-sky-tint" : "text-ink-strong")}>
                    {profile.includeFeeReminders ? "On" : "Off"}
                  </span>
                  <span id="setup-fee-help" className={helpClass}>
                    Adds one polite line to an update when you mark that student&apos;s fees as pending.
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Key type="submit" size="big" className="h-[52px] px-7">
              Continue to PIN
            </Key>
          </div>
        </form>

        <SetupAside label="How an update will sound">
          <h2 className="text-xl font-extrabold text-ink-strong">How an update will sound</h2>
          <p className="text-[15px] leading-normal text-muted-foreground">A fictional example. It changes as you choose.</p>
          <div
            aria-live="polite"
            lang={profile.defaultLanguage}
            className="flex max-w-full flex-col gap-2 self-start rounded-[16px_16px_16px_4px] bg-bubble px-4 py-3.5 text-base leading-[1.55] text-ink"
          >
            <span>{greeting(profile.defaultLanguage, sample.parent)}</span>
            <span>{sample[profile.tone]}</span>
            {profile.includeFeeReminders && <span>{FEE_LINE[profile.defaultLanguage]}</span>}
            <span className="font-bold">{signOff(signature)}</span>
          </div>
          <ul className="flex flex-col gap-2.5 text-[15px] leading-normal">
            {["Numbers always come from your notes, whatever the tone.", "You read every update before it's sent."].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
                {line}
              </li>
            ))}
          </ul>
        </SetupAside>
      </SetupColumns>
    </SetupFrame>
  );
}

function SetAPin({ profile, value, onChange, onBack }: { profile: SetupProfile; value: PinSetterValue; onChange: (v: PinSetterValue) => void; onBack: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { secret, why } = pinSetterResult(value);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await completeSetup(profile, secret);
        if (!result.ok) setError(result.error.message);
      } catch {
        setError("TuitionSetu couldn't save that. Check that it's still running on the laptop, then try again.");
      }
    });
  };

  return (
    <SetupFrame step={2}>
      <SetupColumns>
        <form aria-labelledby="pin-title" noValidate onSubmit={save} className={setupCard}>
          <div className="flex flex-col gap-3">
            <h1 id="pin-title" className="font-display text-[clamp(32px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong">
              {value.mode === "pin" ? "Set a PIN" : "Set a passphrase"}
            </h1>
            <div className="flex max-w-[620px] items-start gap-3 rounded-md bg-sky-tint px-4 py-3.5 text-on-sky-tint">
              <ShieldCheck aria-hidden className="mt-0.5 size-[22px] shrink-0" strokeWidth={2.4} />
              <span className="text-base leading-normal">Anyone on your Wi-Fi could open this page — your PIN keeps student details private.</span>
            </div>
          </div>

          <PinSetter value={value} onChange={onChange} />

          <div className="flex items-start gap-2.5 rounded-md bg-field px-4 py-3.5 text-[15px] leading-normal text-ink-strong">
            <Info aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
            <span>
              If you forget it, it can be reset on this laptop.{" "}
              <a href="/login/forgot" target="_blank" rel="noopener" className="font-extrabold text-ocean underline">
                How resetting works
              </a>
            </span>
          </div>

          {error && <Banner variant="flag">{error}</Banner>}

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex flex-wrap justify-between gap-3">
              <Key variant="secondary" className="h-[52px]" onClick={onBack} disabled={pending}>
                Back
              </Key>
              <Key type="submit" className="h-[52px] px-7" disabled={!secret || pending} aria-describedby={secret ? undefined : "pin-why"}>
                {pending ? "Saving…" : "Save and continue"}
              </Key>
            </div>
            {!secret && (
              <span id="pin-why" className="self-end text-sm text-muted-foreground">
                {why}
              </span>
            )}
          </div>
        </form>

        <SetupAside label="When you'll need it">
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md bg-surface text-ink-strong">
            <KeyRound className="size-6" strokeWidth={2.2} />
          </span>
          <h2 className="text-xl font-extrabold text-ink-strong">When you&apos;ll need it</h2>
          <ul className="flex flex-col gap-3 text-base leading-normal">
            {[
              "Once on each phone or laptop you open TuitionSetu on.",
              "Again after you sign a device out in Settings.",
              "After 5 wrong tries there's a 10-minute pause, so guessing doesn't work.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
                {line}
              </li>
            ))}
          </ul>
        </SetupAside>
      </SetupColumns>
    </SetupFrame>
  );
}
