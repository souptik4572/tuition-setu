import "server-only";
import { env } from "@/lib/env";
import type { AiConfig } from "@/lib/schemas/settings";
import { DEFAULT_MODELS, QUALITY_DRAFT_MODEL, type ModelTask } from "./models";
import { OllamaProvider } from "./ollama";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider } from "./provider";

// Deliberately not on globalThis: Next bundles pages and route handlers separately, and a provider
// made by one bundle fails the other's instanceof checks (its class and the error classes it
// throws are different copies). It only holds small caches, so one per bundle costs nothing.
let provider: AIProvider | undefined;

export function getProvider(): AIProvider {
  provider ??=
    env.AI_PROVIDER === "openai-compatible"
      ? new OpenAICompatibleProvider({ baseURL: env.OPENAI_COMPAT_BASE_URL!, apiKey: env.OPENAI_COMPAT_API_KEY })
      : new OllamaProvider({ host: env.OLLAMA_HOST });
  return provider;
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
