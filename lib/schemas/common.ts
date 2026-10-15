import { z } from "zod";

export const Language = z.enum(["en", "bn", "hi"]);
export type Language = z.infer<typeof Language>;

export const Tone = z.enum(["warm", "neutral", "formal"]);
export type Tone = z.infer<typeof Tone>;

export const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-15");
