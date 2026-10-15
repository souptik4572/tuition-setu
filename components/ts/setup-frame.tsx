import { Check } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";

// Phone and Try it join the list once M18 builds them (D-28).
const STEPS = ["About you", "PIN", "AI check", "Students"];

/** The setup wizard's page frame (G1, G2, D1): header, step list, then the form and its side panel. */
export function SetupFrame({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-hairline">
        <div className="mx-auto flex min-h-[70px] max-w-[1096px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4">
          <div className="flex items-center gap-2.5">
            <AppMark />
            <span className="font-display text-2xl font-extrabold tracking-[-0.4px] text-ink-strong">TuitionSetu</span>
          </div>
          {step && (
            <span className="text-[15px] text-muted-foreground">
              Setting up · step {step} of {STEPS.length}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1096px] flex-col gap-7 px-4 pt-8 pb-16">
        {step && <SetupSteps current={step} />}
        {children}
      </main>
    </div>
  );
}

function SetupSteps({ current }: { current: number }) {
  return (
    <nav aria-label="Setup steps">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          return (
            <Fragment key={label}>
              {i > 0 && <li aria-hidden className={cn("hidden h-0.5 w-8 sm:block", n <= current ? "bg-sky" : "bg-hairline")} />}
              <li aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 items-center justify-center rounded-sm text-[15px] font-extrabold",
                    state === "done" && "bg-sky-tint text-on-sky-tint",
                    state === "current" && "bg-sky text-on-sky shadow-[0_3px_0_0_var(--sky-lip)]",
                    state === "next" && "border-2 border-hairline text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="size-[18px]" strokeWidth={2.8} /> : n}
                </span>
                <span
                  className={cn(
                    "text-[15px] font-extrabold",
                    state === "done" && "text-ink-strong",
                    state === "current" && "text-ocean",
                    state === "next" && "sr-only text-muted-foreground sm:not-sr-only",
                  )}
                >
                  {label}
                </span>
                {state === "done" && <span className="sr-only">(done)</span>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/** Under the steps: the step's card (`setupCard`) beside a grey panel that drops below it on phones. */
export function SetupColumns({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-8">{children}</div>;
}

export const setupCard = "flex min-w-0 flex-[999_1_560px] flex-col gap-6 rounded-lg border-2 border-b-4 border-hairline p-[clamp(20px,3vw,32px)]";

export function SetupAside({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside aria-label={label} className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 rounded-lg bg-field p-6">
      {children}
    </aside>
  );
}
