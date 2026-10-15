"use client";

import { Calendar, Check, Plus, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AddInline } from "@/components/ts/add-inline";
import { Banner } from "@/components/ts/banner";
import { helpClass, labelClass } from "@/components/ts/field";
import { Key } from "@/components/ts/key";
import { useNoteDraft } from "@/lib/client/session-draft";
import { formatDay } from "@/lib/util/dates";
import { cn } from "@/lib/utils";
import { saveNote } from "./actions";

const chip = (on: boolean) =>
  cn(
    "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border-2 px-3.5 text-base font-extrabold",
    on ? "border-sky bg-sky-tint text-on-sky-tint" : "border-hairline bg-surface text-ink-strong",
  );

/** M3-TypeNote: the note, its class date and batch (one batch, D-06). Saving needs no AI. */
export function CaptureForm({ batches, today }: { batches: string[]; today: string }) {
  const router = useRouter();
  const [text, setText] = useNoteDraft();
  const [classDate, setClassDate] = useState(today);
  const [batch, setBatch] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [pending, startTransition] = useTransition();
  const dateInput = useRef<HTMLInputElement>(null);
  const options = [...new Set([...batches, ...(batch ? [batch] : [])])];

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await saveNote({ text, batch, classDate });
        if (!result.ok) return setError(result.error.message);
        setUnreachable(false);
        router.push(`/capture/${result.data.noteId}`);
        setText("");
      } catch {
        setUnreachable(true);
      }
    });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col lg:min-h-0 lg:px-6 lg:pt-8">
      <header className="flex min-h-16 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] lg:px-0 lg:pb-4">
        <Link href="/" aria-label="Close" className="flex size-12 shrink-0 items-center justify-center rounded-md text-ink-strong lg:hidden">
          <X aria-hidden className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-xl font-extrabold text-ink-strong lg:text-left lg:font-display lg:text-[40px] lg:leading-[1.1] lg:tracking-[-1px]">Type a note</h1>
        <span aria-hidden className="size-12 shrink-0 lg:hidden" />
      </header>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) save();
        }}
        className="flex flex-1 flex-col gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:rounded-lg lg:border-2 lg:border-b-4 lg:border-hairline lg:p-8"
      >
        <div role="group" aria-label="Date and batch" className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              try {
                dateInput.current?.showPicker();
              } catch {
                dateInput.current?.focus();
              }
            }}
            className={chip(false)}
          >
            <Calendar aria-hidden className="size-[18px]" strokeWidth={2.4} />
            <span className="sr-only">Class date: </span>
            {classDate === today ? `Today, ${formatDay(classDate)}` : formatDay(classDate)}
          </button>
          <label className="sr-only" htmlFor="capture-date">
            Class date
          </label>
          <input
            ref={dateInput}
            id="capture-date"
            type="date"
            value={classDate}
            max={today}
            onChange={(e) => e.target.value && setClassDate(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          />
          {options.map((b) => {
            const on = batch === b;
            return (
              <button key={b} type="button" aria-pressed={on} onClick={() => setBatch(on ? null : b)} className={chip(on)}>
                {on && <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />}
                {b}
              </button>
            );
          })}
          {adding ? (
            <AddInline id="capture-new-batch" label="New batch" placeholder="e.g. Sat 10 AM" onAdd={setBatch} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} aria-label="Add a batch" className={cn(chip(false), "w-11 justify-center px-0 text-ocean")}>
              <Plus aria-hidden className="size-5" strokeWidth={2.6} />
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="capture-text" className={labelClass}>
            Your note
          </label>
          <textarea
            id="capture-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10_000}
            placeholder="e.g. Riya ch5 test 14/20, missed HW twice; Arjun absent"
            aria-describedby="capture-help"
            className="min-h-[220px] w-full flex-1 resize-none rounded-md border-2 border-field-border bg-surface px-4 py-3.5 text-[17px] leading-normal text-ink placeholder:text-muted-foreground lg:min-h-[260px]"
          />
          <span id="capture-help" className={helpClass}>
            Write it the way you always do: English, বাংলা or shorthand. Nothing is sent from here.
          </span>
        </div>

        {error && <Banner variant="flag">{error}</Banner>}
        {unreachable && (
          <section aria-labelledby="unreachable-title" role="alert" className="flex flex-col gap-3 rounded-lg border-2 border-caution-border bg-caution px-4 py-4 text-on-caution">
            <h2 id="unreachable-title" className="flex items-center gap-2 text-lg font-extrabold">
              <WifiOff aria-hidden className="size-5" strokeWidth={2.4} />
              Can&apos;t reach your laptop
            </h2>
            <p className="text-base leading-normal">Your students&apos; details live on the laptop, so the phone needs it nearby. Check these:</p>
            <ol className="flex list-decimal flex-col gap-1 pl-6 text-base leading-normal">
              <li>Is the laptop switched on and awake?</li>
              <li>Is TuitionSetu open on it?</li>
              <li>Are both on the same home Wi-Fi?</li>
            </ol>
            <p className="text-[15px] leading-normal">Your note is kept here until it&apos;s saved. Press Save again to retry.</p>
          </section>
        )}

        <Key type="submit" size="big" disabled={!text.trim() || pending}>
          {pending ? "Saving…" : "Save"}
        </Key>
      </form>
    </div>
  );
}
