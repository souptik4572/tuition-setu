// Which models to use (§11.2), when `.env.local` doesn't say: MODEL_EXTRACT, MODEL_DRAFT and
// MODEL_VISION replace the defaults below, MODEL_QUALITY_DRAFT the quality model, and
// MODEL_ALTERNATES the reading candidates (`modelFor` and friends in ./index). The defaults use
// the `gemma4:latest` tag, which Ollama currently points at the 4B "e4b" build. The M7 eval kept
// it for reading: as accurate as qwen3.5:9b on the fixtures and three times faster
// (evals/results/summary.md). setup.sh (M8) reads these too.

export type ModelTask = "extract" | "draft" | "vision";

export const DEFAULT_MODELS: Record<ModelTask, string> = {
  extract: "gemma4:latest",
  draft: "gemma4:latest",
  vision: "gemma4:latest", // Gemma 4 accepts images
};

export const QUALITY_DRAFT_MODEL = "gemma4:e4b";

/** The defaults are sized for an 8 GB laptop (§11.2); B4 warns below it. */
export const MIN_RAM_GB = 8;

/** Laptops with more RAM than this are offered quality mode (§3 B4). */
export const QUALITY_MODE_MIN_RAM_GB = 12;

/** Download sizes shown before a model is pulled (ollama.com, Oct 2026). Installed models report their own. */
export const DOWNLOAD_GB: Record<string, number> = {
  "gemma4:latest": 6.6,
  "gemma4:e4b": 6.6,
  "gemma4:12b": 7.7,
};

/** Models a failed note can be read again with ("Try the other model"), when one is installed. */
export const READING_CANDIDATES = ["gemma4:latest", "gemma4:e4b", "gemma4:12b", "qwen3.5:9b"];
