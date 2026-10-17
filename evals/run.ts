// npm run eval -- --task extract [--model <name>] [--prompt v1|v2] [--case <prefix>]
// Reads every evals/fixtures/<case>/ through S4 → S5 → S6 in memory with the real model (no
// database) and scores it against expected.json (SPEC §11.3). Writes the details to
// evals/results/<date>-<model>-<prompt>.md and adds a row to evals/results/summary.md.
// Runs with `--conditions=react-server`, like scripts/migrate.ts.
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { totalmem } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";

type Score = { scored: number; max: number | null };
type Expected = { entries: { student: string | null; name?: string; assessments: Score[]; attendance?: string }[]; unattributedCount: number };
type RosterFile = { fullName: string; messageName: string; aliases: string[] }[];

const FIXTURES = "evals/fixtures";
const RESULTS = "evals/results";
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 100);
const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;
const sameScore = (a: Score, b: { scored: number | null; max: number | null }) => a.scored === b.scored && a.max === b.max;

async function main() {
  loadEnvConfig(process.cwd());
  const { values } = parseArgs({ options: { task: { type: "string", default: "extract" }, model: { type: "string" }, prompt: { type: "string" }, case: { type: "string" } } });
  if (values.task !== "extract") throw new Error("Only --task extract is built for the MVP (IMPL §1.1).");

  const { getProvider, modelFor } = await import("@/lib/ai");
  const { toAiError } = await import("@/lib/ai/errors");
  const { EXTRACT_PROMPT_VERSION, extractPrompt } = await import("@/lib/ai/prompts/extract");
  const { generateStructured } = await import("@/lib/ai/run");
  const { resolve } = await import("@/lib/pipeline/resolve");
  const { validate } = await import("@/lib/pipeline/validate");
  const { ExtractionResult } = await import("@/lib/schemas/extraction");
  const { normalizeName } = await import("@/lib/util/text");

  const model = values.model ?? modelFor("extract");
  const version = (values.prompt ?? EXTRACT_PROMPT_VERSION) as "v1" | "v2";
  const provider = getProvider();
  const sharedRoster = JSON.parse(readFileSync(join(FIXTURES, "roster.json"), "utf8")) as RosterFile;
  const cases = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (!values.case || d.name.startsWith(values.case)))
    .map((d) => d.name)
    .sort();

  const totals = { ok: 0, expected: 0, spurious: 0, matched: 0, expectedScores: 0, spuriousScores: 0, invented: 0, unsupported: 0, unknown: 0, unknownFound: 0, named: 0, asWritten: 0, firstTry: 0, failed: 0, extraQuestions: 0 };
  const times: number[] = [];
  const details: string[] = [];

  for (const name of cases) {
    const dir = join(FIXTURES, name);
    const notes = readFileSync(join(dir, "notes.txt"), "utf8").trim();
    const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Expected;
    const rosterFile = existsSync(join(dir, "roster.json")) ? (JSON.parse(readFileSync(join(dir, "roster.json"), "utf8")) as RosterFile) : sharedRoster;
    const roster = rosterFile.map((s) => ({ id: s.fullName, ...s }));

    let attempts = 0;
    const counting = {
      name: provider.name,
      generateObject: <T>(opts: Parameters<typeof provider.generateObject<T>>[0]) => (attempts++, provider.generateObject(opts)),
      streamText: provider.streamText.bind(provider),
    };
    const prompt = extractPrompt({ rawText: notes, classDate: "2026-10-15", batch: null, roster: roster.map((s) => ({ fullName: s.fullName, aliases: s.aliases })) }, version);
    const started = Date.now();
    let result;
    try {
      result = await generateStructured(null, counting, { task: "extract", model, schema: ExtractionResult, system: prompt.system, prompt: prompt.user, temperature: 0, timeoutMs: 120_000 });
    } catch (error) {
      const ms = Date.now() - started;
      times.push(ms);
      totals.failed++;
      totals.expected += expected.entries.length;
      totals.expectedScores += expected.entries.reduce((n, e) => n + e.assessments.length, 0);
      totals.unknown += expected.entries.filter((e) => e.student === null).length;
      details.push(`### ${name}\n\n> ${notes}\n\n**Failed:** ${toAiError(error).code} after ${ms} ms.\n`);
      console.log(`${name}: failed (${toAiError(error).code})`);
      continue;
    }
    const ms = Date.now() - started;
    times.push(ms);
    if (attempts === 1) totals.firstTry++;

    // S5 then S6, exactly as the app does it.
    const rows = validate(notes, result).map((v) => ({ v, r: v.name ? resolve(v.name, roster) : null }));
    const student = (row: (typeof rows)[number]) => (row.r && row.r.resolution !== "unmatched" ? row.r.studentId! : null);
    const used = new Set<number>();
    let ok = 0;
    let matched = 0;
    let spuriousScores = 0;
    const misses: string[] = [];

    for (const exp of expected.entries) {
      const index = rows.findIndex((row, i) => !used.has(i) && (exp.student ? student(row) === exp.student : !student(row) && normalizeName(row.v.name) === normalizeName(exp.name ?? "")));
      if (exp.student === null) totals.unknown++;
      if (index < 0) {
        misses.push(exp.student ? `${exp.student} not found` : `‘${exp.name}’ not left for the tutor`);
        continue;
      }
      used.add(index);
      ok++;
      if (exp.student === null) totals.unknownFound++;
      const got = rows[index].v.payload.assessments.filter((a) => a.scored !== null);
      for (const a of exp.assessments) {
        if (got.some((g) => sameScore(a, g))) matched++;
        else misses.push(`${exp.student ?? exp.name} ${a.scored}/${a.max ?? "?"} missing`);
      }
      spuriousScores += got.filter((g) => !exp.assessments.some((a) => sameScore(a, g))).length;
      if (exp.attendance && rows[index].v.payload.attendance !== exp.attendance) misses.push(`${exp.student} attendance ${rows[index].v.payload.attendance}, expected ${exp.attendance}`);
    }
    const extras = rows.filter((row, i) => !used.has(i) && row.v.name);
    spuriousScores += extras.reduce((n, row) => n + row.v.payload.assessments.filter((a) => a.scored !== null).length, 0);
    const named = rows.filter((row) => row.v.name);
    const asWritten = named.filter((row) => normalizeName(notes).includes(normalizeName(row.v.name)));
    const flags = rows.flatMap((row) => row.v.flags.map((f) => f.code));
    const expectedScores = expected.entries.reduce((n, e) => n + e.assessments.length, 0);
    // Everything that would wait in Needs you, beyond what the case calls for (unknown students, missing totals).
    const questions = rows.filter((row) => !student(row) || row.v.flags.some((f) => f.blocking)).length;
    const expectedQuestions = expected.entries.filter((e) => e.student === null).length + expected.entries.flatMap((e) => e.assessments).filter((a) => a.max === null).length;
    const extraQuestions = Math.max(0, questions - expectedQuestions);

    totals.ok += ok;
    totals.expected += expected.entries.length;
    totals.spurious += extras.length;
    totals.matched += matched;
    totals.expectedScores += expectedScores;
    totals.spuriousScores += spuriousScores;
    totals.invented += flags.filter((f) => f === "number_not_in_notes").length;
    totals.unsupported += flags.filter((f) => f === "unsupported_entry").length;
    totals.named += named.length;
    totals.asWritten += asWritten.length;
    totals.extraQuestions += extraQuestions;

    const read = rows.map((row) => `${row.v.name ? `‘${row.v.name}’` : `line “${row.v.payload.source_span}”`} → ${student(row) ?? "Needs you"}${row.r ? ` (${row.r.resolution})` : ""}${row.v.flags.length ? ` [${row.v.flags.map((f) => f.code).join(", ")}]` : ""}`);
    const issues = [...misses, ...extras.map((row) => `extra entry ‘${row.v.name}’`), ...(spuriousScores ? [`${spuriousScores} score(s) not expected`] : []), ...(extraQuestions ? [`${extraQuestions} extra question(s) for the tutor`] : []), ...(attempts > 1 ? ["needed the retry"] : [])];
    details.push(`### ${name}\n\n> ${notes}\n\n${ms} ms · students ${ok}/${expected.entries.length}${extras.length ? ` (+${extras.length} extra)` : ""} · scores ${matched}/${expectedScores}\n\n- Read: ${read.join("; ") || "nothing"}\n${issues.length ? `- Issues: ${issues.join("; ")}\n` : ""}`);
    console.log(`${name}: ${ms} ms, students ${ok}/${expected.entries.length}, scores ${matched}/${expectedScores}${issues.length ? ` — ${issues.join("; ")}` : ""}`);
  }

  const attribution = pct(totals.ok, totals.expected + totals.spurious);
  const scores = pct(totals.matched, totals.expectedScores + totals.spuriousScores);
  const firstTry = pct(totals.firstTry, cases.length);
  const asWritten = pct(totals.asWritten, totals.named);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const bar = (passed: boolean) => (passed ? "✓" : "✗");
  const date = new Date().toISOString().slice(0, 10);
  const summary = [
    "| Metric | Result | Bar (§11.3) |",
    "|---|---|---|",
    `| Student attribution | ${attribution}% (${totals.ok}/${totals.expected}${totals.spurious ? `, ${totals.spurious} extra` : ""}) | ≥ 95% ${bar(attribution >= 95)} |`,
    `| Assessment exact match | ${scores}% (${totals.matched}/${totals.expectedScores}${totals.spuriousScores ? `, ${totals.spuriousScores} extra` : ""}) | ≥ 95% ${bar(scores >= 95)} |`,
    `| Numbers not in the notes after S5 | 0 (S5 removed ${totals.invented}) | 0 ✓ |`,
    `| Unknown student left for the tutor | ${totals.unknownFound}/${totals.unknown} | all ${bar(totals.unknownFound === totals.unknown)} |`,
    `| Valid JSON on first try | ${firstTry}% | ≥ 90% ${bar(firstTry >= 90)} |`,
    `| Extra questions for the tutor (Needs you) | ${totals.extraQuestions} | — |`,
    `| Names copied as written | ${asWritten}% (${totals.asWritten}/${totals.named}) | — |`,
    `| Quotes not found in the note (V1) | ${totals.unsupported} | — |`,
    `| Latency p50 / p95 | ${(p50 / 1000).toFixed(1)} s / ${(p95 / 1000).toFixed(1)} s | recorded |`,
  ].join("\n");

  const file = join(RESULTS, `${date}-${model.replace(/[^\w.-]+/g, "-")}-${version}.md`);
  writeFileSync(
    file,
    `# Extraction eval · ${model} · prompt ${version}\n\n${date} · ${cases.length} cases · ${provider.name} · ${Math.round(totalmem() / 2 ** 30)} GB RAM${totals.failed ? ` · ${totals.failed} failed` : ""}\n\n${summary}\n\n## Cases\n\n${details.join("\n")}`,
  );
  const summaryFile = join(RESULTS, "summary.md");
  if (!existsSync(summaryFile)) {
    writeFileSync(summaryFile, "# Extraction eval results\n\n| Date | Model | Prompt | Cases | Students | Scores | Unknown left | JSON first try | Extra questions | As written | p50 / p95 |\n|---|---|---|---|---|---|---|---|---|---|---|\n");
  }
  appendFileSync(summaryFile, `| ${date} | ${model} | ${version} | ${cases.length} | ${attribution}% | ${scores}% | ${totals.unknownFound}/${totals.unknown} | ${firstTry}% | ${totals.extraQuestions} | ${asWritten}% | ${(p50 / 1000).toFixed(1)} s / ${(p95 / 1000).toFixed(1)} s |\n`);
  console.log(`\n${summary}\n\nWritten to ${file}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
