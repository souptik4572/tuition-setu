"use client";

import { ChevronRight, Plus, RotateCcw, Search, Users } from "lucide-react";
import Link from "next/link";
import { Tabs } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Banner } from "@/components/ts/banner";
import { inputClass } from "@/components/ts/field";
import { Key, KeyLink } from "@/components/ts/key";
import { StatusChip } from "@/components/ts/status-chip";
import { Toast, type ToastMessage } from "@/components/ts/toast";
import { LANGUAGE_LABEL } from "@/lib/schemas/common";
import { normalizeName } from "@/lib/util/text";
import { cn } from "@/lib/utils";
import { archiveStudent, restoreStudent } from "./actions";
import type { ArchivedRow, RosterRow } from "./data";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const nicknameLine = (nicknames: string[]) => `also ${nicknames.map((n) => `‘${n}’`).join(", ")}`;

const tile = "flex size-11 shrink-0 items-center justify-center rounded-md bg-sky-tint text-lg font-extrabold text-ocean";

const tabClass =
  "inline-flex h-11 cursor-pointer items-center rounded-[10px] border-2 border-transparent px-4 text-base font-extrabold text-ink-strong data-[state=active]:border-hairline data-[state=active]:bg-surface data-[state=active]:text-ocean";

function matches(row: { fullName: string; nicknames?: string[] }, query: string) {
  const q = normalizeName(query);
  return !q || [row.fullName, ...(row.nicknames ?? [])].some((name) => normalizeName(name).includes(q));
}

/**
 * The roster (D4-Profile, R4-Archived, States 1): a table on the laptop, a list on phones, search
 * by name or nickname, and Active / Archived. With a `panel` (a profile), the laptop shows it beside
 * the table and phones show only the panel.
 */
export function Roster({
  active,
  archived,
  canEdit,
  selectedId,
  startOn = "active",
  panel,
}: {
  active: RosterRow[];
  archived: ArchivedRow[];
  canEdit: boolean;
  selectedId?: string;
  startOn?: "active" | "archived";
  panel?: ReactNode;
}) {
  const [tab, setTab] = useState(startOn);
  // Archiving or restoring the open student moves the list to the tab they're now on.
  const [shownFor, setShownFor] = useState(startOn);
  if (startOn !== shownFor) {
    setShownFor(startOn);
    setTab(startOn);
  }
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const batches = new Set(active.map((s) => s.batch).filter(Boolean)).size;
  const shown = active.filter((s) => matches(s, query));
  const shownArchived = archived.filter((s) => matches(s, query));

  const restore = (row: ArchivedRow) =>
    startTransition(async () => {
      setError(null);
      const result = await restoreStudent(row.id).catch(() => null);
      if (!result?.ok) return setError(result?.error.message ?? "TuitionSetu couldn't restore that. Check that it's still running on the laptop, then try again.");
      setToast({ text: `${row.fullName} restored`, undo: () => void archiveStudent(row.id) });
    });

  const noMatch = (
    <p className="rounded-md bg-field px-4 py-6 text-center text-base text-muted-foreground">
      No students match “{query.trim()}”.
    </p>
  );

  return (
    <div className="mx-auto flex w-full max-w-332 flex-col gap-6 px-4 pt-6 lg:px-6 lg:pt-8">
      <header className={cn("flex flex-wrap items-start justify-between gap-4", panel && "hidden lg:flex")}>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[40px] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong lg:text-5xl lg:tracking-[-1.2px]">Students</h1>
          {active.length > 0 && (
            <p className="hidden text-[17px] text-muted-foreground lg:block">
              {plural(active.length, "student", "students")}
              {batches > 0 && ` · ${plural(batches, "batch", "batches")}`}
            </p>
          )}
        </div>
        {canEdit && (
          <>
            <KeyLink href="/students/new" size="icon" aria-label="Add a student" className="lg:hidden">
              <Plus aria-hidden strokeWidth={2.6} />
            </KeyLink>
            <KeyLink href="/students/new" className="hidden lg:inline-flex">
              <Plus aria-hidden strokeWidth={2.6} />
              Add a student
            </KeyLink>
          </>
        )}
      </header>

      <div className={cn("flex flex-col gap-8", panel && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,480px)] lg:items-start")}>
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)} className={cn("flex min-w-0 flex-col gap-4", panel && "hidden lg:flex")}>
          {active.length + archived.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative block min-w-0 flex-[1_1_260px]">
                <label htmlFor="roster-search" className="sr-only">
                  Search students
                </label>
                <Search aria-hidden className="pointer-events-none absolute top-4 left-3.5 size-5 text-muted-foreground" strokeWidth={2.4} />
                <input
                  id="roster-search"
                  type="search"
                  autoComplete="off"
                  value={query}
                  placeholder="Search by name or nickname"
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(inputClass(), "pl-11")}
                />
              </span>
              <Tabs.List aria-label="Show" className="inline-flex gap-1 rounded-md bg-field p-1">
                <Tabs.Trigger value="active" className={tabClass}>
                  Active ({active.length})
                </Tabs.Trigger>
                <Tabs.Trigger value="archived" className={tabClass}>
                  Archived ({archived.length})
                </Tabs.Trigger>
              </Tabs.List>
            </div>
          )}

          {error && <Banner variant="flag">{error}</Banner>}

          <Tabs.Content value="active" className="flex flex-col gap-4">
            {active.length === 0 ? (
              <section aria-labelledby="roster-empty" className="flex flex-col items-center gap-3 rounded-lg bg-field px-6 py-10 text-center">
                <span aria-hidden className="flex size-18 items-center justify-center rounded-lg bg-sky-tint text-ocean">
                  <Users className="size-9" strokeWidth={2.2} />
                </span>
                <h2 id="roster-empty" className="text-[22px] font-extrabold text-ink-strong">
                  No students yet
                </h2>
                <p className="max-w-100 text-base leading-normal text-muted-foreground">Add the children you teach. Their names stay on your machine.</p>
                {canEdit && (
                  <KeyLink href="/students/new" className="mt-2">
                    <Plus aria-hidden strokeWidth={2.6} />
                    Add a student
                  </KeyLink>
                )}
              </section>
            ) : shown.length === 0 ? (
              noMatch
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-lg border-2 border-b-4 border-hairline lg:block">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-field text-sm font-extrabold tracking-[0.6px] text-muted-foreground uppercase">
                      <tr>
                        {["Name", "Class", "Batch", "Messages in", "This week"].map((h) => (
                          <th key={h} scope="col" className="px-4 py-3.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((s) => {
                        const selected = s.id === selectedId;
                        return (
                          <tr key={s.id} className={cn("relative border-t-2 border-hairline", selected ? "bg-sky-tint" : "hover:bg-field")}>
                            <td className="px-4 py-3.5">
                              {/* The link covers the whole row, so any cell opens the profile. */}
                              <Link
                                href={`/students/${s.id}`}
                                aria-current={selected ? "page" : undefined}
                                className={cn("text-[17px] font-extrabold no-underline after:absolute after:inset-0", selected ? "text-ocean" : "text-ink-strong")}
                              >
                                {s.fullName}
                              </Link>
                              {s.nicknames.length > 0 && <span className={cn("block text-sm", selected ? "text-ocean" : "text-muted-foreground")}>{nicknameLine(s.nicknames)}</span>}
                            </td>
                            <td className="px-4 py-3.5 text-[17px]">{s.classGrade}</td>
                            <td className="px-4 py-3.5 text-[17px]">{s.batch ?? <span aria-label="No batch">—</span>}</td>
                            <td lang={s.language} className="px-4 py-3.5 text-[17px]">
                              {LANGUAGE_LABEL[s.language]}
                            </td>
                            <td className="px-4 py-3.5">{s.week === "no_notes" ? <span className="text-base text-muted-foreground">No notes yet</span> : <StatusChip status={s.week} />}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="flex flex-col gap-2.5 lg:hidden">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <Link href={`/students/${s.id}`} className="flex min-h-18 items-center gap-3.5 rounded-lg border-2 border-hairline bg-surface px-4 py-3 no-underline">
                        <span aria-hidden className={tile}>
                          {s.fullName.trim()[0]?.toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[17px] font-extrabold text-ink-strong">{s.fullName}</span>
                          <span className="text-[15px] text-muted-foreground">
                            Class {s.classGrade}
                            {s.batch && ` · ${s.batch}`}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tabs.Content>

          <Tabs.Content value="archived" className="flex flex-col gap-4">
            {archived.length === 0 ? (
              <p className="rounded-md bg-field px-4 py-6 text-center text-base text-muted-foreground">No archived students.</p>
            ) : shownArchived.length === 0 ? (
              noMatch
            ) : (
              <ul className="flex flex-col gap-2.5">
                {shownArchived.map((s) => (
                  <li key={s.id} className={cn("flex flex-wrap items-center gap-3.5 rounded-lg border-2 border-hairline px-4 py-3", s.id === selectedId ? "bg-sky-tint" : "bg-surface")}>
                    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-hairline text-lg font-extrabold text-muted-foreground">
                      {s.fullName.trim()[0]?.toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-[1_1_160px] flex-col">
                      <Link href={`/students/${s.id}`} aria-current={s.id === selectedId ? "page" : undefined} className="text-[17px] font-extrabold text-ink-strong no-underline">
                        {s.fullName}
                      </Link>
                      <span className="text-[15px] text-muted-foreground">
                        Class {s.classGrade} · Archived {s.archivedOn}
                      </span>
                      <span className="text-[15px] text-muted-foreground">{s.weeks === 0 ? "No history yet" : `${plural(s.weeks, "week", "weeks")} of history kept`}</span>
                    </span>
                    {canEdit && (
                      <Key variant="secondary" size="small" disabled={pending} onClick={() => restore(s)} aria-label={`Restore ${s.fullName}`}>
                        <RotateCcw aria-hidden strokeWidth={2.6} />
                        Restore
                      </Key>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[15px] leading-normal text-muted-foreground">
              Archived students don&apos;t appear in weekly reviews. Their notes, scores and messages stay here until you restore or delete them.
            </p>
          </Tabs.Content>
        </Tabs.Root>

        {panel}
      </div>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
