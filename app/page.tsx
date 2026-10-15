import type { ReactNode } from "react";
import { AppShell } from "@/components/ts/app-shell";
import { Banner } from "@/components/ts/banner";
import { Key } from "@/components/ts/key";
import { MessageBubble } from "@/components/ts/message-bubble";
import { StatusChip, type Status } from "@/components/ts/status-chip";
import { requirePageMember } from "@/lib/auth/require-member";
import { getMember } from "@/lib/db/queries/members";
import { env } from "@/lib/env";
import { logout } from "./login/actions";

// Foundations check (IMPL M1). The dashboard replaces this page in M6.

const STATUSES: Status[] = ["needs_you", "notes", "writing", "checked", "flagged", "stale", "approved", "sent", "skipped", "no_notes", "couldnt_read"];

const EN_PREFIX = "*Weekly update — Riya (12–18 Oct)*\nHello Mrs Sen,\n\n";
const EN_BODY =
  "This week Riya worked on Chapter 5, linear equations. She scored 18/20 (70%) in Thursday's test, up from her recent average of 58%, so the extra practice is paying off.";
const BN_MESSAGE =
  "*তন্ময়-এর সাপ্তাহিক আপডেট (12–18 Oct)*\nনমস্কার,\n\nএই সপ্তাহে তন্ময় ভগ্নাংশে অনেকটা উন্নতি করেছে। কুইজে ও 17/25 পেয়েছে।\n\n— Mita Ma'am";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline bg-surface p-6">
      <h2 className="text-[15px] font-extrabold uppercase tracking-[0.8px] text-ink-strong">{title}</h2>
      {children}
    </section>
  );
}

export default async function Home() {
  const ctx = await requirePageMember();
  const member = await getMember(ctx, ctx.memberId);
  return (
    <AppShell aiName={env.MODEL_DRAFT ?? "no model chosen yet"} userName={member?.displayName}>
      <div className="mx-auto flex max-w-[1328px] flex-col gap-8 px-4 py-8 lg:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-5xl leading-[1.1] font-extrabold tracking-[-1.2px] text-ink-strong">TuitionSetu</h1>
            <p className="text-muted-foreground">Foundations check. The dashboard replaces this page in M6.</p>
          </div>
          <form action={logout}>
            <Key type="submit" variant="secondary">
              Sign out
            </Key>
          </form>
        </header>

        <Section title="Type · three scripts">
          <p className="text-[17px] leading-normal">She scored 14/20 (70%) in Thursday&apos;s test, up from her recent average of 58%.</p>
          <p lang="bn" className="text-[22px] leading-normal font-bold">
            তন্ময়ের সাপ্তাহিক বার্তা
          </p>
          <p lang="bn" className="text-[17px] leading-[1.6]">
            নমস্কার, এটি তন্ময়ের এই সপ্তাহের বার্তা। কুইজে ও 17/25 পেয়েছে।
          </p>
          <p lang="hi" className="text-[22px] leading-normal font-bold">
            कबीर का साप्ताहिक संदेश
          </p>
          <p lang="hi" className="text-[17px] leading-[1.6]">
            नमस्ते, यह कबीर का इस हफ़्ते का संदेश है।
          </p>
        </Section>

        <Section title="Status chips">
          <div className="flex flex-wrap gap-2.5">
            {STATUSES.map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section title="Keys">
          <div className="flex flex-wrap items-center gap-3.5">
            <Key>Approve</Key>
            <Key variant="secondary">Edit</Key>
            <Key variant="whatsapp">Send on WhatsApp</Key>
            <Key variant="text">Forgot PIN?</Key>
            <Key disabled>Write updates</Key>
            <Key variant="danger">Delete all data</Key>
          </div>
        </Section>

        <Section title="Banners">
          <div className="grid gap-3.5 md:grid-cols-2">
            <Banner variant="success">Checked — every number matches your notes</Banner>
            <Banner variant="flag">One number isn&apos;t in your notes</Banner>
            <Banner variant="caution">AI engine is off — your notes are still saved</Banner>
            <Banner variant="danger">AI runs outside this device — student data leaves this laptop.</Banner>
          </div>
        </Section>

        <Section title="Message bubbles">
          <div className="grid gap-6 md:grid-cols-2">
            <MessageBubble
              header="To Mrs Sen · English"
              language="en"
              message={`${EN_PREFIX}${EN_BODY}\n\n— Mita Ma'am`}
              bodyOffset={EN_PREFIX.length}
              highlights={[{ start: EN_BODY.indexOf("18/20"), end: EN_BODY.indexOf("18/20") + 5, label: "Not in your notes" }]}
            />
            <MessageBubble header="To Tanmoy's parent · বাংলা" language="bn" message={BN_MESSAGE} streaming />
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
