import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@/lib/env";
import { configuredModel, modelFor, qualityDraftModel, readingAlternates } from "./index";
import { DEFAULT_MODELS, QUALITY_DRAFT_MODEL, READING_CANDIDATES } from "./models";

// The settings `.env.local` would give; each test sets what it needs.
const config = vi.hoisted(() => ({}) as Partial<Env>);
vi.mock("@/lib/env", () => ({ env: config }));

beforeEach(() => {
  for (const key of Object.keys(config)) delete config[key as keyof Env];
});

describe("models from .env.local", () => {
  it("uses the defaults when nothing is set", () => {
    expect(modelFor("extract")).toBe(DEFAULT_MODELS.extract);
    expect(qualityDraftModel()).toBe(QUALITY_DRAFT_MODEL);
    expect(readingAlternates()).toEqual(READING_CANDIDATES);
    expect(configuredModel("draft")).toBeUndefined();
  });

  it("swaps each task's model, and a configured writing model wins over quality mode", () => {
    Object.assign(config, { MODEL_EXTRACT: "qwen3.5:9b", MODEL_DRAFT: "gemma4:12b" });
    expect(modelFor("extract")).toBe("qwen3.5:9b");
    expect(modelFor("draft", { qualityMode: true })).toBe("gemma4:12b");
    expect(modelFor("vision")).toBe(DEFAULT_MODELS.vision);
  });

  it("uses the configured quality model and alternates", () => {
    Object.assign(config, { MODEL_QUALITY_DRAFT: "gemma4:12b", MODEL_ALTERNATES: ["qwen3.5:9b"] });
    expect(modelFor("draft", { qualityMode: true })).toBe("gemma4:12b");
    expect(modelFor("draft")).toBe(DEFAULT_MODELS.draft);
    expect(readingAlternates()).toEqual(["qwen3.5:9b"]);
  });
});
