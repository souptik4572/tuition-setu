import { z } from "zod";
import { AiError } from "./errors";

export type Usage = { promptTokens?: number; completionTokens?: number; durationMs: number };

export type ObjectTask = "extract" | "transcribe";

export type GenerateObjectOpts<T> = {
  task: ObjectTask;
  model: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  images?: string[]; // base64, transcription only
  temperature: number;
  timeoutMs: number;
};

export type StreamTextOpts = {
  task: "draft";
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  timeoutMs: number;
};

/** SPEC §11.1. Cancelling the returned stream aborts the request. */
export interface AIProvider {
  readonly name: "ollama" | "openai-compatible";
  generateObject<T>(opts: GenerateObjectOpts<T>): Promise<{ object: T; usage: Usage }>;
  streamText(opts: StreamTextOpts): { stream: ReadableStream<string>; usage: Promise<Usage> };
}

/** The JSON Schema sent to the model. `$schema` is dropped: strict OpenAI-style endpoints reject unknown keywords. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Reads a whole text stream, calling `onChunk` as each piece arrives. */
export async function readText(stream: ReadableStream<string>, onChunk?: (chunk: string) => void): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    text += next.value;
    onChunk?.(next.value);
  }
  return text;
}

/** Parses and validates a model's JSON reply, failing with the codes generateStructured retries on. */
export function parseModelJson<T>(text: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("invalid_json", "The reply was not valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AiError("schema_mismatch", z.prettifyError(parsed.error));
  return parsed.data;
}
