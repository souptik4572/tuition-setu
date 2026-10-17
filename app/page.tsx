import { ChevronRight, Laptop, PenLine, Smartphone, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/ts/app-shell";
import { Banner } from "@/components/ts/banner";
import { Key, KeyLink } from "@/components/ts/key";
import { StatusPill } from "@/components/ts/status-pill";
import { ThemeToggle } from "@/components/ts/theme-toggle";
import { getHealth } from "@/lib/ai/health";
import { requirePageMember } from "@/lib/auth/require-member";
import { env } from "@/lib/env";
import { loadNeedsYou } from "@/lib/pipeline/needs-you";
import { cycleRangeFor, formatRange, hourIn, todayIn } from "@/lib/util/dates";
import { cn } from "@/lib/utils";
import { logout } from "./login/actions";
import { CountChip, ItemRows } from "./needs-you/inbox";
import { loadShell } from "./shell";
import { loadRoster } from "./students/data";

const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]);

const card = "flex flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline p-5 lg:p-6";

function Stat({ n, label, lead, className }: { n: number; label: string; lead?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-md px-4 py-3", lead ? "bg-sky-tint text-on-sky-tint" : "bg-field text-ink-strong", className)}>
      <span className="text-[28px] leading-tight font-extrabold">{n}</span>
      <span className={cn("text-[15px]", lead ? "" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}

/** The dashboard (M2 on phones, D2 on the laptop, F2-Home, States 2). */
export default async function Home() {
  const ctx = await requirePageMember();
  const { workspace, member, shell } = await loadShell(ctx);
  const [inbox, roster, health] = await Promise.all([loadNeedsYou(ctx), loadRoster(ctx, workspace.timezone), getHealth({ aiConfig: workspace.aiConfigJson })]);

  const hour = hourIn(workspace.timezone);
  const greeting = `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${member?.displayName.trim().split(/\s+/)[0] ?? ""}`;
  const { from, to } = cycleRangeFor(todayIn(workspace.timezone));
  const range = inbox.cycle?.label ?? formatRange(from, to);
  const students = roster.active;
  const withNotes = students.filter((s) => s.week !== "no_notes");
  const without = students.filter((s) => s.week === "no_notes");
  const sent = students.filter((s) => s.week === "sent").length;
  const n = inbox.items.length;
  const hosted = env.APP_MODE === "hosted";

  return (
    <AppShell {...shell}>
      <div className="mx-auto flex w-full max-w-332 flex-col gap-6 px-4 pt-6 lg:px-6 lg:pt-8">
        {!health.reachable && (
          <Banner variant="caution">
            AI engine is off — your notes are still saved. They&apos;re read as soon as it&apos;s back.
          </Banner>
        )}
        {!health.loopback && <Banner variant="danger">AI runs outside this device — student data leaves this laptop.</Banner>}

        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-[1.2] font-extrabold text-ink-strong lg:font-display lg:text-5xl lg:leading-[1.1] lg:tracking-[-1.2px]">{greeting}</h1>
            <StatusPill mode={hosted ? "hosted" : "local"} name={shell.aiName} className="lg:hidden" />
            <p className="hidden text-[17px] text-muted-foreground lg:block">Week of {range}</p>
          </div>
          {/* Phones have no top bar, so the phone guide and the theme sit here. */}
          <div className="-mr-2 flex shrink-0 lg:hidden">
            <Link href="/phone" aria-label="Use it on your phone" className="flex size-12 items-center justify-center rounded-md text-ink-strong hover:bg-field">
              <Smartphone aria-hidden className="size-6" strokeWidth={2.4} />
            </Link>
            <ThemeToggle className="size-12" />
          </div>
        </header>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-6">
            <Link
              href="/capture"
              className="flex min-h-26 items-center gap-4 rounded-lg bg-sky px-5 py-5 text-on-sky no-underline shadow-[0_4px_0_0_var(--sky-lip)] transition-[transform,box-shadow] duration-90 active:translate-y-1 active:shadow-none lg:min-h-30 lg:px-6"
            >
              <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface text-ocean">
                <PenLine className="size-7" strokeWidth={2.4} />
              </span>
              <span className="flex flex-col">
                <span className="text-[22px] font-extrabold">Type a note</span>
                <span className="text-[15px]">English, বাংলা or shorthand</span>
              </span>
            </Link>

            <section aria-labelledby="week-title" className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="week-title" className="text-xl font-extrabold text-ink-strong">
                  {withNotes.length ? "This week" : "No notes yet this week"}
                </h2>
                <span className="text-[15px] text-muted-foreground">
                  {range} · {students.length === 1 ? "1 student" : `${students.length} students`}
                </span>
              </div>
              {withNotes.length === 0 ? (
                <p className="text-base text-muted-foreground">{students.length ? `${students.length === 1 ? "1 student" : `${students.length} students`} waiting. Start with whatever you have.` : "Add your students, then start with whatever you have."}</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4">
                    <Stat n={students.length} label="students" className="hidden lg:flex" />
                    <Stat n={withNotes.length} label="with notes" lead />
                    <Stat n={without.length} label="without" />
                    <Stat n={sent} label="sent" />
                  </div>
                  <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
                    <p className="min-w-0 flex-[1_1_320px] text-[15px] text-muted-foreground">
                      {list(withNotes.map((s) => s.messageName))} {withNotes.length === 1 ? "has" : "have"} notes.
                      {without.length > 0 && ` ${list(without.map((s) => s.messageName))} ${without.length === 1 ? "doesn't" : "don't"} yet.`}
                    </p>
                    <KeyLink href="/cycles/current" variant="secondary">
                      Open weekly review
                    </KeyLink>
                  </div>
                </>
              )}
              {students.length === 0 && (
                <KeyLink href="/students/new" variant="secondary" className="self-start">
                  Add a student
                </KeyLink>
              )}
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section aria-labelledby="needs-title" className="flex flex-col overflow-hidden rounded-lg border-2 border-b-4 border-hairline">
              <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
                <h2 id="needs-title" className="text-xl font-extrabold text-ink-strong">
                  <Link href="/needs-you" className="text-ink-strong no-underline">
                    Needs you
                  </Link>
                </h2>
                {n > 0 && <CountChip n={n} word="to check" />}
              </div>
              {n === 0 ? (
                <p className="border-t-2 border-hairline px-5 py-4 text-base text-muted-foreground">Nothing needs you right now</p>
              ) : (
                <div className="border-t-2 border-hairline">
                  <ItemRows items={inbox.items.slice(0, 5)} />
                  {n > 5 && (
                    <Link href="/needs-you" className="flex min-h-12 items-center justify-between border-t-2 border-hairline px-5 text-base font-extrabold text-ocean no-underline">
                      See all {n}
                      <ChevronRight aria-hidden className="size-5" strokeWidth={2.4} />
                    </Link>
                  )}
                </div>
              )}
            </section>

            <section aria-label="AI engine" className="hidden items-center gap-3 rounded-lg bg-field p-4 lg:flex">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface text-ink-strong">
                {health.reachable ? <Laptop className="size-6" strokeWidth={2.2} /> : <TriangleAlert className="size-6" strokeWidth={2.2} />}
              </span>
              <span className="flex flex-col">
                <span className="text-base font-extrabold text-ink-strong">{hosted ? `AI · ${shell.aiName}` : `On your machine · ${shell.aiName}`}</span>
                <span className={cn("text-[15px]", health.reachable ? "text-ocean" : "text-on-caution")}>{health.reachable ? "AI engine running" : "AI engine is off"}</span>
              </span>
            </section>
          </div>
        </div>

        {/* Settings (M11) takes over signing out; until then it lives here. */}
        <form action={logout} className="flex justify-center pt-4 pb-2">
          <Key type="submit" variant="text">
            Sign out
          </Key>
        </form>
      </div>
    </AppShell>
  );
}
