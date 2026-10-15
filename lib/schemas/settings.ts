import { z } from "zod";
import { Language, Tone } from "./common";

export const AiConfig = z.object({
  extract: z.string().optional(),
  draft: z.string().optional(),
  vision: z.string().optional(),
  qualityMode: z.boolean().optional(),
});
export type AiConfig = z.infer<typeof AiConfig>;

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const WorkspaceSettings = z.object({
  name: z.string().trim().min(1, "Give your workspace a name").max(80),
  subjects: z.array(z.string().trim().min(1)).default([]),
  defaultLanguage: Language,
  tone: Tone,
  reportDay: z.number().int().min(0).max(6), // 0 = Sunday … 6 = Saturday, like Date.getDay()
  // Checked by formatting, not against Intl.supportedValuesOf: that list holds canonical IDs
  // only, so it has "Asia/Calcutta" but not the name everyone uses, "Asia/Kolkata".
  timezone: z.string().default("Asia/Kolkata").refine(isTimeZone, "Choose a time zone from the list"),
  includeFeeReminders: z.boolean().default(false),
  deletePhotosAfterConfirm: z.boolean().default(true),
});
export type WorkspaceSettings = z.input<typeof WorkspaceSettings>;
export type WorkspaceSettingsData = z.output<typeof WorkspaceSettings>;
