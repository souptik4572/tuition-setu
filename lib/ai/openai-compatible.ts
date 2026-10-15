import OpenAI from "openai";
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { toAiError } from "./errors";
import { jsonSchemaFor, parseModelJson, type AIProvider, type GenerateObjectOpts, type StreamTextOpts, type Usage } from "./provider";

/**
 * The hosted version's provider: any OpenAI-compatible endpoint serving an open-weight model
 * (§19.8). Strict JSON-schema output where the endpoint supports it; otherwise JSON mode with the
 * schema in the prompt. Zod validates the reply either way.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";
  private readonly client: OpenAI;
  private readonly jsonModeOnly = new Set<string>();

  constructor(opts: { baseURL: string; apiKey?: string; fetch?: typeof fetch }) {
    // maxRetries 0: a retry is a second model call, and those are counted against the quotas.
    this.client = new OpenAI({ baseURL: opts.baseURL, apiKey: opts.apiKey || "not-needed", fetch: opts.fetch, maxRetries: 0 });
  }

  /** Model ids the endpoint lists, for the health check. */
  async listModels(timeoutMs: number): Promise<string[]> {
    const ids: string[] = [];
    for await (const model of this.client.models.list({ timeout: timeoutMs })) ids.push(model.id);
    return ids;
  }

  async generateObject<T>(opts: GenerateObjectOpts<T>) {
    const started = Date.now();
    const schema = jsonSchemaFor(opts.schema);
    const user: string | ChatCompletionContentPart[] = opts.images?.length
      ? [{ type: "text", text: opts.prompt }, ...opts.images.map((b64) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } }))]
      : opts.prompt;
    const ask = (system: string, responseFormat: OpenAI.ChatCompletionCreateParams["response_format"]) => {
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: system },
        { role: "user", content: user },
      ];
      return this.client.chat.completions.create({ model: opts.model, messages, temperature: opts.temperature, response_format: responseFormat }, { timeout: opts.timeoutMs });
    };

    let res: OpenAI.ChatCompletion | undefined;
    if (!this.jsonModeOnly.has(opts.model)) {
      try {
        res = await ask(opts.system, { type: "json_schema", json_schema: { name: opts.task, schema, strict: true } });
      } catch (error) {
        if (!(error instanceof OpenAI.BadRequestError && /response_format|json_schema|schema/i.test(error.message))) throw error;
        this.jsonModeOnly.add(opts.model);
      }
    }
    res ??= await ask(`${opts.system}\n\nReply with JSON that matches this JSON Schema:\n${JSON.stringify(schema)}`, { type: "json_object" });

    return {
      object: parseModelJson(res.choices[0]?.message.content ?? "", opts.schema),
      usage: { promptTokens: res.usage?.prompt_tokens, completionTokens: res.usage?.completion_tokens, durationMs: Date.now() - started },
    };
  }

  streamText(opts: StreamTextOpts) {
    const started = Date.now();
    const cancel = new AbortController();
    let settle!: { resolve: (u: Usage) => void; reject: (e: unknown) => void };
    const usage = new Promise<Usage>((resolve, reject) => (settle = { resolve, reject }));
    usage.catch(() => undefined); // the stream reports the same error to its reader

    const stream = new ReadableStream<string>({
      start: async (out) => {
        try {
          const chunks = await this.client.chat.completions.create(
            {
              model: opts.model,
              messages: [
                { role: "system", content: opts.system },
                { role: "user", content: opts.prompt },
              ],
              temperature: opts.temperature,
              stream: true,
              stream_options: { include_usage: true },
            },
            { timeout: opts.timeoutMs, signal: cancel.signal },
          );
          let tokens: Omit<Usage, "durationMs"> = {};
          for await (const chunk of chunks) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) out.enqueue(text);
            if (chunk.usage) tokens = { promptTokens: chunk.usage.prompt_tokens, completionTokens: chunk.usage.completion_tokens };
          }
          settle.resolve({ ...tokens, durationMs: Date.now() - started });
          out.close();
        } catch (error) {
          const failure = toAiError(error);
          settle.reject(failure);
          out.error(failure);
        }
      },
      cancel: () => cancel.abort(),
    });
    return { stream, usage };
  }
}
