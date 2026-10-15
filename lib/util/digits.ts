const BENGALI_ZERO = 0x09e6;
const DEVANAGARI_ZERO = 0x0966;

/** Bengali ০-৯ and Devanagari ०-९ become 0-9, one UTF-16 unit for one, so offsets survive. */
export function normalizeDigits(s: string): string {
  return s.replace(/[০-৯०-९]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= BENGALI_ZERO ? code - BENGALI_ZERO : code - DEVANAGARI_ZERO);
  });
}

export type NumberToken =
  | { kind: "pair"; a: number; b: number; start: number; end: number }
  | { kind: "percent"; v: number; start: number; end: number }
  | { kind: "number"; v: number; start: number; end: number };

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const FROM = String.raw`(?<![\d.])`;
const UPTO = String.raw`(?![\d])`;

// Matched in this order; each pass masks what it consumed so later passes can't reuse it.
const PASSES: { re: RegExp; make: (m: RegExpExecArray) => Omit<NumberToken, "start" | "end"> }[] = [
  // "14 out of 20": scored first.
  { re: new RegExp(`${FROM}${NUM}\\s*out\\s+of\\s*${NUM}${UPTO}`, "giu"), make: (m) => ({ kind: "pair", a: +m[1], b: +m[2] }) },
  // Bengali "২০ এর মধ্যে ১৪" and Hindi "20 में से 14" put the total first.
  { re: new RegExp(`${FROM}${NUM}\\s*-?\\s*এর\\s*মধ্যে\\s*${NUM}${UPTO}`, "gu"), make: (m) => ({ kind: "pair", a: +m[2], b: +m[1] }) },
  { re: new RegExp(`${FROM}${NUM}\\s*में\\s*से\\s*${NUM}${UPTO}`, "gu"), make: (m) => ({ kind: "pair", a: +m[2], b: +m[1] }) },
  { re: new RegExp(`${FROM}${NUM}\\s*\\/\\s*${NUM}${UPTO}`, "gu"), make: (m) => ({ kind: "pair", a: +m[1], b: +m[2] }) },
  { re: new RegExp(`${FROM}${NUM}\\s*%`, "gu"), make: (m) => ({ kind: "percent", v: +m[1] }) },
  { re: new RegExp(`${FROM}${NUM}${UPTO}`, "gu"), make: (m) => ({ kind: "number", v: +m[1] }) },
];

/** Every number in the text, with offsets into the original string. Numbers written as words are not found (§4.2). */
export function extractNumbers(s: string): NumberToken[] {
  let work = normalizeDigits(s);
  const tokens: NumberToken[] = [];
  for (const { re, make } of PASSES) {
    re.lastIndex = 0;
    const found: NumberToken[] = [];
    for (let m = re.exec(work); m; m = re.exec(work)) {
      found.push({ ...make(m), start: m.index, end: m.index + m[0].length } as NumberToken);
    }
    for (const t of found) work = work.slice(0, t.start) + " ".repeat(t.end - t.start) + work.slice(t.end);
    tokens.push(...found);
  }
  return tokens.sort((x, y) => x.start - y.start);
}
