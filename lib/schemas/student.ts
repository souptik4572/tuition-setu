import { z } from "zod";
import { normalizePhone } from "@/lib/util/phone";
import { Language } from "./common";

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((s) => s || null);

// The student form (R1). Messages are the board's copy; `parentPhone` comes out as digits only.
export const StudentInput = z.object({
  fullName: z.string().trim().min(1, "Enter the student's full name"),
  messageName: z.string().trim().min(1, "Fills in from the first name once you add it"),
  classGrade: z.string().trim().min(1, "Enter a class, like 7"),
  batch: optionalText,
  subjects: z.array(z.string().trim().min(1)).default([]),
  parentName: optionalText,
  parentPhone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (phone.ok) return phone.digits;
    ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number" });
    return z.NEVER;
  }),
  parentLanguage: z.enum(Language.options, { error: "Choose the language the parent reads" }),
  nicknames: z
    .array(z.string().trim())
    .default([])
    .transform((names) => [...new Set(names.filter(Boolean))]),
  standingNotes: optionalText,
  feesPending: z.boolean().default(false),
});
export type StudentInput = z.input<typeof StudentInput>;
export type StudentData = z.output<typeof StudentInput>;
