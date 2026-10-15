"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { inputClass, labelClass } from "./field";
import { Key } from "./key";
import { Modal, modalIcon } from "./modal";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A destructive step that needs the full name typed first (R5). The close key comes first in
 * the focus order, so Enter never deletes by accident; matching ignores case and outer spaces.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  name,
  confirmLabel,
  onConfirm,
  pending,
  error,
  alternative,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  name: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  error?: ReactNode;
  /** The safer choice under the danger key, e.g. Archive instead. */
  alternative: ReactNode;
  children: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const ready = same(typed, name);
  const hint = ready ? "Name matches. Delete permanently is now on." : typed.trim() ? "Keep typing — it needs to match exactly" : "Type the full name to turn on Delete permanently";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
      title={title}
      icon={
        <span aria-hidden className={modalIcon("danger")}>
          <Trash2 strokeWidth={2.4} />
        </span>
      }
      closeLabel="Close without deleting"
    >
      {children}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !pending) onConfirm();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-name" className={labelClass}>
            Type <span className="text-ink">{name}</span> to confirm
          </label>
          <input
            id="confirm-name"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby="confirm-hint"
            className={inputClass()}
          />
          <span id="confirm-hint" role="status" className={ready ? "text-sm font-extrabold text-on-sky-tint" : "text-sm text-muted-foreground"}>
            {hint}
          </span>
        </div>
        {error}
        <div className="flex flex-col gap-3">
          <Key type="submit" variant="danger" size="big" disabled={!ready || pending}>
            {pending ? "Deleting…" : confirmLabel}
          </Key>
          {alternative}
        </div>
      </form>
    </Modal>
  );
}
