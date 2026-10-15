import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toAiError } from "./errors";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { readText } from "./provider";
import { fakeFetch, hang, json } from "./test-fetch";

const Score = z.object({ scored: z.number(), max: z.number().nullable() });
const opts = { task: "extract" as const, model: "gemma-4-e2b", system: "Output JSON.", prompt: "Riya 14/20", schema: Score, temperature: 0, timeoutMs: 1_000 };
const completion = (content: string) =>
  json({ id: "x", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 8, total_tokens: 58 } });

describe("OpenAICompatibleProvider.generateObject", () => {
  it("asks for strict JSON-schema output and validates the reply", async () => {
    const f = fakeFetch({ "/v1/chat/completions": () => completion('{"scored":14,"max":20}') });
    const result = await new OpenAICompatibleProvider({ baseURL: "https://ai.example.com/v1", fetch: f.fetch }).generateObject(opts);
    expect(result.object).toEqual({ scored: 14, max: 20 });
    expect(result.usage).toMatchObject({ promptTokens: 50, completionTokens: 8 });
    expect(f.calls[0].body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "extract", strict: true } });
  });

  it("falls back to JSON mode once when the endpoint rejects json_schema, and remembers that per model", async () => {
    let first = true;
    const f = fakeFetch({
      "/v1/chat/completions": (body) => {
        if ((body.response_format as { type: string }).type === "json_schema" && first) {
          first = false;
          return json({ error: { message: "response_format json_schema is not supported", type: "invalid_request_error" } }, 400);
        }
        return completion('{"scored":14,"max":20}');
      },
    });
    const provider = new OpenAICompatibleProvider({ baseURL: "https://ai.example.com/v1", fetch: f.fetch });
    await provider.generateObject(opts);
    await provider.generateObject(opts);

    expect(f.calls.map((c) => (c.body.response_format as { type: string }).type)).toEqual(["json_schema", "json_object", "json_object"]);
    const system = (f.calls[1].body.messages as { content: string }[])[0].content;
    expect(system).toContain("matches this JSON Schema");
  });

  it("passes other bad requests through instead of switching modes", async () => {
    const f = fakeFetch({ "/v1/chat/completions": () => json({ error: { message: "context length exceeded" } }, 400) });
    const error = await new OpenAICompatibleProvider({ baseURL: "https://ai.example.com/v1", fetch: f.fetch }).generateObject(opts).catch((e) => e);
    expect(toAiError(error).code).toBe("provider_error");
    expect(f.calls).toHaveLength(1);
  });

  it("maps a timeout, a missing model and a rate limit", async () => {
    const provider = (route: Parameters<typeof fakeFetch>[0][string]) => new OpenAICompatibleProvider({ baseURL: "https://ai.example.com/v1", fetch: fakeFetch({ "/v1/chat/completions": route }).fetch });
    expect(toAiError(await provider(hang).generateObject({ ...opts, timeoutMs: 50 }).catch((e) => e)).code).toBe("timeout");
    expect(toAiError(await provider(() => json({ error: { message: "no such model" } }, 404)).generateObject(opts).catch((e) => e)).code).toBe("model_missing");
    expect(toAiError(await provider(() => json({ error: { message: "slow down" } }, 429)).generateObject(opts).catch((e) => e)).code).toBe("quota");
  });
});

describe("OpenAICompatibleProvider.streamText", () => {
  it("streams deltas and reads usage from the last chunk", async () => {
    const sse = ["Riya ", "scored 14/20."].map((t) => ({ id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta: { content: t }, finish_reason: null }] }));
    const last = { id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } };
    const body = [...sse, last].map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
    const f = fakeFetch({ "/v1/chat/completions": () => new Response(body, { headers: { "content-type": "text/event-stream" } }) });
    const { stream, usage } = new OpenAICompatibleProvider({ baseURL: "https://ai.example.com/v1", fetch: f.fetch }).streamText({ task: "draft", model: "m", system: "s", prompt: "p", temperature: 0.4, timeoutMs: 1_000 });
    expect(await readText(stream)).toBe("Riya scored 14/20.");
    expect(await usage).toMatchObject({ promptTokens: 20, completionTokens: 5 });
    expect(f.calls[0].body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });
});
