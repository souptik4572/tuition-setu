"use client";

import { ChevronDown, Lock, MoreVertical, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type MenuItem = { title: string; helper?: string; icon: LucideIcon; danger?: boolean; onSelect: () => void };

/**
 * A kebab key on phones, "Actions" on the laptop (R3, D4-Profile). Rows the role can't use are
 * left out by the caller; `note` explains a missing one ("Only the owner, Mita, can delete…").
 * Danger rows sit below a rule.
 */
export function ActionsMenu({ label, items, note }: { label: string; items: MenuItem[]; note?: string }) {
  return (
    // Not modal: a row can open a dialog, and two modal layers fight over focus and pointer events.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-hairline bg-surface text-[15px] font-extrabold tracking-[0.8px] text-ink-strong uppercase shadow-[0_2px_0_0_var(--hairline)] data-[state=open]:border-field-border lg:w-auto lg:px-3.5 lg:text-ocean"
      >
        <MoreVertical aria-hidden className="size-6 lg:hidden" strokeWidth={2.4} />
        <span aria-hidden className="hidden lg:inline">
          Actions
        </span>
        <ChevronDown aria-hidden className="hidden size-5 lg:block" strokeWidth={2.6} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 flex w-[min(270px,calc(100vw-32px))] animate-rise flex-col rounded-lg border-2 border-b-4 border-hairline bg-surface p-2"
        >
          {items.map((item, i) => (
            <Fragment key={item.title}>
              {item.danger && i > 0 && <DropdownMenu.Separator className="mx-2 my-1.5 h-0.5 bg-hairline" />}
              <DropdownMenu.Item
                onSelect={item.onSelect}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 outline-none data-highlighted:bg-field"
              >
                <item.icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", item.danger ? "text-danger" : "text-ink-strong")} strokeWidth={2.4} />
                <span className="flex flex-col">
                  <span className={cn("text-[17px] font-extrabold", item.danger ? "text-danger" : "text-ink-strong")}>{item.title}</span>
                  {item.helper && <span className={cn("text-sm", item.danger ? "text-danger" : "text-muted-foreground")}>{item.helper}</span>}
                </span>
              </DropdownMenu.Item>
            </Fragment>
          ))}
          {note && (
            <>
              <DropdownMenu.Separator className="mx-2 my-1.5 h-0.5 bg-hairline" />
              <p className="flex items-start gap-2.5 px-3 py-2 text-sm leading-[1.45] text-muted-foreground">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
                {note}
              </p>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
