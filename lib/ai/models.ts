// Which models to use (§11.2). Provisional until the M7 eval measures the candidates. The
// defaults use the `gemma4:latest` tag, which Ollama currently points at the 4B "e4b" build, and
// quality mode offers a larger model where there is RAM for it. setup.sh (M8) reads these too.

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
