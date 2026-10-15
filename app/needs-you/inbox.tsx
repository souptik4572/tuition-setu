"use client";

import { ArrowRight, ChevronRight, CircleHelp, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Key } from "@/components/ts/key";
import { useToast } from "@/components/ts/toast";
import type { MatchedItem, NeedsYouItem } from "@/lib/pipeline/needs-you";
import { cn } from "@/lib/utils";
import { undoResolve } from "./actions";

/** The icon tile for an item: a question for things to answer, a page for a note that couldn't be read. */
export function ItemIcon({ type, className }: { type: NeedsYouItem["type"]; className?: string }) {
  const Icon = type === "failed_note" ? FileQuestion : CircleHelp;
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", type === "failed_note" ? "bg-hairline text-ink" : "bg-orange-tint text-on-highlight", className)}>
      <Icon className="size-[22px]" strokeWidth={2.4} />
    </span>
  );
}

/** "3 TO CHECK" / "2 LEFT" (M2, N1). */
export function CountChip({ n, word }: { n: number; word: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-highlight px-2.5 text-[13px] font-extrabold tracking-[0.6px] text-on-highlight uppercase">
      <CircleHelp aria-hidden className="size-4" strokeWidth={2.4} />
      {n} {word}
    </span>
  );
}

/** Items as rows of a card: the dashboard's Needs you card and the inbox (M2, D2, N-Desktop). */
export function ItemRows({ items, selectedId }: { items: NeedsYouItem[]; selectedId?: string }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id} className="border-t-2 border-hairline first:border-t-0">
            <Link
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={cn("flex min-h-[64px] items-center gap-3 px-4 py-3 no-underline", selected ? "bg-sky-tint" : "hover:bg-field")}
            >
              <ItemIcon type={item.type} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] leading-snug font-extrabold text-ink-strong">{item.title}</span>
                <span className="text-sm break-words text-muted-foreground">{item.hint}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** "Matched for you" (N4-Related): auto-matched spellings with Undo; they don't count as items. */
export function MatchedList({ matched }: { matched: MatchedItem[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  if (!matched.length) return null;
  return (
    <section aria-labelledby="matched-title" className="flex flex-col gap-2.5 rounded-lg border-2 border-hairline p-4">
      <h2 id="matched-title" className="text-sm font-extrabold tracking-[0.8px] text-ink-strong uppercase">
        Matched for you
      </h2>
      <ul className="flex flex-col gap-2">
        {matched.map((m) => (
          <li key={m.entryId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-sm bg-sky-tint px-2.5 text-[15px] font-extrabold text-on-sky-tint">
              ‘{m.asWritten}’
              <ArrowRight aria-label="matched to" className="size-4" strokeWidth={2.6} />
              {m.studentName}
            </span>
            <span className="text-xs font-extrabold tracking-[0.6px] text-ocean uppercase">Auto-matched</span>
            <Key
              variant="text"
              size="small"
              className="ml-auto"
              disabled={pending}
              aria-label={`Undo match of ${m.asWritten} to ${m.studentName}`}
              onClick={() =>
                startTransition(async () => {
                  const result = await undoResolve(m.entryId).catch(() => null);
                  toast({ text: result?.ok ? `‘${m.asWritten}’ is back in Needs you` : "TuitionSetu couldn't undo that. Try again." });
                })
              }
            >
              Undo
            </Key>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">A spelling of a name on your list. Nothing to do.</p>
    </section>
  );
}

