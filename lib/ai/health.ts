import "server-only";
import { totalmem } from "node:os";
import type { DbCtx } from "@/lib/db/types";
import type { AiConfig } from "@/lib/schemas/settings";
import { ExtractionResult } from "@/lib/schemas/extraction";
import { todayIn } from "@/lib/util/dates";
import { extractNumbers } from "@/lib/util/digits";
import { isLoopbackHost } from "@/lib/util/lan";
import { AiError, toAiError, type AiErrorCode } from "./errors";
import { getProvider, modelFor, providerUrl, readingAlternates } from "./index";
import { DOWNLOAD_GB, QUALITY_MODE_MIN_RAM_GB, type ModelTask } from "./models";
import { OllamaProvider } from "./ollama";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { extractPrompt, EXTRACT_PROMPT_VERSION } from "./prompts/extract";
import { readText, type AIProvider } from "./provider";
import { generateStructured, recordAiRun } from "./run";

export type Health = {
  provider: AIProvider["name"];
  reachable: boolean;
  loopback: boolean; // false → red banner
  ramGb: number;
  models: { task: ModelTask; name: string; installed: boolean; sizeGb?: number }[];
  missing: { name: string; command: string }[];
  qualityModeAvailable: boolean;
  test?: { ok: boolean; ms: number; wrote: string; numbersOk: boolean; error?: AiErrorCode };
};

const TASKS: ModelTask[] = ["extract", "draft", "vision"];
const LIST_TIMEOUT_MS = 3_000;
const CACHE_MS = 30_000;

// "gemma4" and "gemma4:latest" are the same model to Ollama.
const withTag = (name: string) => (name.includes(":") ? name : `${name}:latest`);
const gb = (bytes: number) => Math.round((bytes / 1e9) * 10) / 10;

async function installedModels(provider: AIProvider): Promise<{ reachable: boolean; sizes: Map<string, number | undefined> | null }> {
  try {
    if (provider instanceof OllamaProvider) {
      const { models } = await provider.client(AbortSignal.timeout(LIST_TIMEOUT_MS)).list();
      return { reachable: true, sizes: new Map(models.map((m) => [withTag(m.name), gb(m.size)])) };
    }
    if (provider instanceof OpenAICompatibleProvider) {
      const ids = await provider.listModels(LIST_TIMEOUT_MS);
      // Some endpoints list nothing; then there's no way to tell, so don't report models as missing.
      return { reachable: true, sizes: ids.length ? new Map(ids.map((id) => [id, undefined])) : null };
    }
  } catch {
    // Unreachable: reported below.
  }
  return { reachable: false, sizes: new Map() };
}

let cache: { key: string; at: number; health: Health } | undefined;

/**
 * GET /api/ai/health (§3 B4, IMPL M3). The plain check is cached for 30 seconds because banners on
 * every page read it; `fresh` skips the cache (B4's "Check again" after a download), and `test`
 * always runs the sample note through both models.
 */
export async function getHealth(opts: { aiConfig?: AiConfig; test?: boolean; fresh?: boolean; ctx?: DbCtx | null } = {}): Promise<Health> {
  const names = Object.fromEntries(TASKS.map((t) => [t, modelFor(t, opts.aiConfig)])) as Record<ModelTask, string>;
  const key = JSON.stringify(names);
  if (!opts.test && !opts.fresh && cache?.key === key && Date.now() - cache.at < CACHE_MS) return cache.health;

  const provider = getProvider();
  const { reachable, sizes } = await installedModels(provider);
  const ollama = provider instanceof OllamaProvider;
  const models = TASKS.map((task) => {
    const name = names[task];
    const installed = sizes === null || sizes.has(ollama ? withTag(name) : name);
    return { task, name, installed, sizeGb: sizes?.get(withTag(name)) ?? DOWNLOAD_GB[name] };
  });
  const missingNames = reachable && ollama ? [...new Set(models.filter((m) => !m.installed).map((m) => m.name))] : [];
  const ramGb = Math.round((totalmem() / 2 ** 30) * 10) / 10;

  const health: Health = {
    provider: provider.name,
    reachable,
    loopback: isLoopbackHost(providerUrl()),
    ramGb,
    models,
    missing: missingNames.map((name) => ({ name, command: `ollama pull ${name}` })),
    qualityModeAvailable: ramGb > QUALITY_MODE_MIN_RAM_GB,
  };
  if (opts.test) {
    const ready = reachable && models.filter((m) => m.task !== "vision").every((m) => m.installed);
    health.test = ready
      ? await sampleTest(provider, names, opts.ctx ?? null)
      : { ok: false, ms: 0, wrote: "", numbersOk: false, error: reachable ? "model_missing" : "provider_unreachable" };
  } else {
    cache = { key, at: Date.now(), health };
  }
  return health;
}

const SAMPLE_NOTE = "Riya ch5 test 14/20";

/**
 * D1's "Try a sample note": reads one fictional line, writes one sentence, then checks that every
 * number in the sentence came from the note or was worked out from it. M9's guard replaces the
 * simple check here once it exists.
 */
async function sampleTest(provider: AIProvider, names: Record<ModelTask, string>, ctx: DbCtx | null): Promise<NonNullable<Health["test"]>> {
  const started = Date.now();
  try {
    const prompt = extractPrompt({ rawText: SAMPLE_NOTE, classDate: todayIn("Asia/Kolkata"), batch: null, roster: [{ fullName: "Riya Sen", aliases: [] }] });
    const result = await generateStructured(ctx, provider, {
      task: "extract",
      model: names.extract,
      schema: ExtractionResult,
      system: prompt.system,
      prompt: prompt.user,
      temperature: 0,
      timeoutMs: 120_000,
      promptVersion: EXTRACT_PROMPT_VERSION,
      logAs: "health",
    });
    const score = result.entries[0]?.assessments[0];
    if (score?.scored !== 14 || score.max !== 20) throw new AiError("schema_mismatch", "The sample score was not read as 14/20");

    const pct = Math.round((score.scored / score.max) * 100);
    const facts = `Student: Riya. Test: Chapter 5 test. Scored ${score.scored} out of ${score.max} (${pct}%).`;
    const wrote = (await writeSentence(provider, names.draft, facts, ctx)).trim();

    const allowed = new Set([5, score.scored, score.max, pct]);
    const numbersOk =
      wrote.length > 0 &&
      extractNumbers(wrote).every((t) => (t.kind === "pair" ? t.a === score.scored && t.b === score.max : t.kind === "percent" ? t.v === pct : allowed.has(t.v)));
    return { ok: numbersOk, ms: Date.now() - started, wrote, numbersOk };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, wrote: "", numbersOk: false, error: toAiError(error).code };
  }
}

async function writeSentence(provider: AIProvider, model: string, facts: string, ctx: DbCtx | null): Promise<string> {
  const started = Date.now();
  const system = "Write one short sentence for a parent about their child's test. Use only the facts given and write numbers with digits 0-9. No greeting.";
  const { stream, usage } = provider.streamText({ task: "draft", model, system, prompt: facts, temperature: 0.4, timeoutMs: 90_000 });
  try {
    const text = await readText(stream);
    await recordAiRun(ctx, { task: "health", provider: provider.name, model, inputChars: facts.length }, { durationMs: Date.now() - started, usage: await usage });
    return text;
  } catch (error) {
    await recordAiRun(ctx, { task: "health", provider: provider.name, model, inputChars: facts.length }, { durationMs: Date.now() - started, error: toAiError(error) });
    throw error;
  }
}

/**
 * Another installed model that can read notes, for a note that failed with the current one
 * (§4.1, F2). Tags with the same digest are the same model, so they don't count. `faster` when
 * it's smaller than the current model. Null when there's none, or the provider can't list models.
 */
export async function alternateModel(aiConfig?: AiConfig): Promise<{ name: string; faster: boolean } | null> {
  const provider = getProvider();
  if (!(provider instanceof OllamaProvider)) return null;
  try {
    const { models } = await provider.client(AbortSignal.timeout(LIST_TIMEOUT_MS)).list();
    const byName = new Map(models.map((m) => [withTag(m.name), m]));
    const current = byName.get(withTag(modelFor("extract", aiConfig)));
    for (const name of readingAlternates()) {
      const other = byName.get(withTag(name));
      if (other && other.digest !== current?.digest) return { name: withTag(name), faster: !!current && other.size < current.size * 0.9 };
    }
  } catch {
    // The engine is off: there's nothing to offer.
  }
  return null;
}
