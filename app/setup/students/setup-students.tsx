"use client";

import { Check, Pencil, Plus, Users } from "lucide-react";
import { useState } from "react";
import { KeyLink, Key } from "@/components/ts/key";
import { SetupAside, SetupColumns, setupCard } from "@/components/ts/setup-frame";
import { StudentForm } from "@/app/students/student-form";
import type { Student } from "@/lib/db/queries/students";
import { LANGUAGE_LABEL, type Language } from "@/lib/schemas/common";
import { formatPhone } from "@/lib/util/phone";
import { cn } from "@/lib/utils";

const title = "font-display text-[clamp(32px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong";

/**
 * B5: add students one at a time with the running list above the form (G3-Growing), or skip
 * (G3-Empty). Pasting a list comes with M18.
 */
export function SetupStudents({
  students,
  subjects,
  defaultLanguage,
  feeReminders,
}: {
  students: Student[];
  subjects: string[];
  defaultLanguage: Language;
  feeReminders: boolean;
}) {
  // "add", the id of the student being edited, or null when the form is closed.
  const [form, setForm] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const editing = students.find((s) => s.id === form);

  if (students.length === 0 && form === null) {
    return (
      <SetupColumns>
        <section aria-labelledby="students-title" className={setupCard}>
          <div className="flex flex-col gap-2">
            <h1 id="students-title" className={title}>
              Add your students
            </h1>
            <p className="max-w-[620px] text-[17px] leading-normal text-muted-foreground">
              Each needs a name, class, a parent&apos;s WhatsApp number and a message language. Everything else can wait.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg bg-field px-6 py-10 text-center">
            <span aria-hidden className="flex size-[72px] items-center justify-center rounded-lg bg-sky-tint text-ocean">
              <Users className="size-9" strokeWidth={2.2} />
            </span>
            <h2 className="text-[22px] font-extrabold text-ink-strong">No students yet</h2>
            <p className="max-w-[400px] text-base leading-normal text-muted-foreground">Start with one — it takes about a minute. You can add more any time from Students.</p>
            <Key className="mt-2" onClick={() => setForm("add")}>
              <Plus aria-hidden strokeWidth={2.6} />
              Add a student
            </Key>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <KeyLink href="/setup/ai" variant="secondary">
              Back
            </KeyLink>
            <KeyLink href="/" variant="text" className="normal-case tracking-normal text-base">
              I&apos;ll add students later
            </KeyLink>
          </div>
        </section>
        <SetupAside label="Have these handy">
          <h2 className="text-xl font-extrabold text-ink-strong">Have these handy</h2>
          <ul className="flex flex-col gap-3 text-base leading-normal">
            {["Each child's full name and class", "The parent's WhatsApp number", "The language the parent reads most easily"].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
                {line}
              </li>
            ))}
          </ul>
        </SetupAside>
      </SetupColumns>
    );
  }

  return (
    <section aria-labelledby="students-title" className={cn(setupCard, "w-full")}>
      <div className="flex flex-col gap-2">
        <h1 id="students-title" className={title}>
          Add your students
        </h1>
        <p className="text-[17px] leading-normal text-muted-foreground">
          Fields marked <span className="font-extrabold text-danger">*</span> are needed for updates. Everything else can wait.
        </p>
      </div>

      {students.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold tracking-[0.8px] text-ink-strong uppercase">
            Added so far
            <span className="inline-flex h-7 items-center gap-1 rounded-sm bg-sky-tint px-2 text-[13px] text-on-sky-tint">
              <Check aria-hidden className="size-3.5" strokeWidth={3} />
              {students.length} added
            </span>
          </h2>
          <ul className="flex flex-col rounded-lg border-2 border-hairline">
            {students.map((s, i) => (
              <li key={s.id} className={cn("flex items-center gap-3.5 px-4 py-3", i > 0 && "border-t-2 border-hairline", s.id === form && "bg-sky-tint")}>
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-sky-tint text-lg font-extrabold text-ocean">
                  {s.fullName.trim()[0]?.toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] font-extrabold text-ink-strong">{s.fullName}</span>
                    {s.id === justAdded && (
                      <span className="rounded-sm border-2 border-sky px-1.5 text-xs font-extrabold tracking-[0.6px] text-ocean uppercase">Just added</span>
                    )}
                  </span>
                  <span className="text-[15px] text-muted-foreground">
                    Class {s.classGrade} · {s.batch ?? "No batch yet"} · {formatPhone(s.parentPhone)}
                  </span>
                </span>
                <span lang={s.parentLanguage} className="hidden h-8 shrink-0 items-center rounded-sm border-2 border-hairline px-2.5 text-[15px] font-extrabold text-ink-strong sm:inline-flex">
                  {LANGUAGE_LABEL[s.parentLanguage]}
                </span>
                <button
                  type="button"
                  aria-label={`Edit ${s.fullName}`}
                  onClick={() => setForm(s.id)}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ocean"
                >
                  <Pencil aria-hidden className="size-5" strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {form === null ? (
        <Key variant="secondary" className="self-start" onClick={() => setForm("add")}>
          <Plus aria-hidden strokeWidth={2.6} />
          Add another student
        </Key>
      ) : (
        <div className="rounded-lg border-2 border-sky p-[clamp(16px,3vw,24px)]">
          <StudentForm
            key={form}
            student={editing}
            heading={<h2 className="text-xl font-extrabold text-ink-strong">{editing ? `Edit ${editing.fullName}` : `Student ${students.length + 1}`}</h2>}
            batches={[...new Set(students.map((s) => s.batch).filter((b): b is string => !!b))]}
            subjects={subjects}
            others={students.filter((s) => s.id !== editing?.id)}
            defaultLanguage={defaultLanguage}
            feeReminders={feeReminders}
            onSaved={({ id, another }) => {
              if (!editing) setJustAdded(id);
              if (!another) setForm(null);
            }}
            onCancel={() => setForm(null)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-hairline pt-6">
        <KeyLink href="/setup/ai" variant="secondary">
          Back
        </KeyLink>
        <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <span className="text-[15px] text-muted-foreground">You can add more from Students any time.</span>
          <KeyLink href="/" variant="secondary">
            {students.length > 0 ? "I'll add the rest later" : "I'll add students later"}
          </KeyLink>
        </span>
      </div>
    </section>
  );
}
