import { CopyCommand } from "@/components/ts/copy-command";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/util/platform";

/** How to run `npm run reset-pin` on the laptop (L1, F3-Desktop; D-19 commands for the laptop's OS). */
export function ResetSteps({ platform, onLaptop, numbered }: { platform: Platform; onLaptop: boolean; numbered: boolean }) {
  const steps = [
    <>
      {onLaptop ? "Open" : "On the laptop, open"} <strong className="font-extrabold">{platform.terminal.app}</strong>
      {platform.terminal.how}.
    </>,
    <span key="cmd" className="flex flex-col gap-2">
      Copy this line, paste it in, and press Enter:
      <CopyCommand command={`${platform.cdCommand} && npm run reset-pin`} />
    </span>,
    <>Choose a new 6-digit PIN or a passphrase when it asks.</>,
  ];
  return (
    <ol className={cn("flex flex-col text-base leading-normal", numbered ? "gap-3.5" : "list-decimal gap-2.5 pl-[22px]")}>
      {steps.map((step, i) =>
        numbered ? (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-field text-sm font-extrabold text-ink-strong">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{step}</span>
          </li>
        ) : (
          <li key={i}>{step}</li>
        ),
      )}
    </ol>
  );
}
