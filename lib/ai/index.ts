import "server-only";
import { env } from "@/lib/env";
import type { AiConfig } from "@/lib/schemas/settings";
import { DEFAULT_MODELS, QUALITY_DRAFT_MODEL, READING_CANDIDATES, type ModelTask } from "./models";
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

const CONFIG_KEY = { extract: "MODEL_EXTRACT", draft: "MODEL_DRAFT", vision: "MODEL_VISION" } as const;

/** The model `.env.local` names for a task, if it names one. */
export const configuredModel = (task: ModelTask): string | undefined => env[CONFIG_KEY[task]];

/** Quality mode's larger writing model (§3 B4): MODEL_QUALITY_DRAFT, or the default. */
export const qualityDraftModel = (): string => env.MODEL_QUALITY_DRAFT ?? QUALITY_DRAFT_MODEL;

/** Models "Try the other model" may use for a note that couldn't be read: MODEL_ALTERNATES, or the defaults. */
export const readingAlternates = (): string[] => env.MODEL_ALTERNATES ?? READING_CANDIDATES;

/**
 * Model for a task (§13.1). A model named in `.env.local` always wins, so models can be swapped by
 * editing it and restarting; then quality mode (drafts only, set in B4); then the default in
 * ./models. A per-task choice in Settings (M11, not built) comes before all of them.
 */
export function modelFor(task: ModelTask, aiConfig: AiConfig = {}): string {
  return aiConfig[task] ?? configuredModel(task) ?? (task === "draft" && aiConfig.qualityMode ? qualityDraftModel() : undefined) ?? DEFAULT_MODELS[task];
}
