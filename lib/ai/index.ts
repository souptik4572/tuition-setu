import "server-only";
import { env } from "@/lib/env";
import type { AiConfig } from "@/lib/schemas/settings";
import { DEFAULT_MODELS, QUALITY_DRAFT_MODEL, type ModelTask } from "./models";
import { OllamaProvider } from "./ollama";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider } from "./provider";

const g = globalThis as typeof globalThis & { __tsAiProvider?: AIProvider };

export function getProvider(): AIProvider {
  g.__tsAiProvider ??=
    env.AI_PROVIDER === "openai-compatible"
      ? new OpenAICompatibleProvider({ baseURL: env.OPENAI_COMPAT_BASE_URL!, apiKey: env.OPENAI_COMPAT_API_KEY })
      : new OllamaProvider({ host: env.OLLAMA_HOST });
  return g.__tsAiProvider;
}

/** The address the AI runs at, for the "AI runs outside this device" check (§2.2). */
export function providerUrl(): string {
  return env.AI_PROVIDER === "openai-compatible" ? env.OPENAI_COMPAT_BASE_URL! : env.OLLAMA_HOST;
}

const ENV_MODELS: Record<ModelTask, string | undefined> = {
  extract: env.MODEL_EXTRACT,
  draft: env.MODEL_DRAFT,
  vision: env.MODEL_VISION,
};

/**
 * Model for a task: the workspace's choice in Settings, then quality mode (drafts only), then
 * `MODEL_*` from the environment, then the provisional default (§13.1, IMPL M3).
 */
export function modelFor(task: ModelTask, aiConfig: AiConfig = {}): string {
  return aiConfig[task] ?? (task === "draft" && aiConfig.qualityMode ? QUALITY_DRAFT_MODEL : undefined) ?? ENV_MODELS[task] ?? DEFAULT_MODELS[task];
}
