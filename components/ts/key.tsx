import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "whatsapp" | "text" | "danger";
type Size = "big" | "default" | "small" | "icon";

// Depth is a lip, never a blur: pressing drops the key by the lip height and the lip disappears.
const variants: Record<Variant, string> = {
  primary: "bg-sky text-on-sky shadow-[0_4px_0_0_var(--sky-lip)] active:translate-y-1",
  secondary:
    "border-2 border-hairline bg-surface text-ocean shadow-[0_2px_0_0_var(--hairline)] active:translate-y-0.5",
  whatsapp: "bg-green text-on-green shadow-[0_4px_0_0_var(--green-lip)] active:translate-y-1",
  text: "bg-transparent px-1 text-ocean",
  danger: "bg-danger text-on-danger shadow-[0_4px_0_0_var(--danger-lip)] active:translate-y-1",
};

const sizes: Record<Size, string> = {
  big: "h-14 rounded-lg px-6",
  default: "h-[50px] rounded-lg px-[22px]",
  small: "h-11 rounded-md px-4",
  icon: "size-12 rounded-md",
};

const base =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.8px] whitespace-nowrap no-underline transition-[transform,box-shadow] duration-[90ms] ease-out select-none active:shadow-none [&_svg]:size-5 [&_svg]:shrink-0";

const disabledStyle = "cursor-not-allowed border-0 bg-hairline text-muted-foreground shadow-none active:translate-y-0";

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

function keyClass({ variant = "primary", size = "default", className }: Omit<Common, "children">, disabled?: boolean) {
  const icon = size === "icon" && variant === "secondary" ? "text-ink-strong" : "";
  return cn(base, sizes[size], variant === "text" ? "h-11" : "", disabled ? disabledStyle : cn(variants[variant], icon), className);
}

export function Key({ variant, size, className, children, ...props }: Common & ComponentProps<"button">) {
  return (
    <button type="button" className={keyClass({ variant, size, className }, props.disabled)} {...props}>
      {children}
    </button>
  );
}

export function KeyLink({ variant, size, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={keyClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
