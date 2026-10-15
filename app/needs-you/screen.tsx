import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { KeyLink } from "@/components/ts/key";
import { requirePageMember } from "@/lib/auth/require-member";
import { ROLE_RANK } from "@/lib/auth/types";
import { getOwnerName } from "@/lib/db/queries/members";
import { loadNeedsYou } from "@/lib/pipeline/needs-you";
import { cn } from "@/lib/utils";
import { loadShell } from "../shell";
import { CountChip, ItemRows, MatchedList } from "./inbox";
import { ItemDetail } from "./item";

/**
 * N-Desktop: the waiting list beside the open item. Phones show the list on /needs-you and one
 * item, with "Also waiting" under it, on /needs-you/[id]. An item that has just been answered
 * sends you on to the next one.
 */
export async function NeedsYouScreen({ selectedId }: { selectedId?: string }) {
  const ctx = await requirePageMember();
  const { workspace, shell } = await loadShell(ctx);
  const inbox = await loadNeedsYou(ctx);
  const answerable = inbox.items.filter((i) => i.type !== "failed_note");
  const selected = selectedId ? inbox.items.find((i) => i.id === selectedId) : undefined;
  if (selectedId && !selected) redirect(answerable[0]?.href ?? "/needs-you");
  const open = selected ?? answerable[0];
  const ownerName = ctx.role === "owner" ? null : await getOwnerName(ctx);
  const n = inbox.items.length;

  return (
    <AppShell {...shell}>
      <div className="mx-auto flex w-full max-w-[1328px] flex-col gap-6 px-4 pt-4 lg:px-6 lg:pt-8">
        <header className={cn("flex flex-col gap-1", selected && "hidden lg:flex")}>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[40px] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong lg:text-5xl lg:tracking-[-1.2px]">Needs you</h1>
            {n > 0 && <CountChip n={n} word="to check" />}
          </div>
          <p className="text-[17px] text-muted-foreground">Things in your notes I couldn&apos;t place. Nothing is sent until you decide.</p>
        </header>
        {selected && (
          <header className="flex min-h-12 items-center gap-2 lg:hidden">
            <Link href="/" aria-label="Back to Home" className="-ml-2 flex size-12 items-center justify-center rounded-md text-ink-strong">
              <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
            </Link>
            <h1 className="flex-1 text-xl font-extrabold text-ink-strong">Needs you</h1>
            <CountChip n={n} word="left" />
          </header>
        )}

        {n === 0 ? (
          <div className="flex flex-col gap-6 lg:max-w-[640px]">
            <section className="flex flex-col items-center gap-3 rounded-lg bg-field px-6 py-10 text-center">
              <span aria-hidden className="flex size-[72px] items-center justify-center rounded-lg bg-sky-tint text-ocean">
                <Check className="size-9" strokeWidth={2.6} />
              </span>
              <h2 className="text-[22px] font-extrabold text-ink-strong">Nothing needs you right now</h2>
              <p className="max-w-[400px] text-base leading-normal text-muted-foreground">Everything in this week&apos;s notes is placed. New questions show up here.</p>
              <KeyLink href="/" variant="secondary" className="mt-2">
                Back to Home
              </KeyLink>
            </section>
            <MatchedList matched={inbox.matched} />
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
            <div className={cn("flex-col gap-4", selected ? "hidden lg:flex" : "flex")}>
              <section aria-labelledby="waiting-title" className="flex flex-col overflow-hidden rounded-lg border-2 border-b-4 border-hairline">
                <h2 id="waiting-title" className="px-4 pt-3.5 pb-2 text-sm font-extrabold tracking-[0.8px] text-ink-strong uppercase">
                  Waiting · {n}
                </h2>
                <div className="border-t-2 border-hairline">
                  <ItemRows items={inbox.items} selectedId={open?.id} />
                </div>
              </section>
              <MatchedList matched={inbox.matched} />
            </div>
            <div className={cn("min-w-0 flex-col gap-6", selected ? "flex" : "hidden lg:flex")}>
              {open && (
                <ItemDetail
                  key={open.id}
                  item={open}
                  students={inbox.students}
                  canAddStudents={ROLE_RANK[ctx.role] >= ROLE_RANK.teacher}
                  ownerFirstName={ownerName?.trim().split(/\s+/)[0] ?? null}
                  defaultLanguage={workspace.defaultLanguage}
                />
              )}
              {selected && (
                <div className="flex flex-col gap-4 lg:hidden">
                  {n > 1 && (
                    <section aria-labelledby="also-title" className="flex flex-col gap-2">
                      <h2 id="also-title" className="text-sm font-extrabold tracking-[0.8px] text-ink-strong uppercase">
                        Also waiting
                      </h2>
                      <div className="overflow-hidden rounded-lg border-2 border-hairline">
                        <ItemRows items={inbox.items.filter((i) => i.id !== selected.id)} />
                      </div>
                    </section>
                  )}
                  <MatchedList matched={inbox.matched} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
