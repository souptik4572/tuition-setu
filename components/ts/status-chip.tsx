import {
  Check,
  CheckCheck,
  CircleHelp,
  FileQuestion,
  History,
  Minus,
  NotebookPen,
  PenLine,
  SkipForward,
  ThumbsUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Status =
  | "needs_you"
  | "notes"
  | "writing"
  | "checked"
  | "flagged"
  | "stale"
  | "approved"
  | "sent"
  | "skipped"
  | "no_notes"
  | "couldnt_read";

const chips: Record<Status, { word: string; icon: LucideIcon; className: string }> = {
  needs_you: { word: "Needs you", icon: CircleHelp, className: "bg-highlight text-on-highlight" },
  notes: { word: "Note saved", icon: NotebookPen, className: "bg-field text-muted-foreground" },
  writing: { word: "Writing", icon: PenLine, className: "bg-sky-tint text-ocean [&_svg]:animate-reading" },
  checked: { word: "Checked", icon: Check, className: "bg-sky-tint text-on-sky-tint" },
  flagged: { word: "Flagged", icon: TriangleAlert, className: "bg-orange text-on-orange" },
  stale: { word: "Out of date", icon: History, className: "border-2 border-caution-border bg-caution text-on-caution" },
  approved: { word: "Approved", icon: ThumbsUp, className: "bg-ocean text-on-ocean" },
  sent: { word: "Sent", icon: CheckCheck, className: "bg-sent text-on-sent" },
  skipped: { word: "Skipped", icon: SkipForward, className: "border-2 border-dashed border-skip-border bg-paper text-muted-foreground" },
  no_notes: { word: "No notes", icon: Minus, className: "border-2 border-hairline bg-paper text-muted-foreground" },
  couldnt_read: { word: "Couldn't read", icon: FileQuestion, className: "bg-hairline text-ink" },
};

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const { word, icon: Icon, className: tone } = chips[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[13px] font-extrabold uppercase tracking-[0.6px] whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.4} />
      {word}
    </span>
  );
}
