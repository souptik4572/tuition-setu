"use client";

import { Check, Plus, Sparkles, X } from "lucide-react";
import { RadioGroup, Switch } from "radix-ui";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { AddInline } from "@/components/ts/add-inline";
import { Banner } from "@/components/ts/banner";
import { ErrorSummary } from "@/components/ts/error-summary";
import { FieldError, helpClass, inputClass, labelClass } from "@/components/ts/field";
import { Key } from "@/components/ts/key";
import { PhoneField, phoneInputValue } from "@/components/ts/phone-field";
import type { Student } from "@/lib/db/queries/students";
import { LANGUAGE_LABEL, type Language } from "@/lib/schemas/common";
import { StudentInput } from "@/lib/schemas/student";
import { cn } from "@/lib/utils";
import { createStudent, updateStudent } from "./actions";

const LANGUAGES: { code: Language; english?: string }[] = [{ code: "en" }, { code: "bn", english: "Bengali" }, { code: "hi", english: "Hindi" }];

// The order R1-Errors lists them in.
const SUMMARY: { field: keyof StudentInput; label: string }[] = [
  { field: "fullName", label: "Full name" },
  { field: "messageName", label: "Name used in messages" },
  { field: "classGrade", label: "Class" },
  { field: "parentPhone", label: "WhatsApp number" },
  { field: "parentLanguage", label: "Language" },
];

type Values = {
  fullName: string;
  messageName: string;
  /** Until the tutor types their own, the message name follows the first word of the full name. */
  messageNameEdited: boolean;
  classGrade: string;
  batch: string | null;
  subjects: string[];
  parentName: string;
  parentPhone: string;
  parentLanguage: Language;
  nicknames: string[];
  standingNotes: string;
  feesPending: boolean;
};

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? "";

function startValues(student: Student | undefined, defaultLanguage: Language): Values {
  if (!student) {
    return { fullName: "", messageName: "", messageNameEdited: false, classGrade: "", batch: null, subjects: [], parentName: "", parentPhone: "", parentLanguage: defaultLanguage, nicknames: [], standingNotes: "", feesPending: false };
  }
  return {
    fullName: student.fullName,
    messageName: student.messageName,
    messageNameEdited: student.messageName !== firstWord(student.fullName),
    classGrade: student.classGrade,
    batch: student.batch,
    subjects: student.subjectsJson,
    parentName: student.parentName ?? "",
    parentPhone: phoneInputValue(student.parentPhone),
    parentLanguage: student.parentLanguage,
    nicknames: student.aliasesJson,
    standingNotes: student.standingNotes ?? "",
    feesPending: student.feesPending,
  };
}

const uniq = (items: (string | null)[]) => [...new Set(items.filter((s): s is string => !!s))];

const chip = (on: boolean) =>
  cn(
    "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border-2 px-3.5 text-base font-extrabold",
    on ? "border-sky bg-sky-tint text-on-sky-tint" : "border-hairline bg-surface text-ink-strong",
  );

const addKey = "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-md border-2 border-hairline bg-surface px-3.5 text-base font-extrabold text-ocean";

function Label({ htmlFor, id, required, optional, children }: { htmlFor?: string; id?: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag htmlFor={htmlFor} id={id} className={labelClass}>
      {children}
      {required && (
        <span aria-hidden className="text-danger">
          {" "}
          *
        </span>
      )}
      {optional && <span className="font-semibold text-muted-foreground"> (optional)</span>}
    </Tag>
  );
}

/**
 * The student form (R1-Edit, R1-Errors, R2, G3-Growing). Checks the same schema as the server
 * before saving, keeps what was typed when something is missing, and lists what's left.
 */
export function StudentForm({
  student,
  heading,
  intro,
  batches,
  subjects,
  others,
  defaultLanguage,
  feeReminders,
  stickyKeys,
  onSaved,
  onCancel,
}: {
  student?: Student;
  heading?: ReactNode;
  intro?: boolean;
  /** Batches already in use, offered as chips. */
  batches: string[];
  /** The workspace's subjects. */
  subjects: string[];
  /** Every other active student, for the brothers-and-sisters note. */
  others: { fullName: string; parentPhone: string }[];
  defaultLanguage: Language;
  feeReminders: boolean;
  /** Keeps the keys on screen at the bottom of a phone (R1). */
  stickyKeys?: boolean;
  onSaved: (saved: { id: string; fullName: string; another: boolean }) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => startValues(student, defaultLanguage));
  const [tried, setTried] = useState(false);
  const [adding, setAdding] = useState<"batch" | "nickname" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

  const messageName = values.messageNameEdited ? values.messageName : firstWord(values.fullName);
  const input: StudentInput = {
    fullName: values.fullName,
    messageName,
    classGrade: values.classGrade,
    batch: values.batch,
    subjects: values.subjects,
    parentName: values.parentName,
    parentPhone: values.parentPhone,
    parentLanguage: values.parentLanguage,
    nicknames: values.nicknames,
    standingNotes: values.standingNotes,
    feesPending: feeReminders && values.feesPending,
  };
  const parsed = StudentInput.safeParse(input);
  const issues: Partial<Record<keyof StudentInput, string>> =
    tried && !parsed.success ? Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])) : {};
  // With no full name the message name has nothing to fill from; R1-Errors shows that as help, not an error.
  if (issues.fullName) delete issues.messageName;
  const missing = SUMMARY.filter((s) => issues[s.field]);

  const save = (another: boolean) => {
    setTried(true);
    setError(null);
    if (!parsed.success) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    startTransition(async () => {
      try {
        const result = student ? await updateStudent(student.id, input) : await createStudent(input);
        if (!result.ok) return setError(result.error.message);
        if (another) {
          // Let a focused field finish its blur first (the phone field tidies its value then);
          // blurring after the reset would write the old student's value back.
          (document.activeElement as HTMLElement | null)?.blur();
          setValues(startValues(undefined, defaultLanguage));
          setTried(false);
          document.getElementById("student-fullName")?.focus();
        }
        onSaved({ id: result.data.id, fullName: parsed.data.fullName, another });
      } catch {
        setError("TuitionSetu couldn't save that. Check that it's still running on the laptop, then try again. What you typed is kept.");
      }
    });
  };

  const described = (field: keyof StudentInput, help?: string) => cn(issues[field] && `student-${field}-error`, help) || undefined;
  const batchOptions = uniq([...batches, values.batch]);
  const subjectOptions = uniq([...subjects, ...values.subjects]);

  return (
    <form
      noValidate
      aria-label={student ? `${student.fullName}'s details` : "New student"}
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      className="flex flex-col gap-6"
    >
      {heading}
      {intro && (
        <p className={helpClass}>
          Fields marked <span className="font-extrabold text-danger">*</span> are needed for updates.
        </p>
      )}

      {missing.length > 0 && (
        <ErrorSummary
          ref={summary}
          title={missing.length === 1 ? "1 thing to fill in before saving" : `${missing.length} things to fill in before saving`}
          links={missing.map((m) => ({ id: `student-${m.field}`, label: m.label }))}
        >
          What you typed is kept.
        </ErrorSummary>
      )}

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <Label htmlFor="student-fullName" required>
            Full name
          </Label>
          <input
            id="student-fullName"
            type="text"
            autoComplete="off"
            autoFocus={!student}
            value={values.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            aria-required
            aria-invalid={!!issues.fullName}
            aria-describedby={described("fullName")}
            className={inputClass(!!issues.fullName)}
          />
          {issues.fullName && <FieldError id="student-fullName-error">{issues.fullName}</FieldError>}
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <Label htmlFor="student-messageName" required>
            Name used in messages
          </Label>
          <input
            id="student-messageName"
            type="text"
            autoComplete="off"
            value={messageName}
            onChange={(e) => set({ messageName: e.target.value, messageNameEdited: e.target.value.trim() !== "" })}
            aria-required
            aria-invalid={!!issues.messageName}
            aria-describedby={described("messageName", "student-messageName-help")}
            className={inputClass(!!issues.messageName)}
          />
          {issues.messageName && <FieldError id="student-messageName-error">Enter the name to use in messages</FieldError>}
          {!values.messageNameEdited && (
            <span id="student-messageName-help" className={cn(helpClass, "flex items-start gap-1.5")}>
              {values.fullName.trim() ? (
                <>
                  <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                  Filled in from the first name — change it if you like
                </>
              ) : (
                "Fills in from the first name once you add it"
              )}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-[0_1_170px] flex-col gap-2">
          <Label htmlFor="student-classGrade" required>
            Class
          </Label>
          <input
            id="student-classGrade"
            type="text"
            autoComplete="off"
            value={values.classGrade}
            onChange={(e) => set({ classGrade: e.target.value })}
            aria-required
            aria-invalid={!!issues.classGrade}
            aria-describedby={described("classGrade")}
            className={cn(inputClass(!!issues.classGrade), "w-[120px]")}
          />
          {issues.classGrade && <FieldError id="student-classGrade-error">{issues.classGrade}</FieldError>}
        </div>
      </div>

      <div role="group" aria-labelledby="student-batch-label" className="flex flex-col gap-2.5">
        <Label id="student-batch-label" optional>
          Batch
        </Label>
        <div className="flex flex-wrap items-center gap-2.5">
          {batchOptions.map((batch) => {
            const on = values.batch === batch;
            return (
              <button key={batch} type="button" aria-pressed={on} onClick={() => set({ batch: on ? null : batch })} className={chip(on)}>
                {on && <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />}
                {batch}
              </button>
            );
          })}
          {adding === "batch" ? (
            <AddInline
              id="student-new-batch"
              label="New batch"
              placeholder="e.g. Mon/Wed 6 PM"
              onAdd={(batch) => set({ batch: batchOptions.find((b) => b.toLowerCase() === batch.toLowerCase()) ?? batch })}
              onClose={() => setAdding(null)}
            />
          ) : (
            <button type="button" onClick={() => setAdding("batch")} className={addKey}>
              <Plus aria-hidden className="size-[18px]" strokeWidth={2.6} />
              New batch
            </button>
          )}
        </div>
      </div>

      {subjectOptions.length > 0 && (
        <div role="group" aria-labelledby="student-subjects-label" className="flex flex-col gap-2.5">
          <Label id="student-subjects-label">Subjects</Label>
          <div className="flex flex-wrap gap-2.5">
            {subjectOptions.map((subject) => {
              const on = values.subjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ subjects: on ? values.subjects.filter((s) => s !== subject) : [...values.subjects, subject] })}
                  className={chip(on)}
                >
                  {on && <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />}
                  {subject}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
          <Label htmlFor="student-parentName" optional>
            Parent&apos;s name
          </Label>
          <input
            id="student-parentName"
            type="text"
            autoComplete="off"
            value={values.parentName}
            placeholder="e.g. Mrs Sen"
            onChange={(e) => set({ parentName: e.target.value })}
            aria-describedby="student-parentName-help"
            className={inputClass()}
          />
          <span id="student-parentName-help" className={helpClass}>
            Used in the greeting
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col">
          <PhoneField id="student-parentPhone" value={values.parentPhone} onChange={(parentPhone) => set({ parentPhone })} others={others} showErrors={tried} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label id="student-lang-label" required>
          Message language
        </Label>
        <RadioGroup.Root
          id="student-parentLanguage"
          value={values.parentLanguage}
          onValueChange={(value) => set({ parentLanguage: value as Language })}
          aria-labelledby="student-lang-label"
          aria-required
          aria-describedby={described("parentLanguage")}
          className="flex flex-wrap gap-2.5"
        >
          {LANGUAGES.map((l) => {
            const on = values.parentLanguage === l.code;
            return (
              <RadioGroup.Item
                key={l.code}
                value={l.code}
                className={cn(
                  "flex h-[52px] min-w-[120px] cursor-pointer items-center gap-2 rounded-md border-2 border-b-4 px-[18px] text-left",
                  on ? "border-sky bg-sky-tint text-on-sky-tint" : "border-hairline bg-surface text-ink",
                )}
              >
                <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface", on ? "border-sky" : "border-skip-border")}>
                  <span className={cn("size-2.5 rounded-full", on ? "bg-sky" : "bg-transparent")} />
                </span>
                <span lang={l.code} className="text-[19px] font-bold">
                  {LANGUAGE_LABEL[l.code]}
                </span>
                {l.english && <span className="text-sm font-extrabold text-muted-foreground">({l.english})</span>}
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
        {issues.parentLanguage && <FieldError id="student-parentLanguage-error">{issues.parentLanguage}</FieldError>}
      </div>

      <div className="flex flex-wrap gap-5">
        <div role="group" aria-labelledby="student-nicknames-label" aria-describedby="student-nicknames-help" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
          <Label id="student-nicknames-label" optional>
            Nicknames
          </Label>
          <div className="flex flex-wrap items-center gap-2.5">
            {values.nicknames.map((nickname) => (
              <span key={nickname} className="inline-flex h-11 items-center rounded-md border-2 border-hairline bg-field pl-3.5 text-base font-extrabold text-ink-strong">
                {nickname}
                <button
                  type="button"
                  aria-label={`Remove nickname ${nickname}`}
                  onClick={() => set({ nicknames: values.nicknames.filter((n) => n !== nickname) })}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-[10px]"
                >
                  <X aria-hidden className="size-[18px]" strokeWidth={2.6} />
                </button>
              </span>
            ))}
            {adding === "nickname" ? (
              <AddInline
                id="student-new-nickname"
                label="Nickname"
                placeholder="e.g. Riyu"
                onAdd={(nickname) => !values.nicknames.includes(nickname) && set({ nicknames: [...values.nicknames, nickname] })}
                onClose={() => setAdding(null)}
              />
            ) : (
              <button type="button" onClick={() => setAdding("nickname")} className={addKey}>
                <Plus aria-hidden className="size-[18px]" strokeWidth={2.6} />
                Add a nickname
              </button>
            )}
          </div>
          <span id="student-nicknames-help" className={helpClass}>
            Names you sometimes write in your notes
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          <Label htmlFor="student-notes" optional>
            Notes for messages
          </Label>
          <textarea
            id="student-notes"
            rows={3}
            value={values.standingNotes}
            placeholder="e.g. Father prefers short messages"
            onChange={(e) => set({ standingNotes: e.target.value })}
            className={cn(inputClass(), "h-auto min-h-[88px] py-3 leading-normal")}
          />
        </div>
      </div>

      {feeReminders && (
        <div className="flex items-start gap-3.5">
          <Switch.Root
            id="student-fees"
            checked={values.feesPending}
            onCheckedChange={(feesPending) => set({ feesPending })}
            aria-labelledby="student-fees-label"
            aria-describedby="student-fees-help"
            className="group flex h-11 w-16 shrink-0 cursor-pointer items-center"
          >
            <span aria-hidden className="relative block h-8 w-14 rounded-2xl bg-skip-border transition-colors duration-150 group-aria-checked:bg-sky">
              <Switch.Thumb className="absolute top-1 left-1 block size-6 rounded-full bg-surface shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-[left] duration-150 data-[state=checked]:left-7" />
            </span>
          </Switch.Root>
          <span className="flex flex-col gap-0.5 pt-0.5">
            <span id="student-fees-label" className="text-base font-extrabold text-ink-strong">
              Fees pending
            </span>
            <span id="student-fees-help" className={helpClass}>
              Adds the fee line to this student&apos;s next update.
            </span>
          </span>
        </div>
      )}

      {error && <Banner variant="flag">{error}</Banner>}

      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          stickyKeys && "sticky bottom-0 z-10 -mx-4 border-t-2 border-hairline bg-paper px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0",
        )}
      >
        {student ? (
          <>
            <Key variant="secondary" className="flex-1 sm:flex-none" onClick={onCancel} disabled={pending}>
              Cancel
            </Key>
            <Key type="submit" className="flex-[2] sm:flex-none sm:px-8" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Key>
          </>
        ) : (
          <>
            <Key type="submit" className="w-full sm:w-auto sm:px-8" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Key>
            <Key variant="secondary" className="flex-1 px-3.5 sm:flex-none sm:px-[22px]" onClick={() => save(true)} disabled={pending}>
              Save and add another
            </Key>
            <Key variant="text" className="px-2" onClick={onCancel} disabled={pending}>
              Cancel
            </Key>
          </>
        )}
      </div>
    </form>
  );
}
