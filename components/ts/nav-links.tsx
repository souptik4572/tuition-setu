"use client";

import { House, ListChecks, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/cycles/current", label: "Review", match: (p: string) => p.startsWith("/cycles") },
  { href: "/students", label: "Students", match: (p: string) => p.startsWith("/students") },
  // Settings joins once it's built (M11, cut from the MVP; IMPL §1.1).
];

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-wrap gap-1">
      {sections.map((s) => {
        const current = s.match(path);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-11 items-center rounded-md px-3.5 text-[15px] font-extrabold uppercase tracking-[0.8px] no-underline",
              current ? "bg-sky-tint text-ocean" : "text-ink-strong hover:bg-field",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

const tab = "flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-md text-xs font-extrabold uppercase tracking-[0.6px] no-underline [&_svg]:size-6";

export function PhoneNav() {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof House, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(tab, current ? "bg-sky-tint text-ocean" : "text-muted-foreground")}
    >
      <Icon aria-hidden strokeWidth={2.2} />
      {label}
    </Link>
  );
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 items-end gap-1.5 border-t-2 border-hairline bg-paper px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      {item("/", "Home", House, path === "/")}
      <Link
        href="/capture"
        aria-current={path.startsWith("/capture") ? "page" : undefined}
        className={cn(tab, "-mt-5 h-[68px] rounded-lg bg-sky text-on-sky shadow-[0_4px_0_0_var(--sky-lip)] transition-[transform,box-shadow] duration-[90ms] active:translate-y-1 active:shadow-none")}
      >
        <Plus aria-hidden strokeWidth={2.6} />
        Capture
      </Link>
      {item("/cycles/current", "Review", ListChecks, path.startsWith("/cycles"))}
      {item("/students", "Students", Users, path.startsWith("/students"))}
    </nav>
  );
}
