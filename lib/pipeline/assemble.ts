import type { Language } from "@/lib/schemas/common";

// The parts of a message that code writes, never the model (§S10, Appendix A). Native-speaker
// review required before release.

const TITLE: Record<Language, (name: string, range: string) => string> = {
  en: (n, r) => `Weekly update — ${n} (${r})`,
  bn: (n, r) => `${n}-এর সাপ্তাহিক আপডেট (${r})`,
  hi: (n, r) => `${n} का साप्ताहिक अपडेट (${r})`,
};

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

/**
 * S10: the message as the parent gets it. `bodyOffset` is where the body starts, so guard ranges
 * (offsets into the body) can be shown on the full message.
 */
export function assemble(p: { language: Language; studentName: string; parentName: string | null; range: string; body: string; feeLine: boolean; signature: string }): { message: string; bodyOffset: number } {
  const head = `*${TITLE[p.language](p.studentName, p.range)}*\n${greeting(p.language, p.parentName)}\n\n`;
  const fee = p.feeLine ? `${FEE_LINE[p.language]}\n` : "";
  return { message: `${head}${p.body.trim()}\n\n${fee}${signOff(p.signature)}`, bodyOffset: head.length };
}
