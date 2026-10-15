"use client";

import { Info, Lock, Search, SearchX, User, UserPlus } from "lucide-react";
import { RadioGroup, Switch } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Banner } from "@/components/ts/banner";
import { FieldError, helpClass, inputClass, labelClass } from "@/components/ts/field";
import { Key, KeyLink } from "@/components/ts/key";
import { PhoneField } from "@/components/ts/phone-field";
import { useToast } from "@/components/ts/toast";
import type { ActionResult } from "@/lib/auth/types";
import type { NeedsYouItem, StudentOption } from "@/lib/pipeline/needs-you";
import { LANGUAGE_LABEL, type Language } from "@/lib/schemas/common";
import { StudentInput } from "@/lib/schemas/student";
import { normalizeName } from "@/lib/util/text";
import { cn } from "@/lib/utils";
import { answerFeePrompt, resolveEntry, setEntryScore, undoResolve, type Choice } from "./actions";
import { ItemIcon } from "./inbox";

const UNREACHABLE = "TuitionSetu couldn't save that. Check that it's still running on the laptop, then try again.";
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
// Keys hold one line; these carry a student's name, which can be long.
const WRAP = "h-auto min-h-14 whitespace-normal py-3 text-center";

const radioCard = (on: boolean) =>
  cn("flex w-full cursor-pointer items-center gap-3 rounded-md border-2 px-3.5 py-3 text-left", on ? "border-sky bg-sky-tint" : "border-hairline bg-surface");
const dot = (on: boolean) => (
  <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface", on ? "border-sky" : "border-skip-border")}>
    <span className={cn("size-2.5 rounded-full", on ? "bg-sky" : "bg-transparent")} />
  </span>
);

function Quote({ item, label }: { item: NeedsYouItem; label?: string }) {
  if (!item.quote) return null;
  return (
    <figure className="flex flex-col gap-1 rounded-md bg-field px-4 py-3">
      <blockquote className="text-[17px] leading-normal break-words text-ink">
        {label && <span className="text-muted-foreground">{label} </span>}“{item.quote}”
      </blockquote>
      <figcaption className="text-sm text-muted-foreground">
        note from {item.note.day}
        {item.note.batch && ` · ${item.note.batch} batch`}
      </figcaption>
    </figure>
  );
}

/** Search the roster by name or nickname and pick one (N-Desktop, N1 "Which student is this?"). */
function StudentPicker({ students, value, onChange }: { students: StudentOption[]; value: string | null; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const q = normalizeName(query);
  const shown = students.filter((s) => !q || [s.fullName, s.messageName, ...s.aliases].some((n) => normalizeName(n).includes(q)));
  return (
    <div className="flex flex-col gap-2.5">
      <span className="relative block">
        <label htmlFor="picker-search" className="sr-only">
          Search students
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-4 left-3.5 size-5 text-muted-foreground" strokeWidth={2.4} />
        <input id="picker-search" type="search" autoComplete="off" autoFocus value={query} placeholder="Search by name or nickname" onChange={(e) => setQuery(e.target.value)} className={cn(inputClass(), "pl-11")} />
      </span>
      {shown.length ? (
        <RadioGroup.Root value={value ?? ""} onValueChange={onChange} aria-label="Students" className="flex max-h-[264px] flex-col gap-1.5 overflow-y-auto">
          {shown.map((s) => (
            <RadioGroup.Item key={s.id} value={s.id} className={radioCard(value === s.id)}>
              {dot(value === s.id)}
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-extrabold text-ink-strong">{s.fullName}</span>
                <span className="text-sm text-muted-foreground">{s.meta}</span>
              </span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      ) : (
        <p className="px-1 text-base text-muted-foreground">{students.length ? `No students match “${query.trim()}”.` : "There are no students on your list yet."}</p>
      )}
    </div>
  );
}

function Remember({ name, student, on, onChange }: { name: string; student?: StudentOption; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border-2 border-hairline px-4 py-3">
      <span className="flex flex-col">
        <span id="remember-label" className="text-base font-extrabold text-ink-strong">
          Remember this nickname
        </span>
        <span id="remember-help" className="text-sm text-muted-foreground">
          {student ? `Next time ‘${name}’ means ${student.fullName}` : `Next time ‘${name}’ matches on its own`}
        </span>
      </span>
      <Switch.Root
        checked={on}
        onCheckedChange={onChange}
        aria-labelledby="remember-label"
        aria-describedby="remember-help"
        className="group flex h-11 w-16 shrink-0 cursor-pointer items-center"
      >
        <span aria-hidden className="relative block h-8 w-14 rounded-2xl bg-skip-border transition-colors duration-150 group-aria-checked:bg-sky">
          <Switch.Thumb className="absolute top-1 left-1 block size-6 rounded-full bg-surface shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-[left] duration-150 data-[state=checked]:left-7" />
        </span>
      </Switch.Root>
    </div>
  );
}

type NewStudentValues = { fullName: string; classGrade: string; parentPhone: string; parentLanguage: Language };

/** N2-NewStudent: the four fields updates need; the rest can wait. */
function NewStudentForm({ item, others, defaultLanguage, pending, onSubmit, onCancel }: { item: NeedsYouItem; others: StudentOption[]; defaultLanguage: Language; pending: boolean; onSubmit: (v: NewStudentValues) => void; onCancel: () => void }) {
  const [v, setV] = useState<NewStudentValues>({ fullName: item.name, classGrade: "", parentPhone: "", parentLanguage: defaultLanguage });
  const [tried, setTried] = useState(false);
  const parsed = StudentInput.safeParse({ ...v, messageName: firstName(v.fullName) });
  const issues: Record<string, string> = tried && !parsed.success ? Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) : {};
  const label = firstName(v.fullName) || "student";

  return (
    <form
      noValidate
      aria-labelledby="new-student-title"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (parsed.success) onSubmit(v);
      }}
      className="flex flex-col gap-4 rounded-lg border-2 border-sky p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id="new-student-title" className="text-xl font-extrabold text-ink-strong">
          New student
        </h3>
        <p className="text-sm text-muted-foreground">
          From “{item.quote}” · {item.note.day}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="new-fullName" className={labelClass}>
          Full name <span aria-hidden className="text-danger">*</span>
        </label>
        <input id="new-fullName" autoFocus autoComplete="off" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} aria-required aria-invalid={!!issues.fullName} aria-describedby="new-fullName-help" className={inputClass(!!issues.fullName)} />
        {issues.fullName ? <FieldError>{issues.fullName}</FieldError> : <span id="new-fullName-help" className={helpClass}>From your note. Add the surname if you know it.</span>}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="new-classGrade" className={labelClass}>
          Class <span aria-hidden className="text-danger">*</span>
        </label>
        <input id="new-classGrade" autoComplete="off" placeholder="e.g. 7" value={v.classGrade} onChange={(e) => setV({ ...v, classGrade: e.target.value })} aria-required aria-invalid={!!issues.classGrade} className={cn(inputClass(!!issues.classGrade), "w-[120px]")} />
        {issues.classGrade && <FieldError>{issues.classGrade}</FieldError>}
      </div>
      <PhoneField id="new-parentPhone" value={v.parentPhone} onChange={(parentPhone) => setV({ ...v, parentPhone })} others={others} showErrors={tried} />
      <div className="flex flex-col gap-2">
        <span id="new-lang-label" className={labelClass}>
          Message language <span aria-hidden className="text-danger">*</span>
        </span>
        <RadioGroup.Root value={v.parentLanguage} onValueChange={(value) => setV({ ...v, parentLanguage: value as Language })} aria-labelledby="new-lang-label" className="grid grid-cols-3 gap-2">
          {(["en", "bn", "hi"] as const).map((code) => (
            <RadioGroup.Item key={code} value={code} lang={code} className={cn(radioCard(v.parentLanguage === code), "h-[52px] justify-center px-2 text-[17px] font-bold", v.parentLanguage === code ? "text-on-sky-tint" : "text-ink")}>
              {LANGUAGE_LABEL[code]}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
      <p className={cn(helpClass, "flex items-start gap-2")}>
        <Info aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.4} />
        Add more details later — batch, subjects, nicknames.
      </p>
      <Key type="submit" size="big" disabled={pending} className={WRAP}>
        <UserPlus aria-hidden strokeWidth={2.4} />
        {pending ? "Adding…" : `Add ${label} and use this note`}
      </Key>
      <Key variant="text" onClick={onCancel} disabled={pending} className="self-center">
        Cancel
      </Key>
    </form>
  );
}

/**
 * One Needs-you item (N1–N4, M5 ×2): the question, the line from the note it's about, and the
 * answers this member may give. A successful answer refreshes the page, which moves on to the
 * next item; the toast says what happened.
 */
export function ItemDetail({
  item,
  students,
  canAddStudents,
  ownerFirstName,
  defaultLanguage,
}: {
  item: NeedsYouItem;
  students: StudentOption[];
  canAddStudents: boolean;
  ownerFirstName: string | null;
  defaultLanguage: Language;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "pick" | "new" | "ignore">("none");
  const [picked, setPicked] = useState<string | null>(item.candidates[0]?.id ?? null);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [remember, setRemember] = useState(true);
  const [total, setTotal] = useState("");
  const [scored, setScored] = useState(String(item.score?.scored ?? ""));
  const [max, setMax] = useState(String(item.score?.max ?? ""));

  const run = (action: () => Promise<ActionResult<unknown>>, done: (data: unknown) => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch(() => null);
      if (!result?.ok) return setError(result?.error.message ?? UNREACHABLE);
      done(result.data);
    });

  const assign = (studentId: string) => {
    const student = students.find((s) => s.id === studentId)!;
    const choice: Choice = { studentId, rememberAlias: !!item.name && item.type === "unmatched_name" && remember };
    run(() => resolveEntry(item.id, choice), () => toast({ text: `Added to ${student.messageName}'s week` }));
  };
  const ignore = () => run(() => resolveEntry(item.id, { ignore: true }), () => toast({ text: "Ignored", undo: () => void undoResolve(item.id) }));
  const addStudent = (v: NewStudentValues) =>
    run(
      () => resolveEntry(item.id, { newStudent: v }),
      (data) => {
        const { studentId, name } = data as { studentId: string; name: string };
        toast({ text: `${name} added — ${name}'s note is ready`, link: { label: "Add details", href: `/students/${studentId}/edit` } });
      },
    );

  const pickedStudent = students.find((s) => s.id === picked);
  const unmatched = item.type === "unmatched_name";
  const withCandidates = unmatched && item.candidates.length > 0;
  const choosing = withCandidates ? someoneElse : panel === "pick";

  const header = (
    <div className="flex items-start gap-3">
      <ItemIcon type={item.type} className="size-11" />
      <h2 id="item-title" className="pt-1.5 text-2xl leading-tight font-extrabold text-ink-strong">
        {item.title}
      </h2>
    </div>
  );

  const ignoreConfirm = (
    <div role="alertdialog" aria-labelledby="ignore-title" aria-describedby="ignore-text" className="flex flex-col gap-3 rounded-lg border-2 border-hairline bg-field p-4">
      <h3 id="ignore-title" className="text-lg font-extrabold text-ink-strong">
        Ignore this line?
      </h3>
      <p id="ignore-text" className="text-base leading-normal">
        This line will be left out of updates: ‘{item.quote}’ The rest of the note is still used, and you can undo this.
      </p>
      <div className="flex flex-wrap gap-3">
        <Key variant="secondary" className="flex-1" onClick={() => setPanel("none")} disabled={pending}>
          Go back
        </Key>
        <Key className="flex-1" autoFocus onClick={ignore} disabled={pending}>
          {pending ? "Ignoring…" : "Ignore line"}
        </Key>
      </div>
    </div>
  );

  const newStudentKey = canAddStudents ? (
    <Key variant={withCandidates ? "secondary" : "primary"} onClick={() => setPanel("new")} disabled={pending}>
      <UserPlus aria-hidden strokeWidth={2.4} />
      New student
    </Key>
  ) : (
    <span className="flex flex-col gap-1">
      <Key variant="secondary" disabled aria-describedby="new-student-why">
        <UserPlus aria-hidden strokeWidth={2.4} />
        New student
      </Key>
      <span id="new-student-why" className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
        Only owners and teachers can add students{ownerFirstName ? ` — ${ownerFirstName} will see this.` : "."}
      </span>
    </span>
  );

  let body: ReactNode = null;
  if (unmatched || item.type === "unattributed") {
    const pickLabel = choosing ? (pickedStudent ? `Use for ${pickedStudent.messageName}` : "Choose a student") : pickedStudent ? `Yes, it's ${pickedStudent.messageName}` : "Choose a student";
    body = (
      <>
        <Quote item={item} />
        {withCandidates ? (
          <>
            <p className="text-base leading-normal text-muted-foreground">You wrote ‘{item.name}’ in a note. I won&apos;t guess, so please pick who it is.</p>
            <RadioGroup.Root
              value={someoneElse ? "other" : (picked ?? "")}
              onValueChange={(value) => {
                setSomeoneElse(value === "other");
                setPicked(value === "other" ? null : value);
              }}
              aria-label={`Student for ‘${item.name}’`}
              className="flex flex-col gap-2"
            >
              {item.candidates.map((c, i) => (
                <RadioGroup.Item key={c.id} value={c.id} className={radioCard(!someoneElse && picked === c.id)}>
                  {dot(!someoneElse && picked === c.id)}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[17px] font-extrabold text-ink-strong">{c.fullName}</span>
                    <span className="text-sm text-muted-foreground">{c.meta}</span>
                  </span>
                  {i === 0 && <span className="rounded-sm border-2 border-sky px-1.5 text-xs font-extrabold tracking-[0.6px] text-ocean uppercase">Suggested</span>}
                </RadioGroup.Item>
              ))}
              <RadioGroup.Item value="other" className={radioCard(someoneElse)}>
                {dot(someoneElse)}
                <span className="flex flex-col">
                  <span className="text-[17px] font-extrabold text-ink-strong">Someone else</span>
                  <span className="text-sm text-muted-foreground">Choose from your students</span>
                </span>
              </RadioGroup.Item>
            </RadioGroup.Root>
          </>
        ) : (
          unmatched && (
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <SearchX aria-hidden className="size-[18px]" strokeWidth={2.4} />
              No close matches on your list
            </p>
          )
        )}

        {choosing && (
          <div className="flex flex-col gap-3 rounded-lg border-2 border-sky p-4">
            <span className={labelClass}>Which student is this?</span>
            <StudentPicker students={students} value={picked} onChange={setPicked} />
          </div>
        )}

        {panel === "new" ? (
          <NewStudentForm item={item} others={students} defaultLanguage={defaultLanguage} pending={pending} onSubmit={addStudent} onCancel={() => setPanel("none")} />
        ) : panel === "ignore" ? (
          ignoreConfirm
        ) : withCandidates || choosing ? (
          <>
            {unmatched && <Remember name={item.name} student={pickedStudent} on={remember} onChange={setRemember} />}
            <div className="flex flex-wrap gap-3">
              {choosing && !withCandidates && (
                <Key variant="secondary" className="flex-1" onClick={() => setPanel("none")} disabled={pending}>
                  Cancel
                </Key>
              )}
              <Key size="big" className={cn("flex-[2]", WRAP)} onClick={() => picked && assign(picked)} disabled={!picked || pending}>
                {pending ? "Saving…" : pickLabel}
              </Key>
            </div>
            {unmatched && (
              <div className="flex flex-wrap items-start gap-3">
                <span className="self-center text-[15px] text-muted-foreground">Not on your list?</span>
                {newStudentKey}
                <Key variant="text" onClick={() => setPanel("ignore")} disabled={pending}>
                  Ignore
                </Key>
              </div>
            )}
            {!unmatched && (
              <Key variant="text" className="self-center" onClick={() => setPanel("ignore")} disabled={pending}>
                Ignore
              </Key>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Key variant="secondary" size="big" onClick={() => setPanel("pick")} disabled={pending}>
              <User aria-hidden strokeWidth={2.4} />
              Assign to a student…
            </Key>
            {unmatched && newStudentKey}
            <Key variant="text" className="self-center" onClick={() => setPanel("ignore")} disabled={pending}>
              Ignore
            </Key>
          </div>
        )}
      </>
    );
  } else if (item.type === "missing_total" && item.score) {
    const n = Number(total);
    const bad = total !== "" && !(n > 0 && n >= (item.score.scored ?? 0));
    body = (
      <>
        <p className="text-base leading-normal text-muted-foreground">
          The note gives {item.name}&apos;s score but not the total. I&apos;ll leave it out of {item.name}&apos;s update until you tell me.
        </p>
        <Quote item={item} label="Your note:" />
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (total && !bad) run(() => setEntryScore(item.id, item.score!.index, { scored: item.score!.scored!, max: n }), () => toast({ text: `Score saved for ${item.name}` }));
          }}
        >
          <label htmlFor="total" className={labelClass}>
            Total marks for this test
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-extrabold text-ink-strong">{item.score.scored}</span>
            <span className="text-base text-muted-foreground">out of</span>
            <input id="total" inputMode="decimal" autoFocus placeholder="e.g. 20" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={bad} aria-describedby={bad ? "total-error" : undefined} className={cn(inputClass(bad), "w-[140px]")} />
          </div>
          {bad && <FieldError id="total-error">The total can&apos;t be less than {item.score.scored}.</FieldError>}
          <Key type="submit" size="big" disabled={!total || bad || pending}>
            {pending ? "Saving…" : "Save total"}
          </Key>
          <Key variant="text" className="self-center" disabled={pending} onClick={() => run(() => setEntryScore(item.id, item.score!.index, null), () => toast({ text: `Left out of ${item.name}'s update` }))}>
            Leave this score out
          </Key>
        </form>
      </>
    );
  } else if (item.type === "impossible_score" && item.score) {
    const s = Number(scored);
    const m = Number(max);
    const bad = scored !== "" && max !== "" && !(m > 0 && s >= 0 && s <= m);
    body = (
      <>
        <p className="text-base leading-normal text-muted-foreground">
          {item.score.scored} out of {item.score.max} can&apos;t be right. Fix the numbers, or leave this score out of {item.name}&apos;s update.
        </p>
        <Quote item={item} label="Your note:" />
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (scored && max && !bad) run(() => setEntryScore(item.id, item.score!.index, { scored: s, max: m }), () => toast({ text: `Score saved for ${item.name}` }));
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <span className="flex flex-col gap-1.5">
              <label htmlFor="scored" className={labelClass}>
                Score
              </label>
              <input id="scored" inputMode="decimal" value={scored} onChange={(e) => setScored(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={bad} className={cn(inputClass(bad), "w-[120px]")} />
            </span>
            <span className="pb-3.5 text-base text-muted-foreground">out of</span>
            <span className="flex flex-col gap-1.5">
              <label htmlFor="max" className={labelClass}>
                Total
              </label>
              <input id="max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={bad} className={cn(inputClass(bad), "w-[120px]")} />
            </span>
          </div>
          {bad && <FieldError>The score has to be between 0 and the total.</FieldError>}
          <Key type="submit" size="big" disabled={!scored || !max || bad || pending}>
            {pending ? "Saving…" : "Save score"}
          </Key>
          <Key variant="text" className="self-center" disabled={pending} onClick={() => run(() => setEntryScore(item.id, item.score!.index, null), () => toast({ text: `Left out of ${item.name}'s update` }))}>
            Leave this score out
          </Key>
        </form>
      </>
    );
  } else if (item.type === "unsupported_entry") {
    body = (
      <>
        <p className="text-base leading-normal text-muted-foreground">I found this while reading your note, but I can&apos;t find these words in it, so it&apos;s left out until you check.</p>
        <Quote item={item} />
        {panel === "ignore" ? (
          ignoreConfirm
        ) : (
          <div className="flex flex-col gap-3">
            <KeyLink href={`/capture/${item.note.id}`} variant="secondary" size="big">
              Show my note
            </KeyLink>
            <Key variant="text" className="self-center" onClick={() => setPanel("ignore")} disabled={pending}>
              Ignore
            </Key>
          </div>
        )}
      </>
    );
  } else if (item.type === "fee_prompt") {
    body = (
      <>
        <p className="text-base leading-normal text-muted-foreground">Your note mentions fees. Yes adds one polite fee line to {item.name}&apos;s next update.</p>
        <Quote item={item} />
        <div className="flex flex-wrap gap-3">
          <Key variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => answerFeePrompt(item.id, false), () => toast({ text: `No fee line for ${item.name}` }))}>
            No
          </Key>
          <Key className="flex-[2]" disabled={pending} onClick={() => run(() => answerFeePrompt(item.id, true), () => toast({ text: `Fees marked pending for ${item.name}` }))}>
            Yes, fees are pending
          </Key>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="item-title" className="flex min-w-0 flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline p-4 sm:p-6">
      {header}
      {body}
      {error && <Banner variant="flag">{error}</Banner>}
    </section>
  );
}
