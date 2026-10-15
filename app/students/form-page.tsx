"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { Toast, type ToastMessage } from "@/components/ts/toast";
import { StudentForm } from "./student-form";

/** R1-Edit and R1-Errors: full screen on a phone, with the keys pinned to the bottom; a card on the laptop. */
export function StudentFormPage({
  title,
  cancelHref,
  cancelLabel,
  ...form
}: { title: string; cancelHref: string; cancelLabel: string } & Omit<ComponentProps<typeof StudentForm>, "onSaved" | "onCancel" | "heading" | "intro" | "stickyKeys">) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  return (
    <div className="mx-auto w-full max-w-[920px] lg:px-6 lg:pt-8">
      <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b-2 border-hairline bg-paper px-2 pt-[env(safe-area-inset-top)] lg:static lg:border-0 lg:px-0 lg:pb-6">
        <Link href={cancelHref} aria-label={cancelLabel} className="flex size-12 shrink-0 items-center justify-center rounded-md text-ink-strong lg:hidden">
          <X aria-hidden className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-xl font-extrabold text-ink-strong lg:text-left lg:font-display lg:text-[40px] lg:leading-[1.1] lg:tracking-[-1px]">{title}</h1>
        <span aria-hidden className="size-12 shrink-0 lg:hidden" />
      </header>
      <div className="px-4 pt-5 lg:rounded-lg lg:border-2 lg:border-b-4 lg:border-hairline lg:p-8">
        <StudentForm
          {...form}
          intro
          stickyKeys
          onSaved={({ id, fullName, another }) => (another ? setToast({ text: `${fullName} added` }) : router.push(`/students/${id}`))}
          onCancel={() => router.push(cancelHref)}
        />
      </div>
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
