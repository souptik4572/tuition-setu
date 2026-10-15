import { z } from "zod";

// Verbatim from SPEC §S2.
export const TranscriptionResult = z.object({
  lines: z.array(
    z.object({
      text: z.string(), // exactly as written; "[?]" for unreadable words
      uncertain: z.boolean(), // model is unsure about something in this line
    }),
  ),
});
export type TranscriptionResult = z.infer<typeof TranscriptionResult>;
