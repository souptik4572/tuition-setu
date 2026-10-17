import type { ReactNode } from "react";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { AppMark } from "./app-mark";
import { DesktopNav, PhoneNav } from "./nav-links";
import { StatusPill } from "./status-pill";
import { ThemeToggle } from "./theme-toggle";

const PREVIEW_TEXT = "Preview — please use sample or fictional student data. This instance may be reset after the hackathon.";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * Desktop: top bar with nav, AI pill and avatar. Phone: bottom nav with the raised Capture key;
 * the settings icon belongs to each page's own header (M2). Hosted-only pieces render only in hosted mode.
 * Full-screen phone forms (R1) turn the bottom nav off with `phoneNav={false}`.
 */
export function AppShell({ children, aiName, userName, phoneNav = true }: { children: ReactNode; aiName?: string; userName?: string; phoneNav?: boolean }) {
  const hosted = env.APP_MODE === "hosted";
  return (
    <div className="flex min-h-dvh flex-col">
      {hosted && env.PREVIEW_INSTANCE && (
        <div
          role="note"
          className="border-b-2 border-caution-border bg-caution px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 text-center text-sm font-extrabold text-on-caution"
        >
          {PREVIEW_TEXT}
        </div>
      )}
      <header className="hidden border-b-2 border-hairline lg:block">
        <div className="mx-auto flex min-h-[70px] max-w-[1328px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <AppMark />
            <span className="font-display text-2xl font-extrabold tracking-[-0.4px] text-ink-strong">TuitionSetu</span>
          </div>
          <DesktopNav />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {aiName && <StatusPill mode={hosted ? "hosted" : "local"} name={aiName} />}
            {userName && (
              <span
                role="img"
                aria-label={userName}
                className="flex size-10 items-center justify-center rounded-md bg-sent text-[15px] font-extrabold text-on-sent"
              >
                {initials(userName)}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className={cn("flex-1 lg:pb-16", phoneNav && "pb-[calc(110px+env(safe-area-inset-bottom))]")}>{children}</main>
      {phoneNav && <PhoneNav />}
    </div>
  );
}
