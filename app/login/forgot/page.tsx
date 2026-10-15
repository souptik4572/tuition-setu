import { ArrowLeft, KeyRound, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { KeyLink } from "@/components/ts/key";
import { getLocalOwner } from "@/lib/db/queries/members";
import { env } from "@/lib/env";
import { hostPlatform } from "@/lib/util/platform";
import { ResetSteps } from "../reset-steps";

export const metadata: Metadata = { title: "Reset your PIN · TuitionSetu" };

/** L1 (D-19: commands for the laptop's OS). Public: someone locked out needs it most. */
export default async function ForgotPage() {
  if (env.APP_MODE === "hosted") notFound();
  // better-sqlite3 answers synchronously, so without this Next would render the page once, at build time.
  await connection();
  const owner = await getLocalOwner();
  const noun = owner?.pinKind === "passphrase" ? "passphrase" : "PIN";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-[18px] px-4 pt-[max(52px,env(safe-area-inset-top))] pb-[max(34px,env(safe-area-inset-bottom))]">
      <Link href="/login" aria-label={`Back to ${noun}`} className="-ml-2 flex size-12 items-center justify-center rounded-md text-ink-strong">
        <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
      </Link>
      <span aria-hidden className="flex size-[60px] items-center justify-center rounded-lg bg-sky-tint text-ocean">
        <KeyRound className="size-8" strokeWidth={2.2} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.8px] text-ink-strong">Reset your {noun} on the laptop</h1>
        <p className="text-[17px] leading-normal text-muted-foreground">
          To keep your students&apos; details safe, the {noun} can only be changed on the laptop where TuitionSetu runs. This works even during a 10-minute pause.
        </p>
      </div>
      <ResetSteps platform={hostPlatform()} onLaptop={false} numbered />
      <div role="note" className="flex gap-3 rounded-md border-2 border-caution-border bg-caution p-3.5 text-on-caution">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
        <span className="flex flex-col gap-0.5 text-[15px] leading-[1.45]">
          <strong className="font-extrabold">Every device will be signed out</strong>
          <span>Sign in again with the new {noun}.</span>
        </span>
      </div>
      <KeyLink href="/login" variant="secondary" size="big" className="mt-auto w-full">
        Back to {noun}
      </KeyLink>
    </main>
  );
}
