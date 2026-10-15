import { z } from "zod";

// Verbatim from SPEC §S4: the model's output shape.

export const Assessment = z.object({
  label: z.string(), // "ch5 test", "weekly quiz"
  scored: z.number().nullable(),
  max: z.number().nullable(), // null when the notes give no total
  raw: z.string(), // verbatim text, e.g. "14/20"
});
export type Assessment = z.infer<typeof Assessment>;

export const ExtractedEntry = z.object({
  name_as_written: z.string(),
  source_span: z.string(), // verbatim excerpt this entry came from
  topics: z.array(z.string()),
  assessments: z.array(Assessment),
  homework: z.object({
    status: z.enum(["done", "partial", "missed", "unknown"]),
    missed_count: z.number().int().nullable(),
  }),
  attendance: z.enum(["present", "absent", "late", "unknown"]),
  strengths: z.array(z.string()), // short English paraphrases
  concerns: z.array(z.string()),
  fee_mentioned: z.boolean(),
  remarks: z.string().nullable(),
});
export type ExtractedEntry = z.infer<typeof ExtractedEntry>;

export const ExtractionResult = z.object({
  entries: z.array(ExtractedEntry),
  unattributed: z.array(z.string()), // lines the model could not tie to a student
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

/** S5 validation results stored on an entry as `flags_json` (IMPL M6). */
export const Flag = z.object({
  code: z.enum(["unsupported_entry", "number_not_in_notes", "impossible_score", "missing_total", "unattributed", "fee_prompt"]),
  blocking: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type Flag = z.infer<typeof Flag>;
