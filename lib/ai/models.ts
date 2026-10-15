// Which models to use (§11.2). Provisional until the M7 eval measures the candidates: the
// defaults are the smallest current Gemma, sized for an 8 GB laptop, and quality mode offers the
// next size up where there is RAM for it. setup.sh (M8) reads these too.

export type ModelTask = "extract" | "draft" | "vision";

export const DEFAULT_MODELS: Record<ModelTask, string> = {
  extract: "gemma4:e2b",
  draft: "gemma4:e2b",
  vision: "gemma4:e2b", // Gemma 4 accepts images
};

export const QUALITY_DRAFT_MODEL = "gemma4:e4b";

/** Laptops with more RAM than this are offered quality mode (§3 B4). */
export const QUALITY_MODE_MIN_RAM_GB = 12;

/** Download sizes shown before a model is pulled (ollama.com, Oct 2026). Installed models report their own. */
export const DOWNLOAD_GB: Record<string, number> = {
  "gemma4:e2b": 4.6,
  "gemma4:e4b": 6.6,
  "gemma4:12b": 7.7,
};
