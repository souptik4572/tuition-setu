import { z } from "zod";

// SPEC §S9. Ranges are offsets into the draft body, not the assembled message.
export const GuardIssue = z.object({
  rule: z.enum(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "timeout"]),
  severity: z.enum(["critical", "flag", "warning"]),
  message: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});
export type GuardIssue = z.infer<typeof GuardIssue>;

export const GuardResult = z.object({
  status: z.enum(["pass", "flagged"]),
  issues: z.array(GuardIssue),
});
export type GuardResult = z.infer<typeof GuardResult>;
