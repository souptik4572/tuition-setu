"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { inputClass } from "./field";
import { Key } from "./key";

/** An inline "Add" field for a new batch or nickname. Enter adds, Escape closes. */
export function AddInline({ id, label, placeholder, onAdd, onClose }: { id: string; label: string; placeholder: string; onAdd: (value: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const add = () => {
    if (value.trim()) onAdd(value.trim());
    onClose();
  };
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Escape") onClose();
        }}
        className={cn(inputClass(), "h-11 w-[180px] text-base")}
      />
      <Key size="small" onClick={add}>
        Add
      </Key>
    </span>
  );
}
