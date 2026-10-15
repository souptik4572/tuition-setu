import { Ollama } from "ollama";
import { toAiError } from "./errors";
import { jsonSchemaFor, parseModelJson, type AIProvider, type GenerateObjectOpts, type StreamTextOpts, type Usage } from "./provider";

const KEEP_ALIVE = "15m";

/**
 * The local version's provider: Ollama on the laptop (§11.1). Every call gets its own client whose
 * fetch carries the call's abort signal. The client's own abort() only reaches streams that have
 * already started, so it can't time out a model that is still loading or a non-streamed call.
 */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  private capabilities = new Map<string, Promise<string[]>>();

  constructor(private readonly opts: { host: string; fetch?: typeof fetch }) {}

  client(signal?: AbortSignal): Ollama {
    const base = this.opts.fetch ?? fetch;
    return new Ollama({
      host: this.opts.host,
      fetch: (input, init) => {
        const signals = [signal, init?.signal].filter((s): s is AbortSignal => !!s);
        return base(input, { ...init, signal: signals.length ? AbortSignal.any(signals) : undefined });
      },
    });
  }

  /** `capabilities` from /api/show, cached per model: "vision", "thinking", … */
  capabilitiesOf(model: string, client = this.client()): Promise<string[]> {
    let pending = this.capabilities.get(model);
    if (!pending) {
      pending = client.show({ model }).then((r) => r.capabilities ?? []);
      pending.catch(() => this.capabilities.delete(model));
      this.capabilities.set(model, pending);
    }
    return pending;
  }

  // Thinking makes small models slow and wordy, and these tasks don't need it (§S8).
  private async thinkOff(model: string, client: Ollama) {
    return (await this.capabilitiesOf(model, client)).includes("thinking") ? { think: false as const } : {};
  }

  async generateObject<T>(opts: GenerateObjectOpts<T>) {
    const client = this.client(AbortSignal.timeout(opts.timeoutMs));
    const res = await client.chat({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt, images: opts.images },
      ],
      format: jsonSchemaFor(opts.schema),
      options: { temperature: opts.temperature },
      keep_alive: KEEP_ALIVE,
      ...(await this.thinkOff(opts.model, client)),
    });
    return { object: parseModelJson(res.message.content, opts.schema), usage: usageOf(res) };
  }

  streamText(opts: StreamTextOpts) {
    const cancel = new AbortController();
    const signal = AbortSignal.any([cancel.signal, AbortSignal.timeout(opts.timeoutMs)]);
    let settle!: { resolve: (u: Usage) => void; reject: (e: unknown) => void };
    const usage = new Promise<Usage>((resolve, reject) => (settle = { resolve, reject }));
    usage.catch(() => undefined); // the stream reports the same error to its reader

    const stream = new ReadableStream<string>({
      start: async (out) => {
        try {
          const client = this.client(signal);
          const parts = await client.chat({
            model: opts.model,
            messages: [
              { role: "system", content: opts.system },
              { role: "user", content: opts.prompt },
            ],
            stream: true,
            options: { temperature: opts.temperature },
            keep_alive: KEEP_ALIVE,
            ...(await this.thinkOff(opts.model, client)),
          });
          for await (const part of parts) {
            if (part.message.content) out.enqueue(part.message.content);
            if (part.done) settle.resolve(usageOf(part));
          }
          out.close();
        } catch (error) {
          const failure = toAiError(signal.reason ?? error);
          settle.reject(failure);
          out.error(failure);
        }
      },
      cancel: () => cancel.abort(new DOMException("The reader stopped", "AbortError")),
    });
    return { stream, usage };
  }
}

function usageOf(res: { prompt_eval_count?: number; eval_count?: number; total_duration?: number }): Usage {
  return {
    promptTokens: res.prompt_eval_count,
    completionTokens: res.eval_count,
    durationMs: Math.round((res.total_duration ?? 0) / 1e6),
  };
}
