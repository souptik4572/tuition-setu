import type { z } from "zod";

export type Usage = { promptTokens?: number; completionTokens?: number; durationMs: number };

export interface AIProvider {
  generateObject<T>(opts: {
    task: "extract" | "transcribe";
    model: string;
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    images?: string[]; // base64, transcription only
    temperature: number;
    timeoutMs: number;
  }): Promise<{ object: T; usage: Usage }>;

  streamText(opts: {
    task: "draft";
    model: string;
    system: string;
    prompt: string;
    temperature: number;
    timeoutMs: number;
  }): { stream: ReadableStream<string>; usage: Promise<Usage> };
}
