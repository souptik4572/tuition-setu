import "server-only";
import type { z } from "zod";
import { insertAiRun } from "@/lib/db/queries/ai-runs";
import type { DbCtx } from "@/lib/db/types";
import { AiError, toAiError } from "./errors";
import type { AIProvider, ObjectTask, Usage } from "./provider";

export type RunMeta = {
  task: ObjectTask | "draft" | "health";
  provider: AIProvider["name"];
  model: string;
  promptVersion?: string;
  inputChars?: number;
};

/**
 * Writes one `ai_runs` row: metadata only (§10). There is no parameter for prompt or output text,
 * so content can't end up here. `ctx` is null for calls made before a workspace exists (setup's
 * AI check), which are not logged.
 */
export async function recordAiRun(ctx: DbCtx | null, meta: RunMeta, outcome: { durationMs: number; usage?: Usage; error?: AiError }) {
  if (!ctx) return;
  await insertAiRun(ctx, {
    task: meta.task,
    provider: meta.provider,
    model: meta.model,
    promptVersion: meta.promptVersion ?? null,
    inputChars: meta.inputChars ?? null,
    promptTokens: outcome.usage?.promptTokens ?? null,
    completionTokens: outcome.usage?.completionTokens ?? null,
    durationMs: outcome.durationMs,
    ok: !outcome.error,
    errorCode: outcome.error?.code ?? null,
  });
}

/** Every non-streamed model call goes through here: timed, logged, and failures mapped to an AiError (IMPL §3.4). */
export async function runAi<T>(ctx: DbCtx | null, meta: RunMeta, call: () => Promise<{ result: T; usage: Usage }>): Promise<T> {
  const started = Date.now();
  try {
    const { result, usage } = await call();
    await recordAiRun(ctx, meta, { durationMs: Date.now() - started, usage });
    return result;
  } catch (thrown) {
    const error = toAiError(thrown);
    await recordAiRun(ctx, meta, { durationMs: Date.now() - started, error });
    throw error;
  }
}

/**
 * A structured call with the one retry from §S4: when the reply isn't valid JSON or doesn't match
 * the schema, ask once more with the problem appended to the prompt. Each attempt is its own run.
 */
export async function generateStructured<T>(
  ctx: DbCtx | null,
  provider: AIProvider,
  opts: {
    task: ObjectTask;
    model: string;
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
    images?: string[];
    temperature: number;
    timeoutMs: number;
    promptVersion?: string;
    /** Logged task when it differs from the model task, e.g. the health check's sample extraction. */
    logAs?: RunMeta["task"];
  },
): Promise<T> {
  const attempt = (prompt: string) =>
    runAi(ctx, { task: opts.logAs ?? opts.task, provider: provider.name, model: opts.model, promptVersion: opts.promptVersion, inputChars: prompt.length }, async () => {
      const { object, usage } = await provider.generateObject({ ...opts, prompt });
      return { result: object, usage };
    });

  try {
    return await attempt(opts.prompt);
  } catch (error) {
    if (!(error instanceof AiError) || (error.code !== "invalid_json" && error.code !== "schema_mismatch")) throw error;
    const problem = error.code === "invalid_json" ? "it was not valid JSON" : `it did not match the schema:\n${error.message}`;
    return attempt(`${opts.prompt}\n\nYour previous reply could not be used because ${problem}\nReply again with JSON that matches the schema exactly.`);
  }
}
