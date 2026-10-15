import { CircleAlert } from "lucide-react";
import type { ReactNode, Ref } from "react";

/** Red card above a form that couldn't be saved (G1, R1-Errors). Focus it so screen readers announce it. */
export function ErrorSummary({ title, children, ref }: { title: string; children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex animate-rise gap-3 rounded-md border-2 border-danger bg-danger-tint px-4 py-3.5 text-on-danger-tint"
    >
      <CircleAlert aria-hidden className="mt-px size-[22px] shrink-0" strokeWidth={2.4} />
      <span className="flex flex-col gap-0.5 text-base leading-[1.45]">
        <strong className="font-extrabold">{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  );
}
