import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { KeyLink } from "@/components/ts/key";
import { requirePageMember } from "@/lib/auth/require-member";
import { getOpenCycle } from "@/lib/db/queries/cycles";
import { loadShell } from "../../shell";

export const metadata: Metadata = { title: "Weekly review · TuitionSetu" };

/** The Review tab: this week's review, or a nudge when no note has started a week yet. */
export default async function CurrentCyclePage() {
  const ctx = await requirePageMember();
  const cycle = await getOpenCycle(ctx);
  if (cycle) redirect(`/cycles/${cycle.id}`);
  const { shell } = await loadShell(ctx);
  return (
    <AppShell {...shell}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 pt-8 lg:px-6">
        <h1 className="font-display text-[40px] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong">Review this week</h1>
        <section className="flex flex-col items-center gap-3 rounded-lg bg-field px-6 py-10 text-center">
          <h2 className="text-[22px] font-extrabold text-ink-strong">No notes yet this week</h2>
          <p className="max-w-[420px] text-base leading-normal text-muted-foreground">Your first note starts this week&apos;s review. Start with whatever you have.</p>
          <KeyLink href="/capture" className="mt-2">
            Type a note
          </KeyLink>
        </section>
      </div>
    </AppShell>
  );
}
