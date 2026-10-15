import { Check, CircleAlert, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "success" | "flag" | "caution" | "danger";

const variants: Record<Variant, { icon: LucideIcon; className: string }> = {
  success: { icon: Check, className: "bg-sky-tint text-on-sky-tint" },
  flag: { icon: TriangleAlert, className: "border-2 border-orange bg-orange-tint text-on-highlight" },
  caution: { icon: CircleAlert, className: "border-2 border-caution-border bg-caution text-on-caution" },
  danger: { icon: ShieldAlert, className: "bg-danger text-on-danger" },
};

export function Banner({
  variant,
  children,
  action,
  icon,
  className,
}: {
  variant: Variant;
  children: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const { icon: DefaultIcon, className: tone } = variants[variant];
  const Icon = icon ?? DefaultIcon;
  return (
    <div role="status" className={cn("flex items-center gap-3 rounded-md px-4 py-3.5 text-base font-extrabold", tone, className)}>
      <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={2.4} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
