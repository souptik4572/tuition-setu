import { z } from "zod";
import { Ymd } from "./common";

export const NoteInput = z.object({
  text: z.string().trim().min(1, "Write something first").max(10_000, "That's a very long note. Split it into two."),
  batch: z.string().trim().min(1).nullish().transform((s) => s ?? null),
  classDate: Ymd.optional(), // defaults to today in the workspace time zone
  origin: z.enum(["capture", "quick_note"]).default("capture"),
});
export type NoteInput = z.input<typeof NoteInput>;
