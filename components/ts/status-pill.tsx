import { Cloud, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

/** "On your laptop · {model}" in local mode, "AI · {provider}" in hosted mode (IMPL D-21). */
export function StatusPill({ mode, name, className }: { mode: "local" | "hosted"; name: string; className?: string }) {
  const Icon = mode === "local" ? Laptop : Cloud;
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={2.2} />
      {mode === "local" ? `On your laptop · ${name}` : `AI · ${name}`}
    </span>
  );
}
