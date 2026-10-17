"use client";

import { Check, CircleAlert, Cpu, LifeBuoy, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Switch } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyCommand } from "@/components/ts/copy-command";
import { Key, KeyLink } from "@/components/ts/key";
import { SetupAside, SetupColumns, setupCard } from "@/components/ts/setup-frame";
import type { AiErrorCode } from "@/lib/ai/errors";
import type { Health } from "@/lib/ai/health";
import { DOWNLOAD_GB, MIN_RAM_GB, type ModelTask } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { setQualityMode } from "./actions";

const NEXT = "/setup/students";
const SAMPLE_NOTE = "Riya ch5 test 14/20";

const TEST_ERRORS: Partial<Record<AiErrorCode, string>> = {
  timeout: "The AI took too long. The first run also loads the model, so try once more.",
  provider_unreachable: "The AI engine stopped answering. Check that it's running, then try again.",
  model_missing: "A model is missing. Download it above, then try again.",
};

const sizeText = (gb?: number) => (gb ? `${gb} GB` : "");

function roles(tasks: ModelTask[]) {
  const reads = tasks.includes("extract") ? (tasks.includes("vision") ? "Reads your notes and register photos" : "Reads your notes") : tasks.includes("vision") ? "Reads register photos" : null;
  return { reads, writes: tasks.includes("draft") };
}

export function AiCheck({
  health,
  qualityMode,
  qualityModel,
  qualityLocked,
  terminal,
  restartAi,
}: {
  health: Health;
  qualityMode: boolean;
  qualityModel: string;
  qualityLocked: boolean;
  terminal: { app: string; how: string };
  restartAi: string;
}) {
  const router = useRouter();
  const [checking, startCheck] = useTransition();
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<Health["test"] | null>(null);
  const [saving, startSave] = useTransition();
  const [qualityError, setQualityError] = useState<string | null>(null);

  // One row per model: by default a single model reads and writes.
  const rows = new Map<string, Health["models"][number] & { tasks: ModelTask[] }>();
  for (const m of health.models) rows.set(m.name, { ...m, tasks: [...(rows.get(m.name)?.tasks ?? []), m.task] });
  const qualitySize = sizeText(DOWNLOAD_GB[qualityModel]);
  const ready = health.reachable && health.models.filter((m) => m.task !== "vision").every((m) => m.installed);
  const missing = new Set(health.missing.map((m) => m.name));
  const ramOk = Math.round(health.ramGb) >= MIN_RAM_GB;
  // Not offered when .env.local fixes the writing model, or it already is the larger one.
  const offerQuality = health.qualityModeAvailable && health.provider === "ollama" && !qualityLocked && (qualityMode || health.models.find((m) => m.task === "draft")?.name !== qualityModel);

  const checkAgain = () => startCheck(() => router.refresh());

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/ai/health?test=1", { cache: "no-store" });
      const body = (await res.json()) as Health;
      setTest(res.ok ? body.test : { ok: false, ms: 0, wrote: "", numbersOk: false, error: "provider_error" });
    } catch {
      setTest({ ok: false, ms: 0, wrote: "", numbersOk: false, error: "provider_unreachable" });
    } finally {
      setTesting(false);
    }
  };

  const toggleQuality = (on: boolean) => {
    setQualityError(null);
    startSave(async () => {
      const result = await setQualityMode(on);
      if (!result.ok) return setQualityError(result.error.message);
      setTest(null);
      router.refresh();
    });
  };

  const subtitle = !health.reachable
    ? "TuitionSetu reads your notes and writes updates with an AI that runs on this laptop. It isn't answering yet."
    : missing.size
      ? `Almost there. ${missing.size === 1 ? "One piece needs" : `${missing.size} pieces need`} downloading before TuitionSetu can write updates.`
      : "TuitionSetu reads your notes and writes updates with an AI that runs on this laptop. This step makes sure it's ready.";

  return (
    <SetupColumns>
      <section aria-labelledby="ai-title" className={setupCard}>
        <div className="flex flex-col gap-2">
          <h1 id="ai-title" className="font-display text-[clamp(32px,4vw,40px)] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong">
            Check the AI engine
          </h1>
          <p className="max-w-[620px] text-[17px] leading-normal text-muted-foreground">{subtitle}</p>
        </div>

        <EngineCard health={health} terminal={terminal} checking={checking} onCheck={checkAgain} />

        {health.reachable && (
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-extrabold tracking-[0.8px] text-ink-strong uppercase">Installed models</h2>
            <div className="overflow-hidden rounded-md border-2 border-hairline">
              {[...rows.values()].map((row, i) => {
                const { reads, writes } = roles(row.tasks);
                const isMissing = missing.has(row.name);
                return (
                  <div key={row.name} className={cn(i > 0 && "border-t-2 border-hairline")}>
                    <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                        <span className="text-[17px] font-extrabold break-all">{row.name}</span>
                        {reads && <span className="text-[15px] text-muted-foreground">{reads}</span>}
                        {writes && (
                          <span className="text-[15px] text-muted-foreground">
                            Writes updates in English, <span lang="bn">বাংলা</span> and <span lang="hi">हिन्दी</span>
                          </span>
                        )}
                      </span>
                      {row.sizeGb && <span className="text-[15px] text-muted-foreground">{sizeText(row.sizeGb)}</span>}
                      {row.installed ? (
                        <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-on-sky-tint">
                          <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />
                          Installed
                        </span>
                      ) : (
                        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-sm bg-highlight px-2.5 text-xs font-extrabold tracking-[0.6px] text-on-highlight uppercase">
                          <CircleAlert aria-hidden className="size-4" strokeWidth={2.6} />
                          Missing
                        </span>
                      )}
                    </div>
                    {isMissing && (
                      <div className="flex flex-col gap-3.5 border-t-2 border-orange bg-orange-tint px-4 pt-3.5 pb-4">
                        <ol className="flex list-decimal flex-col gap-2.5 pl-[22px] text-base leading-normal text-ink">
                          <li>
                            Open <strong className="font-extrabold">{terminal.app}</strong>
                            {terminal.how}.
                          </li>
                          <li>
                            <span className="flex flex-col gap-2">
                              Copy this line, paste it in, and press Enter:
                              <CopyCommand command={`ollama pull ${row.name}`} />
                            </span>
                          </li>
                          <li>Wait until it says it&apos;s done. It downloads {sizeText(row.sizeGb ?? DOWNLOAD_GB[row.name]) || "the model"} once.</li>
                          <li>
                            Come back here and press <strong className="font-extrabold">Check again</strong>.
                          </li>
                        </ol>
                        <Key className="self-start" onClick={checkAgain} disabled={checking}>
                          {checking ? "Checking…" : "Check again"}
                        </Key>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border-2 border-hairline px-4 py-2.5">
          <span className="flex min-w-0 flex-[1_1_220px] flex-col">
            <span className="text-[17px] font-extrabold">Memory (RAM)</span>
            <span className="text-[15px] text-muted-foreground">This laptop has {Math.round(health.ramGb)} GB</span>
          </span>
          {ramOk ? (
            <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-on-sky-tint">
              <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />
              Enough for these models
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-on-highlight">
              <TriangleAlert aria-hidden className="size-[18px]" strokeWidth={2.4} />
              Less than {MIN_RAM_GB} GB: updates may be slow
            </span>
          )}
        </div>

        {offerQuality && (
          <div className="flex flex-col gap-2 rounded-md border-2 border-hairline px-4 py-3">
            <div className="flex items-start gap-3.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span id="quality-label" className="text-[17px] font-extrabold">
                  Quality mode
                </span>
                <span id="quality-help" className="text-[15px] leading-[1.45] text-muted-foreground">
                  This laptop has the memory for a larger writing model, {qualityModel}. Updates read more naturally and take a little longer.
                  {qualitySize && ` It downloads ${qualitySize} once.`}
                </span>
              </span>
              <Switch.Root
                checked={qualityMode}
                disabled={saving}
                onCheckedChange={toggleQuality}
                aria-labelledby="quality-label"
                aria-describedby="quality-help"
                className="group flex h-11 w-16 shrink-0 cursor-pointer items-center disabled:cursor-wait"
              >
                <span aria-hidden className="relative block h-8 w-14 rounded-2xl bg-skip-border transition-colors duration-150 group-aria-checked:bg-sky">
                  <Switch.Thumb className="absolute top-1 left-1 block size-6 rounded-full bg-white shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-[left] duration-150 data-[state=checked]:left-7" />
                </span>
              </Switch.Root>
            </div>
            {qualityError && <span className="text-[15px] font-extrabold text-on-danger-tint">{qualityError}</span>}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-md bg-field p-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="text-[17px] font-extrabold text-ink-strong">Try a sample note</h2>
              <span className="text-[15px] text-muted-foreground">{ready ? "Reads one fictional line and writes one sentence" : "Runs once both models are installed"}</span>
            </div>
            <Key variant="secondary" onClick={runTest} disabled={!ready || testing}>
              {testing ? "Testing…" : test ? "Test again" : "Test"}
            </Key>
          </div>
          <div aria-live="polite">
            {testing && (
              <p className="rounded-md border-2 border-hairline bg-surface px-4 py-3.5 text-base text-muted-foreground">
                <span className="animate-reading">Reading the note and writing a sentence…</span> The first run loads the model, which can take a minute.
              </p>
            )}
            {test && <TestResult test={test} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <KeyLink href={NEXT} variant="text">
            Skip for now
          </KeyLink>
          {ready ? (
            <KeyLink href={NEXT}>Continue to students</KeyLink>
          ) : (
            <Key disabled aria-describedby="ai-why">
              Continue to students
            </Key>
          )}
        </div>
        {!ready && (
          <span id="ai-why" className="-mt-4 self-end text-sm text-muted-foreground">
            Notes are still saved without the AI. It reads them once it&apos;s ready.
          </span>
        )}
      </section>

      {missing.size || !health.reachable ? (
        <SetupAside label="Stuck?">
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md bg-surface text-ink-strong">
            <LifeBuoy className="size-6" strokeWidth={2.2} />
          </span>
          <h2 className="text-xl font-extrabold text-ink-strong">Stuck?</h2>
          <p className="text-base leading-normal">The download needs the internet once. After that the model lives on this laptop and works offline.</p>
          <p className="text-base leading-normal">{restartAi}</p>
        </SetupAside>
      ) : (
        <SetupAside label="Why this matters">
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md bg-surface text-ink-strong">
            <ShieldCheck className="size-6" strokeWidth={2.2} />
          </span>
          <h2 className="text-xl font-extrabold text-ink-strong">Why this matters</h2>
          <ul className="flex flex-col gap-3 text-base leading-normal">
            {[
              "Children's names, marks and notes stay on this laptop.",
              "The AI runs here, so it works without the internet.",
              "Nothing is sent until you press Send in WhatsApp yourself.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
                {line}
              </li>
            ))}
          </ul>
        </SetupAside>
      )}
    </SetupColumns>
  );
}

function EngineCard({ health, terminal, checking, onCheck }: { health: Health; terminal: { app: string; how: string }; checking: boolean; onCheck: () => void }) {
  if (!health.reachable) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border-2 border-caution-border bg-caution px-[18px] py-4 text-on-caution">
        <div className="flex items-center gap-4">
          <CircleAlert aria-hidden className="size-7 shrink-0" strokeWidth={2.4} />
          <span className="flex flex-col">
            <span className="text-[19px] font-extrabold">The AI engine is off</span>
            <span className="text-[15px]">
              Open the Ollama app, or type <code className="font-mono">ollama serve</code> in {terminal.app}. Then press Check again.
            </span>
          </span>
        </div>
        <Key className="self-start" onClick={onCheck} disabled={checking}>
          {checking ? "Checking…" : "Check again"}
        </Key>
      </div>
    );
  }
  if (!health.loopback) {
    return (
      <div role="status" className="flex items-center gap-4 rounded-md bg-danger px-[18px] py-4 text-on-danger">
        <ShieldAlert aria-hidden className="size-7 shrink-0" strokeWidth={2.4} />
        <span className="text-[17px] font-extrabold">AI runs outside this device — student data leaves this laptop.</span>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-4 rounded-md bg-sky-tint px-[18px] py-4">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-md bg-sky text-on-sky shadow-[0_3px_0_0_var(--sky-lip)]">
        <Cpu className="size-6" strokeWidth={2.4} />
      </span>
      <span className="flex min-w-0 flex-[1_1_200px] flex-col text-on-sky-tint">
        <span className="text-[19px] font-extrabold">AI engine running on this laptop</span>
        <span className="text-[15px]">Nothing about your students goes online</span>
      </span>
      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-sm bg-surface px-2.5 text-xs font-extrabold tracking-[0.6px] text-on-sky-tint uppercase">
        <Check aria-hidden className="size-4" strokeWidth={2.8} />
        Checked
      </span>
    </div>
  );
}

function TestResult({ test }: { test: NonNullable<Health["test"]> }) {
  if (test.error) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border-2 border-hairline bg-surface px-4 py-3.5 text-base font-extrabold text-on-highlight">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
        {TEST_ERRORS[test.error] ?? "The test didn't finish. Try again."}
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border-2 border-hairline bg-surface px-4 py-3.5">
      <span className={cn("flex items-center gap-2 text-base font-extrabold", test.ok ? "text-on-sky-tint" : "text-on-highlight")}>
        {test.ok ? <Check aria-hidden className="size-5" strokeWidth={2.8} /> : <TriangleAlert aria-hidden className="size-5" strokeWidth={2.4} />}
        {test.ok ? `Test passed in ${(test.ms / 1000).toFixed(1)} s` : "The sentence used a number that isn't in the note"}
      </span>
      <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[15px] leading-normal">
        <span className="text-muted-foreground">Note</span>
        <span className="text-ink">“{SAMPLE_NOTE}”</span>
        <span className="text-muted-foreground">Wrote</span>
        <span className="text-ink">“{test.wrote}”</span>
        <span className="text-muted-foreground">Numbers</span>
        {test.numbersOk ? (
          <span className="font-extrabold text-on-sky-tint">Checked — every number matches the note</span>
        ) : (
          <span className="font-extrabold text-on-highlight">Flagged — the test caught it, as it will in real updates</span>
        )}
      </div>
    </div>
  );
}
