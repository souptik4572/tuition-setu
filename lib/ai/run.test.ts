import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Ctx } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { aiRuns } from "@/lib/db/schema";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { AiError } from "./errors";
import type { AIProvider, GenerateObjectOpts } from "./provider";
import { generateStructured, runAi } from "./run";

async function workspace(): Promise<Ctx> {
  const userId = crypto.randomUUID();
  const ids = await createWorkspaceWithOwner(WorkspaceSettings.parse({ name: "W", defaultLanguage: "en", tone: "warm", reportDay: 0 }), { userId, displayName: "M", signature: "M" });
  return { ...ids, userId, role: "owner" };
}
const runsOf = async (ctx: Ctx) => (await withDb(ctx, (db) => db.select().from(aiRuns))).filter((r) => r.workspaceId === ctx.workspaceId);

/** A provider whose generateObject replies are scripted, one per call. */
function scripted(replies: (unknown | Error)[]) {
  const prompts: string[] = [];
  const provider: AIProvider = {
    name: "ollama",
    async generateObject<T>(opts: GenerateObjectOpts<T>) {
      prompts.push(opts.prompt);
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return { object: opts.schema.parse(next), usage: { promptTokens: 11, completionTokens: 3, durationMs: 5 } };
    },
    streamText: () => {
      throw new Error("not used");
    },
  };
  return { provider, prompts };
}

const Score = z.object({ scored: z.number() });
const call = { task: "extract" as const, model: "gemma4:e2b", schema: Score, system: "SECRET SYSTEM PROMPT", prompt: "Riya ch5 test 14/20", temperature: 0, timeoutMs: 1000, promptVersion: "v1" };

describe("runAi", () => {
  it("logs model, task, tokens and duration, and never the prompt or the reply", async () => {
    const ctx = await workspace();
    const result = await runAi(ctx, { task: "extract", provider: "ollama", model: "gemma4:e2b", promptVersion: "v1", inputChars: 19 }, async () => ({
      result: { scored: 14, note: "Riya ch5 test 14/20" },
      usage: { promptTokens: 120, completionTokens: 30, durationMs: 900 },
    }));
    expect(result.scored).toBe(14);

    const [run] = await runsOf(ctx);
    expect(run).toMatchObject({ task: "extract", provider: "ollama", model: "gemma4:e2b", promptVersion: "v1", inputChars: 19, promptTokens: 120, completionTokens: 30, ok: true, errorCode: null, memberId: ctx.memberId });
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(run)).not.toMatch(/Riya|14\/20/);
  });

  it("logs a failure with its code and rethrows it as an AiError", async () => {
    const ctx = await workspace();
    const timeout = new DOMException("The operation timed out", "TimeoutError");
    await expect(runAi(ctx, { task: "draft", provider: "ollama", model: "m" }, () => Promise.reject(timeout))).rejects.toMatchObject({ code: "timeout" });
    expect(await runsOf(ctx)).toMatchObject([{ ok: false, errorCode: "timeout" }]);
  });

  it("logs nothing before a workspace exists", async () => {
    await expect(runAi(null, { task: "health", provider: "ollama", model: "m" }, async () => ({ result: 1, usage: { durationMs: 1 } }))).resolves.toBe(1);
  });
});

describe("generateStructured", () => {
  it("retries exactly once on invalid JSON, telling the model what was wrong", async () => {
    const ctx = await workspace();
    const { provider, prompts } = scripted([new AiError("invalid_json"), { scored: 14 }]);
    expect(await generateStructured(ctx, provider, call)).toEqual({ scored: 14 });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("was not valid JSON");
    expect((await runsOf(ctx)).map((r) => r.errorCode)).toEqual(expect.arrayContaining([null, "invalid_json"]));
  });

  it("fails with invalid_json after the second bad reply", async () => {
    const ctx = await workspace();
    const { provider, prompts } = scripted([new AiError("invalid_json"), new AiError("invalid_json"), { scored: 1 }]);
    await expect(generateStructured(ctx, provider, call)).rejects.toMatchObject({ code: "invalid_json" });
    expect(prompts).toHaveLength(2);
  });

  it("includes the schema problem in the retry", async () => {
    const { provider, prompts } = scripted([new AiError("schema_mismatch", "✖ expected number at scored"), { scored: 2 }]);
    await generateStructured(null, provider, call);
    expect(prompts[1]).toContain("expected number at scored");
  });

  it("does not retry a timeout or a missing model", async () => {
    for (const code of ["timeout", "model_missing"] as const) {
      const { provider, prompts } = scripted([new AiError(code), { scored: 1 }]);
      await expect(generateStructured(null, provider, call)).rejects.toMatchObject({ code });
      expect(prompts).toHaveLength(1);
    }
  });
});
