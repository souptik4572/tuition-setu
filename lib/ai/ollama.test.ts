import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiError, toAiError } from "./errors";
import { OllamaProvider } from "./ollama";
import { readText } from "./provider";
import { fakeFetch, hang, json, ndjson } from "./test-fetch";

const Score = z.object({ scored: z.number(), max: z.number().nullable() });
const opts = { task: "extract" as const, model: "gemma4:e2b", system: "sys", prompt: "Riya 14/20", schema: Score, temperature: 0, timeoutMs: 1_000 };
const reply = (content: string) => json({ message: { role: "assistant", content }, done: true, prompt_eval_count: 40, eval_count: 9, total_duration: 2_500_000_000 });

describe("OllamaProvider.generateObject", () => {
  it("sends the JSON schema, temperature and keep_alive, and returns the validated object with usage", async () => {
    const f = fakeFetch({ "/api/show": () => json({ capabilities: ["completion"] }), "/api/chat": () => reply('{"scored":14,"max":20}') });
    const result = await new OllamaProvider({ host: "http://127.0.0.1:11434", fetch: f.fetch }).generateObject(opts);

    expect(result).toEqual({ object: { scored: 14, max: 20 }, usage: { promptTokens: 40, completionTokens: 9, durationMs: 2500 } });
    const chat = f.calls.find((c) => c.path === "/api/chat")!.body;
    expect(chat).toMatchObject({ model: "gemma4:e2b", stream: false, keep_alive: "15m", options: { temperature: 0 } });
    expect(chat.format).toMatchObject({ type: "object", required: ["scored", "max"] });
    expect(chat.format).not.toHaveProperty("$schema");
    expect(chat).not.toHaveProperty("think");
  });

  it("turns thinking off only for models that think", async () => {
    const f = fakeFetch({ "/api/show": () => json({ capabilities: ["completion", "thinking"] }), "/api/chat": () => reply('{"scored":1,"max":2}') });
    await new OllamaProvider({ host: "http://127.0.0.1:11434", fetch: f.fetch }).generateObject(opts);
    expect(f.calls.find((c) => c.path === "/api/chat")!.body.think).toBe(false);
  });

  it("reports invalid JSON and schema mismatches with their own codes", async () => {
    const bad = (content: string) => new OllamaProvider({ host: "http://x:1", fetch: fakeFetch({ "/api/show": () => json({ capabilities: [] }), "/api/chat": () => reply(content) }).fetch });
    await expect(bad("not json").generateObject(opts)).rejects.toMatchObject({ code: "invalid_json" });
    await expect(bad('{"scored":"fourteen","max":20}').generateObject(opts)).rejects.toMatchObject({ code: "schema_mismatch" });
  });

  it("times out a call that never answers, even before a response starts", async () => {
    const provider = new OllamaProvider({ host: "http://x:1", fetch: fakeFetch({ "/api/show": hang, "/api/chat": hang }).fetch });
    const error = await provider.generateObject({ ...opts, timeoutMs: 50 }).catch((e) => e);
    expect(toAiError(error).code).toBe("timeout");
  });

  it("reports a model that isn't pulled as model_missing", async () => {
    const provider = new OllamaProvider({ host: "http://x:1", fetch: fakeFetch({ "/api/show": () => json({ error: "model 'gemma4:e2b' not found" }, 404) }).fetch });
    const error = await provider.generateObject(opts).catch((e) => e);
    expect(toAiError(error).code).toBe("model_missing");
  });
});

describe("OllamaProvider.streamText", () => {
  const draft = { task: "draft" as const, model: "gemma4:e2b", system: "sys", prompt: "facts", temperature: 0.4, timeoutMs: 1_000 };

  it("streams text and resolves usage from the final part", async () => {
    const f = fakeFetch({
      "/api/show": () => json({ capabilities: ["thinking"] }),
      "/api/chat": () =>
        ndjson([
          { message: { content: "Riya scored " }, done: false },
          { message: { content: "14/20." }, done: false },
          { message: { content: "" }, done: true, prompt_eval_count: 30, eval_count: 6, total_duration: 1_000_000_000 },
        ]),
    });
    const { stream, usage } = new OllamaProvider({ host: "http://x:1", fetch: f.fetch }).streamText(draft);
    const pieces: string[] = [];
    expect(await readText(stream, (c) => pieces.push(c))).toBe("Riya scored 14/20.");
    expect(pieces).toEqual(["Riya scored ", "14/20."]);
    expect(await usage).toEqual({ promptTokens: 30, completionTokens: 6, durationMs: 1000 });
    expect(f.calls.find((c) => c.path === "/api/chat")!.body).toMatchObject({ stream: true, think: false });
  });

  it("errors the stream and the usage with timeout when the model doesn't answer", async () => {
    const { stream, usage } = new OllamaProvider({ host: "http://x:1", fetch: fakeFetch({ "/api/show": () => json({ capabilities: [] }), "/api/chat": hang }).fetch }).streamText({ ...draft, timeoutMs: 50 });
    await expect(readText(stream)).rejects.toMatchObject({ code: "timeout" });
    await expect(usage).rejects.toBeInstanceOf(AiError);
  });

  it("aborts the request when the reader cancels (Stop)", async () => {
    let aborted = false;
    const f = fakeFetch({
      "/api/show": () => json({ capabilities: [] }),
      "/api/chat": (_b, init) => {
        init.signal?.addEventListener("abort", () => (aborted = true));
        return hang(_b, init);
      },
    });
    const { stream, usage } = new OllamaProvider({ host: "http://x:1", fetch: f.fetch }).streamText(draft);
    const reader = stream.getReader();
    await new Promise((r) => setTimeout(r, 20));
    await reader.cancel();
    await expect(usage).rejects.toMatchObject({ code: "cancelled" });
    expect(aborted).toBe(true);
  });
});
