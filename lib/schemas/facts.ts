import { z } from "zod";
import { Ymd } from "./common";

// SPEC §S7: the code-built snapshot the draft model is allowed to use, stored with each draft.
export const StudentFacts = z.object({
  student: z.object({ name: z.string(), classGrade: z.string(), subjects: z.array(z.string()) }),
  cycle: z.object({ label: z.string(), from: Ymd, to: Ymd }),
  assessments: z.array(z.object({ label: z.string(), scored: z.number(), max: z.number(), pct: z.number() })),
  trend: z.enum(["improving", "steady", "declining", "not_enough_data"]),
  trendBasis: z.object({ previousAvgPct: z.number(), latestPct: z.number() }).optional(),
  homework: z.object({ missed: z.number(), sessionsWithHomework: z.number() }).nullable(),
  attendance: z.object({ present: z.number(), absent: z.number(), late: z.number() }).nullable(),
  topics: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  remarks: z.array(z.string()),
  standingNotes: z.string().optional(),
});
export type StudentFacts = z.infer<typeof StudentFacts>;
