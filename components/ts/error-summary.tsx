"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode, Ref } from "react";

/** Moves focus to a field from the summary; for a group (radio cards) its first control. */
function focusField(id: string) {
  const el = document.getElementById(id);
  const target = el?.matches("input, textarea, select, button") ? el : el?.querySelector<HTMLElement>("input, textarea, button");
  target?.focus();
}

/**
 * Red card above a form that couldn't be saved (G1, R1-Errors). Focus it so screen readers
 * announce it. `links` jump to each field that needs filling in (R1-Errors).
 */
export function ErrorSummary({ title, children, links, ref }: { title: string; children: ReactNode; links?: { id: string; label: string }[]; ref?: Ref<HTMLDivElement> }) {
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
        {links && links.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {links.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  focusField(link.id);
                }}
                className="font-extrabold text-on-danger-tint underline"
              >
                {link.label}
              </a>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
