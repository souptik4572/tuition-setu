import type { Language } from "@/lib/schemas/common";

// The parts of a message that code writes, never the model (§S10, Appendix A). Native-speaker
// review required before release. M9 adds the title and `assemble()`.

const GREETING: Record<Language, { named: (parent: string) => string; plain: string }> = {
  en: { named: (p) => `Hello ${p},`, plain: "Hello," },
  bn: { named: (p) => `নমস্কার ${p},`, plain: "নমস্কার," },
  hi: { named: (p) => `नमस्ते ${p},`, plain: "नमस्ते," },
};

export const FEE_LINE: Record<Language, string> = {
  en: "A gentle reminder that this month's tuition fee is pending.",
  bn: "মনে করিয়ে দিচ্ছি, এই মাসের টিউশন ফি এখনও বাকি আছে।",
  hi: "याद दिला दूँ, इस महीने की ट्यूशन फ़ीस अभी बाकी है।",
};

export function greeting(language: Language, parentName: string | null): string {
  const parent = parentName?.trim();
  return parent ? GREETING[language].named(parent) : GREETING[language].plain;
}

export const signOff = (signature: string) => `— ${signature.trim()}`;
