import { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from "openai";

export type AiErrorCode =
  | "timeout"
  | "invalid_json"
  | "schema_mismatch"
  | "provider_unreachable"
  | "model_missing"
  | "quota"
  | "cancelled"
  | "provider_error";

/** A failed model call. Only `code` is logged (`ai_runs.error_code`); messages may name a model, never note text. */
export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message?: string,
    options?: { cause?: unknown },
  ) {
    super(message ?? code, options);
    this.name = "AiError";
  }
}

type Failure = { name?: string; message?: string; status?: number; status_code?: number; cause?: { code?: string } };

/** Maps what the ollama and openai clients throw onto the codes the UI understands (§4.3, F2). */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const e = (typeof error === "object" && error !== null ? error : {}) as Failure;
  const status = e.status ?? e.status_code;
  const wrap = (code: AiErrorCode) => new AiError(code, e.message, { cause: error });

  // The openai classes all have name "Error", so they're told apart with instanceof (timeout first: it's a subclass).
  if (e.name === "TimeoutError" || error instanceof APIConnectionTimeoutError) return wrap("timeout");
  if (e.name === "AbortError" || error instanceof APIUserAbortError) return wrap("cancelled");
  if (error instanceof APIConnectionError || (e.name === "TypeError" && /fetch failed/i.test(e.message ?? ""))) return wrap("provider_unreachable");
  if (status === 404) return wrap("model_missing");
  if (status === 429) return wrap("quota");
  if (e.name === "SyntaxError") return wrap("invalid_json");
  if (e.name === "ZodError") return wrap("schema_mismatch");
  return wrap("provider_error");
}
