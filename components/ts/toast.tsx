"use client";

import { Check } from "lucide-react";
import { useEffect, useEffectEvent } from "react";

export type ToastMessage = { text: string; undo?: () => void };

/**
 * Bottom toast with an optional Undo (R4: "Arjun Das restored"). It sits above the phone's nav bar
 * and goes after six seconds. The live region is always there, so screen readers hear each message.
 */
export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(done, 6000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(100px+env(safe-area-inset-bottom))] z-50 flex justify-center lg:inset-x-auto lg:right-8 lg:bottom-8"
    >
      {toast && (
        <div className="pointer-events-auto flex w-full max-w-[420px] animate-rise items-center gap-3 rounded-md bg-sent py-2 pr-2 pl-4 text-base font-extrabold text-on-sent lg:w-[400px]">
          <Check aria-hidden className="size-5 shrink-0" strokeWidth={2.8} />
          <span className="min-w-0 flex-1 py-2">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo!();
                onDone();
              }}
              className="h-11 shrink-0 cursor-pointer rounded-md px-3 text-[15px] font-extrabold tracking-[0.8px] text-sky-tint uppercase"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
