"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A command to paste into the terminal, with a Copy key (D1-ModelMissing, L1, F3-Desktop). */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Plain-HTTP pages on a phone have no clipboard access; the command is still there to select.
    }
  };
  return (
    <span className="flex items-center gap-2.5 rounded-sm border-2 border-hairline bg-surface py-1.5 pr-1.5 pl-3.5">
      <code className="min-w-0 flex-1 font-mono text-[15px] break-words text-ink sm:text-[17px]">{command}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy command"}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-hairline bg-surface text-ocean shadow-[0_2px_0_0_var(--hairline)] transition-[transform,box-shadow] duration-[90ms] active:translate-y-0.5 active:shadow-none"
      >
        {copied ? <Check aria-hidden className="size-5" strokeWidth={2.6} /> : <Copy aria-hidden className="size-5" strokeWidth={2.4} />}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}
