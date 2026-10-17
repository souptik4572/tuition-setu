"use client";

import { ArrowLeft, Check, CircleHelp, History, MessageCircle, Pencil, RefreshCw, SkipForward, Square, ThumbsUp, TriangleAlert, Undo2, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Banner } from "@/components/ts/banner";
import { helpClass, inputClass } from "@/components/ts/field";
import { Key, KeyLink } from "@/components/ts/key";
import { MessageBubble } from "@/components/ts/message-bubble";
import { Modal, ModalClose, modalIcon } from "@/components/ts/modal";
import { StatusChip } from "@/components/ts/status-chip";
import type { ActionResult } from "@/lib/auth/types";
import { LANGUAGE_LABEL, type Language } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import { approveDraft, completeCycle, dismissFlag, editDraft, markSent, restoreFlag, skipStudent, unapproveDraft, unskipStudent } from "../actions";
import type { ReviewDetail, ReviewRow } from "../data";

const UNREACHABLE = "TuitionSetu couldn't do that. Check that it's still running on the laptop, then try again.";
const LANGUAGE_NAME: Record<Language, string> = { en: "English", bn: "Bengali", hi: "Hindi" };
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
const list = (names: string[]) => (names.length > 3 ? `${names.length} students` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

type Review = {
  cycle: { id: string; status: string; range: string };
  rows: ReviewRow[];
  sent: number;
  skipped: number;
  notDone: string[];
  detail: ReviewDetail | null;
  chosen: boolean;
};

/** Reads one generate stream: the body as it's written, then the stored draft or an error (IMPL M9 route). */
async function streamDraft(cycleId: string, studentId: string, signal: AbortSignal, onText: (text: string) => void): Promise<string | null> {
  const res = await fetch("/api/drafts/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cycleId, studentId }), signal });
  if (res.status === 409) return "There's nothing new to write from. Add a note first.";
  if (!res.ok || !res.body) return UNREACHABLE;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let error: string | null = null;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    buffer += next.value;
    for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
      const event = JSON.parse(buffer.slice(0, nl)) as { type: string; text?: string; message?: string };
      buffer = buffer.slice(nl + 1);
      if (event.type === "token") onText(event.text ?? "");
      if (event.type === "error") error = event.message ?? UNREACHABLE;
    }
  }
  return error;
}

/**
 * The weekly review (D3 on the laptop; M6 → M7/M8 on phones): who's ready, each update with its
 * number check, and the way out to WhatsApp. Writing runs here, one student at a time (§S8).
 */
export function ReviewScreen({ review, canAct }: { review: Review; canAct: boolean }) {
  const router = useRouter();
  const { cycle, rows, detail } = review;
  const [writing, setWriting] = useState<{ studentId: string; text: string } | null>(null);
  const [writingAll, setWritingAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abort = useRef<AbortController | null>(null);
  const stopAll = useRef(false);
  const completed = cycle.status === "completed";
  const toWrite = rows.filter((r) => r.canWrite);

  const writeOne = async (studentId: string) => {
    const controller = new AbortController();
    abort.current = controller;
    setWriting({ studentId, text: "" });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([id]) => id !== studentId)));
    try {
      const error = await streamDraft(cycle.id, studentId, controller.signal, (text) => setWriting((w) => w && { ...w, text: w.text + text }));
      if (error) setErrors((e) => ({ ...e, [studentId]: error }));
    } catch {
      if (!controller.signal.aborted) setErrors((e) => ({ ...e, [studentId]: UNREACHABLE }));
    } finally {
      abort.current = null;
      setWriting(null);
      router.refresh();
    }
  };

  const writeAll = async () => {
    stopAll.current = false;
    setWritingAll(true);
    for (const row of toWrite) {
      if (stopAll.current) break;
      await writeOne(row.id);
    }
    setWritingAll(false);
  };

  const stop = () => {
    stopAll.current = true;
    abort.current?.abort();
  };

  const [completing, startCompleting] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);

  const total = rows.length;
  const busy = writing !== null;
  const headerKey = completed ? (
    <KeyLink href={`/cycles/${cycle.id}/done`} variant="secondary">
      See the week&apos;s summary
    </KeyLink>
  ) : !canAct ? null : busy ? (
    <Key variant="secondary" onClick={stop}>
      <Square aria-hidden strokeWidth={2.6} />
      Stop
    </Key>
  ) : toWrite.length ? (
    <Key onClick={writeAll}>
      <Pencil aria-hidden strokeWidth={2.4} />
      Write updates
    </Key>
  ) : (
    <span className="flex flex-col items-end gap-1">
      <Key
        disabled={review.notDone.length > 0 || completing}
        aria-describedby={review.notDone.length ? "complete-why" : undefined}
        onClick={() =>
          startCompleting(async () => {
            setCompleteError(null);
            const result = await completeCycle(cycle.id).catch(() => null);
            if (result && !result.ok) setCompleteError(result.error.message);
          })
        }
      >
        <Check aria-hidden strokeWidth={2.6} />
        {completing ? "Completing…" : "Complete week"}
      </Key>
      {review.notDone.length > 0 && (
        <span id="complete-why" className="text-sm text-muted-foreground">
          {list(review.notDone)} still {review.notDone.length === 1 ? "needs" : "need"} sending or skipping
        </span>
      )}
    </span>
  );

  // Phones show the list, or one student's update once chosen; the laptop shows both.
  const showDetail = review.chosen && !!detail;

  return (
    <div className="mx-auto flex w-full max-w-332 flex-col gap-6 px-4 pt-4 lg:px-6 lg:pt-8">
      <header className={cn("flex flex-wrap items-end justify-between gap-4", showDetail && "hidden lg:flex")}>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] leading-[1.1] font-extrabold tracking-[-0.8px] text-ink-strong lg:text-5xl lg:tracking-[-1.2px]">
            <span className="lg:hidden">Review this week</span>
            <span className="hidden lg:inline">Weekly review</span>
          </h1>
          <p className="text-[17px] text-muted-foreground">{cycle.range} · read each update, then send it yourself</p>
        </div>
        <div className="flex w-full flex-wrap items-end justify-between gap-4 lg:w-auto lg:flex-nowrap">
          <div className="flex min-w-50 flex-1 flex-col gap-1.5 lg:w-60 lg:flex-none">
            <span className="text-[15px] font-extrabold text-ink-strong">
              {review.sent} of {total} sent{review.skipped > 0 && <span className="font-semibold text-muted-foreground"> · {review.skipped} skipped</span>}
            </span>
            <span role="progressbar" aria-label="Updates sent" aria-valuemin={0} aria-valuemax={total} aria-valuenow={review.sent} className="flex h-2.5 overflow-hidden rounded-full bg-field">
              <span className="bg-sky" style={{ width: `${total ? (review.sent / total) * 100 : 0}%` }} />
              <span className="bg-hairline" style={{ width: `${total ? (review.skipped / total) * 100 : 0}%` }} />
            </span>
          </div>
          {headerKey}
        </div>
      </header>
      {completeError && <Banner variant="flag">{completeError}</Banner>}

      {rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg bg-field px-6 py-10 text-center">
          <h2 className="text-[22px] font-extrabold text-ink-strong">No students yet</h2>
          <p className="text-base text-muted-foreground">Add your students, then type a note after class.</p>
          <KeyLink href="/students/new">Add a student</KeyLink>
        </section>
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <section aria-labelledby="students-title" className={cn("flex-col overflow-hidden rounded-lg border-2 border-b-4 border-hairline", showDetail ? "hidden lg:flex" : "flex")}>
            <h2 id="students-title" className="px-4 pt-3.5 pb-2 text-sm font-extrabold tracking-[0.8px] text-ink-strong uppercase">
              Students · {rows.length}
            </h2>
            <ul>
              {rows.map((row) => {
                const selected = row.id === detail?.student.id;
                return (
                  <li key={row.id} className="border-t-2 border-hairline">
                    <Link
                      href={`/cycles/${cycle.id}?student=${row.id}`}
                      scroll={false}
                      aria-current={selected ? "page" : undefined}
                      className={cn("flex min-h-17 items-center gap-3 px-4 py-2.5 no-underline", selected ? "lg:bg-sky-tint" : "hover:bg-field")}
                    >
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md bg-field text-sm font-extrabold text-ink-strong">
                        {initials(row.fullName)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-base font-extrabold text-ink-strong">{row.fullName}</span>
                        <span className="text-sm text-muted-foreground">
                          Class {row.classGrade} · {LANGUAGE_NAME[row.language]}
                        </span>
                      </span>
                      {writing?.studentId === row.id ? (
                        <StatusChip status="writing" />
                      ) : row.chip === "no_notes" ? (
                        <span className="text-sm text-muted-foreground">No notes</span>
                      ) : (
                        <StatusChip status={row.chip} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className={cn("min-w-0 flex-col gap-5", showDetail ? "flex" : "hidden lg:flex")}>
            {detail && (
              <StudentUpdate
                key={detail.student.id}
                cycleId={cycle.id}
                detail={detail}
                completed={completed}
                canAct={canAct}
                writing={writing?.studentId === detail.student.id ? writing.text : null}
                busy={busy}
                error={errors[detail.student.id] ?? null}
                onWrite={() => writeOne(detail.student.id)}
                onStop={stop}
              />
            )}
          </div>
        </div>
      )}
      {writingAll && <p className="sr-only" role="status">Writing updates one at a time…</p>}
    </div>
  );
}

function Panel({ title, sub, children, aside }: { title: ReactNode; sub?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold text-ink-strong">{title}</h2>
          {sub && <span className="text-[15px] text-muted-foreground">{sub}</span>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** One student's update with the actions its state allows (IMPL M10 actions table, trimmed). */
function StudentUpdate({
  cycleId,
  detail,
  completed,
  canAct,
  writing,
  busy,
  error,
  onWrite,
  onStop,
}: {
  cycleId: string;
  detail: ReviewDetail;
  completed: boolean;
  canAct: boolean;
  writing: string | null;
  busy: boolean;
  error: string | null;
  onWrite: () => void;
  onStop: () => void;
}) {
  const { student, draft } = detail;
  const name = student.messageName;
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState<"override" | "rewrite" | null>(null);
  const [sentPrompt, setSentPrompt] = useState(false);

  const run = (action: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    startTransition(async () => {
      setActionError(null);
      const result = await action().catch(() => null);
      if (!result?.ok) return setActionError(result?.error.message ?? UNREACHABLE);
      after?.();
    });

  const openWhatsApp = () => {
    if (!draft) return;
    window.open(`https://wa.me/${student.phone}?text=${encodeURIComponent(draft.message)}`, "_blank", "noopener");
    setSentPrompt(true);
  };

  const parent = student.parentName ?? `${name}'s parent`;
  const issues = draft?.guard?.issues ?? [];
  const blocking = issues.filter((i) => i.severity !== "warning");
  const warnings = issues.filter((i) => i.severity === "warning");
  const status = draft?.status;
  const act = canAct && !completed;
  const disabled = pending || busy;

  let banner: ReactNode = null;
  if (writing !== null) banner = null;
  else if (error) banner = <Banner variant="flag">{`Couldn't write ${name}'s update. ${error}`}</Banner>;
  else if (status === "ready" && draft?.override)
    banner = (
      <Banner
        variant="success"
        icon={UserCheck}
        action={
          act && (
            <Key variant="text" size="small" className="-my-2" onClick={() => run(() => restoreFlag(draft.id))} disabled={disabled}>
              Undo
            </Key>
          )
        }
      >
        Warning dismissed — you checked it yourself
      </Banner>
    );
  else if (status === "ready") banner = <Banner variant="success">Checked — every number matches your notes</Banner>;
  else if (status === "flagged")
    banner = (
      <Banner
        variant="flag"
        action={
          act &&
          draft && (
            <button
              type="button"
              aria-label="Dismiss warning"
              title="Dismiss warning"
              onClick={() => run(() => dismissFlag(draft.id))}
              disabled={disabled}
              className="-my-2 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center self-start rounded-md hover:bg-highlight disabled:cursor-default disabled:opacity-50"
            >
              <X aria-hidden className="size-5" strokeWidth={2.6} />
            </button>
          )
        }
      >
        <span className="flex flex-col gap-0.5">
          {blocking.map((i, n) => (
            <span key={n}>{i.message}</span>
          ))}
          <span className="font-semibold">{act ? "Edit the message yourself, or dismiss this if it's right." : "Fix it, or edit the message yourself."}</span>
        </span>
      </Banner>
    );
  else if (status === "stale")
    banner = (
      <Banner variant="caution" icon={History}>
        <span className="flex flex-col gap-0.5">
          <span>Out of date — a new note about {name} was saved after this update was written.</span>
          <span className="font-semibold">Write it again to include it. Nothing you typed is lost.</span>
        </span>
      </Banner>
    );
  else if (status === "approved")
    banner = (
      <Banner variant="success" icon={ThumbsUp}>
        Approved · WhatsApp opens with this message ready. You press Send there.
      </Banner>
    );
  else if (status === "sent") banner = <Banner variant="success">Sent {draft?.sentAt}</Banner>;
  else if (status === "skipped") banner = <Banner variant="caution" icon={SkipForward}>{`Skipped this week. ${student.parentName ?? "The parent"} won't get a message.`}</Banner>;

  const messageKeys = (() => {
    if (!act || writing !== null) return null;
    if (!draft || (status === "skipped" && !draft.body)) {
      if (status === "skipped")
        return (
          <Key variant="secondary" onClick={() => run(() => unskipStudent(cycleId, student.id))} disabled={disabled}>
            <Undo2 aria-hidden strokeWidth={2.4} />
            Undo skip
          </Key>
        );
      return (
        <div className="flex flex-wrap gap-3">
          {detail.hasNotes && (
            <Key size="big" className="flex-2" onClick={onWrite} disabled={disabled}>
              <Pencil aria-hidden strokeWidth={2.4} />
              {error ? "Try again" : `Write ${name}'s update`}
            </Key>
          )}
          <Key variant="secondary" size="big" className="flex-1" onClick={() => run(() => skipStudent(cycleId, student.id))} disabled={disabled}>
            <SkipForward aria-hidden strokeWidth={2.4} />
            Skip this week
          </Key>
        </div>
      );
    }
    if (editing) return null;
    if (status === "sent") return null;
    if (status === "skipped")
      return (
        <Key variant="secondary" onClick={() => run(() => unskipStudent(cycleId, student.id))} disabled={disabled}>
          <Undo2 aria-hidden strokeWidth={2.4} />
          Undo skip
        </Key>
      );
    if (status === "approved")
      return (
        <div className="flex flex-wrap gap-3">
          <Key variant="secondary" size="big" className="flex-1" onClick={() => run(() => unapproveDraft(draft.id))} disabled={disabled}>
            <Undo2 aria-hidden strokeWidth={2.4} />
            Undo
          </Key>
          <Key variant="whatsapp" size="big" className="flex-3" onClick={openWhatsApp} disabled={disabled}>
            <MessageCircle aria-hidden strokeWidth={2.4} />
            Send on WhatsApp
          </Key>
        </div>
      );
    const rewrite = () => (draft.edited ? setConfirm("rewrite") : onWrite());
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2.5">
          <Key
            variant="secondary"
            size="small"
            onClick={() => {
              // The draft may have been written after this panel opened, so start from its text now.
              setText(draft.body);
              setEditing(true);
            }}
            disabled={disabled}
          >
            <Pencil aria-hidden strokeWidth={2.4} />
            Edit
          </Key>
          <Key variant="secondary" size="small" onClick={rewrite} disabled={disabled}>
            <RefreshCw aria-hidden strokeWidth={2.4} />
            {status === "stale" ? "Write again" : "Rewrite"}
          </Key>
          <Key variant="secondary" size="small" onClick={() => run(() => skipStudent(cycleId, student.id))} disabled={disabled}>
            <SkipForward aria-hidden strokeWidth={2.4} />
            Skip
          </Key>
        </div>
        {status === "ready" && (
          <Key size="big" onClick={() => run(() => approveDraft(draft.id, { override: false }))} disabled={disabled}>
            <Check aria-hidden strokeWidth={2.6} />
            {pending ? "Approving…" : "Approve"}
          </Key>
        )}
        {status === "flagged" && (
          <Key variant="secondary" size="big" onClick={() => setConfirm("override")} disabled={disabled}>
            <TriangleAlert aria-hidden strokeWidth={2.4} />
            Send anyway…
          </Key>
        )}
        {status === "stale" && <span className={helpClass}>Approve is off until the update matches your notes.</span>}
      </div>
    );
  })();

  return (
    <>
      <header className="flex min-h-12 items-center gap-2 lg:hidden">
        <Link href={`/cycles/${cycleId}`} aria-label="Back to Review" className="-ml-2 flex size-12 items-center justify-center rounded-md text-ink-strong">
          <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="flex-1 text-xl font-extrabold text-ink-strong">{name}&apos;s update</h1>
        {writing !== null ? <StatusChip status="writing" /> : detail.chip !== "no_notes" && <StatusChip status={detail.chip} />}
      </header>

      <Panel
        title={<span className="hidden lg:inline">{name}&apos;s update</span>}
        sub={
          <>
            To <strong className="font-extrabold text-ink-strong">{parent}</strong> on WhatsApp · <span lang={student.language}>{LANGUAGE_LABEL[student.language]}</span>
          </>
        }
        aside={writing === null && detail.chip !== "no_notes" ? <span className="hidden lg:block"><StatusChip status={detail.chip} /></span> : undefined}
      >
        {writing !== null ? (
          <>
            <p role="status" className="flex items-center gap-2 text-base font-extrabold text-ocean">
              Writing {name}&apos;s update…
            </p>
            <MessageBubble header={`To ${parent}`} message={writing || " "} language={student.language} streaming />
            <span className={helpClass}>Numbers are checked against your notes as soon as it finishes.</span>
            <Key variant="secondary" onClick={onStop}>
              <Square aria-hidden strokeWidth={2.6} />
              Stop
            </Key>
          </>
        ) : editing && draft ? (
          <div className="flex flex-col gap-3">
            <label htmlFor="edit-body" className="text-base font-extrabold text-ink-strong">
              The message, between the greeting and your sign-off
            </label>
            <textarea id="edit-body" lang={student.language} value={text} onChange={(e) => setText(e.target.value)} rows={9} className={cn(inputClass(), "h-auto py-3 text-[17px] leading-normal")} />
            <span className={helpClass}>Numbers are checked again when you save.</span>
            <div className="flex flex-wrap gap-3">
              <Key variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Key>
              <Key onClick={() => run(() => editDraft(draft.id, text), () => setEditing(false))} disabled={pending || !text.trim()}>
                {pending ? "Saving…" : "Save"}
              </Key>
            </div>
          </div>
        ) : draft && draft.message ? (
          <MessageBubble
            header={`To ${parent}`}
            message={draft.message}
            language={student.language}
            bodyOffset={draft.bodyOffset}
            highlights={draft.override ? undefined : issues.filter((i) => i.end > i.start && i.severity !== "warning").map((i) => ({ start: i.start, end: i.end, label: i.message }))}
          />
        ) : (
          <p className="rounded-md bg-field px-4 py-5 text-base leading-normal text-muted-foreground">
            {status === "skipped"
              ? `${name} is skipped this week.`
              : detail.hasNotes
                ? `Ready to write ${name}'s update from this week's notes.`
                : detail.waiting
                  ? `Something about ${name} is waiting in Needs you. Answer it, then write the update.`
                  : `No notes about ${name} this week. Type a note, or skip this week — ${student.parentName ?? "the parent"} won't get a message.`}
          </p>
        )}

        {banner}
        {warnings.length > 0 && writing === null && !editing && (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CircleHelp aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
                {w.message}
              </li>
            ))}
          </ul>
        )}
        {detail.waiting > 0 && writing === null && (
          <KeyLink href="/needs-you" variant="text" className="self-start">
            {detail.waiting === 1 ? "1 thing" : `${detail.waiting} things`} about {name} in Needs you
          </KeyLink>
        )}
        {actionError && <Banner variant="flag">{actionError}</Banner>}
        {!canAct && <p className={helpClass}>Only owners and teachers can approve updates.</p>}
        <div className="sticky bottom-0 -mx-4 bg-paper px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-transparent sm:p-0">{messageKeys}</div>
      </Panel>

      {detail.facts && (detail.facts.assessments.length > 0 || detail.sources.length > 0) && (
        <Panel title="What I used" sub={detail.sources[0] ? `${student.fullName} · from your note on ${detail.sources[0].day}` : undefined}>
          {detail.sources.map((s, i) => (
            <blockquote key={i} className="rounded-md bg-field px-4 py-3 text-base leading-normal wrap-break-word">
              “{s.quote}”
            </blockquote>
          ))}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            {detail.facts.assessments.map((a, i) => (
              <div key={i} className="contents">
                <dt className="text-muted-foreground">{a.label}</dt>
                <dd className="font-extrabold text-ink-strong">
                  {a.scored}/{a.max} · {a.pct}%
                </dd>
              </div>
            ))}
            {detail.facts.trendBasis && (
              <div className="contents">
                <dt className="text-muted-foreground">Recent average</dt>
                <dd className="font-extrabold text-ink-strong">{detail.facts.trendBasis.previousAvgPct}%</dd>
              </div>
            )}
            {detail.facts.homework && (
              <div className="contents">
                <dt className="text-muted-foreground">Homework missed</dt>
                <dd className="font-extrabold text-ink-strong">{detail.facts.homework.missed}</dd>
              </div>
            )}
            {detail.facts.topics.length > 0 && (
              <div className="contents">
                <dt className="text-muted-foreground">Topics</dt>
                <dd className="font-extrabold text-ink-strong">{detail.facts.topics.join(", ")}</dd>
              </div>
            )}
          </dl>
        </Panel>
      )}

      <Modal
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "override" ? "Send anyway?" : "Write it again?"}
        icon={
          <span aria-hidden className={modalIcon("plain")}>
            {confirm === "override" ? <TriangleAlert strokeWidth={2.4} /> : <RefreshCw strokeWidth={2.4} />}
          </span>
        }
      >
        <p className="text-[17px] leading-normal text-muted-foreground">
          {confirm === "override"
            ? `${blocking[0]?.message ?? "Something here doesn't match your notes"}. Approve ${name}'s update as it is? This is noted against the update.`
            : `You edited this update. Writing it again will replace your edits.`}
        </p>
        <div className="flex flex-col gap-3">
          <Key
            size="big"
            onClick={() => {
              const which = confirm;
              setConfirm(null);
              if (which === "override" && draft) run(() => approveDraft(draft.id, { override: true }));
              else onWrite();
            }}
          >
            {confirm === "override" ? "Send anyway" : "Write again"}
          </Key>
          <ModalClose asChild>
            <Key variant="secondary" size="big">
              Go back
            </Key>
          </ModalClose>
        </div>
      </Modal>

      <Modal
        open={sentPrompt}
        onOpenChange={setSentPrompt}
        sheet
        title="Did you send it?"
        icon={
          <span aria-hidden className={modalIcon("plain")}>
            <MessageCircle strokeWidth={2.4} />
          </span>
        }
      >
        <p className="text-[17px] leading-normal text-muted-foreground">
          WhatsApp opened with {name}&apos;s update for {parent}. I can&apos;t see WhatsApp, so I&apos;m asking before I mark it sent.
        </p>
        <div className="flex flex-col gap-3">
          <Key size="big" disabled={pending} onClick={() => draft && run(() => markSent(draft.id), () => setSentPrompt(false))}>
            <Check aria-hidden strokeWidth={2.6} />
            Yes, I sent it
          </Key>
          <ModalClose asChild>
            <Key variant="secondary" size="big">
              Not yet
            </Key>
          </ModalClose>
          <Key variant="text" className="self-center" onClick={openWhatsApp}>
            Open WhatsApp again
          </Key>
        </div>
      </Modal>
    </>
  );
}
