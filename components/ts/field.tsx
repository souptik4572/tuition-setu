import { Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Inputs use --field-border, not the design's #E5E5E5, so their edges are visible (D-18).
export const inputClass = (invalid?: boolean) =>
  cn(
    "h-[52px] w-full min-w-0 rounded-md border-2 bg-field px-3.5 text-[17px] text-ink placeholder:text-muted-foreground focus:bg-surface",
    invalid ? "border-danger bg-surface" : "border-field-border",
  );

export const labelClass = "text-base font-extrabold text-ink-strong";

export function FieldError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <span id={id} className={cn("flex items-start gap-1.5 text-[15px] leading-[1.4] font-extrabold text-on-danger-tint", className)}>
      <CircleAlert aria-hidden className="mt-px size-[18px] shrink-0" strokeWidth={2.4} />
      <span>{children}</span>
    </span>
  );
}

export function FieldOk({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} role="status" className="flex items-center gap-1.5 text-[15px] font-extrabold text-on-sky-tint">
      <Check aria-hidden className="size-[18px] shrink-0" strokeWidth={2.8} />
      {children}
    </span>
  );
}

export const helpClass = "text-[15px] leading-[1.45] text-muted-foreground";
