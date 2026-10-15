"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A dialog card (R5), or a bottom sheet on phones when `sheet` is set (R4-Archive). The title is
 * the dialog's name; `description` points at the text that explains it.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  icon,
  sheet,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  icon: ReactNode;
  sheet?: boolean;
  /** Shows a close key in the corner, first in the focus order (R5: "Close without deleting"). */
  closeLabel?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex max-h-[calc(100dvh-32px)] animate-rise flex-col gap-5 overflow-y-auto bg-surface p-5 sm:top-1/2 sm:left-1/2 sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-7",
            sheet
              ? "inset-x-0 bottom-0 rounded-t-lg pb-[max(20px,env(safe-area-inset-bottom))] sm:bottom-auto"
              : "top-1/2 left-1/2 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg",
          )}
        >
          {sheet && <span aria-hidden className="mx-auto -mt-1.5 h-1 w-10 shrink-0 rounded-full bg-hairline sm:hidden" />}
          <div className="flex items-start justify-between gap-3">
            {icon}
            {closeLabel && (
              <Dialog.Close aria-label={closeLabel} className="-mt-1 -mr-1 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-strong">
                <X aria-hidden className="size-6" strokeWidth={2.4} />
              </Dialog.Close>
            )}
          </div>
          <Dialog.Title className="text-[26px] leading-[1.2] font-extrabold text-ink-strong">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalClose = Dialog.Close;

export const modalIcon = (tone: "plain" | "danger") =>
  cn("flex size-[52px] shrink-0 items-center justify-center rounded-md [&_svg]:size-6", tone === "danger" ? "bg-danger-tint text-on-danger-tint" : "bg-field text-ink-strong");
