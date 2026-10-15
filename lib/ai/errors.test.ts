import { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { describe, expect, it } from "vitest";
import { AiError, toAiError } from "./errors";
import { modelFor } from "./index";
import { DEFAULT_MODELS, QUALITY_DRAFT_MODEL } from "./models";

describe("toAiError", () => {
  it.each([
    [new DOMException("timed out", "TimeoutError"), "timeout"],
    [new APIConnectionTimeoutError(), "timeout"],
    [new DOMException("stopped", "AbortError"), "cancelled"],
    [new APIUserAbortError(), "cancelled"],
    [new TypeError("fetch failed"), "provider_unreachable"],
    [new APIConnectionError({ message: "Connection error." }), "provider_unreachable"],
    [Object.assign(new Error("model 'gemma4:latest' not found"), { name: "ResponseError", status_code: 404 }), "model_missing"],
    [Object.assign(new Error("Too many requests"), { status: 429 }), "quota"],
    [new SyntaxError("Unexpected token"), "invalid_json"],
    [new Error("something else"), "provider_error"],
    ["a string", "provider_error"],
  ])("maps %s to %s", (thrown, code) => {
    expect(toAiError(thrown).code).toBe(code);
  });

  it("keeps an AiError as it is", () => {
    const e = new AiError("schema_mismatch", "details");
    expect(toAiError(e)).toBe(e);
  });
});

describe("modelFor", () => {
  it("uses the provisional defaults when nothing is chosen", () => {
    expect(modelFor("extract")).toBe(DEFAULT_MODELS.extract);
    expect(modelFor("draft")).toBe(DEFAULT_MODELS.draft);
  });

  it("prefers the workspace's choice, and quality mode for drafts only", () => {
    expect(modelFor("extract", { extract: "qwen3.5:9b" })).toBe("qwen3.5:9b");
    expect(modelFor("draft", { qualityMode: true })).toBe(QUALITY_DRAFT_MODEL);
    expect(modelFor("extract", { qualityMode: true })).toBe(DEFAULT_MODELS.extract);
    expect(modelFor("draft", { qualityMode: true, draft: "my-model" })).toBe("my-model");
  });
});
