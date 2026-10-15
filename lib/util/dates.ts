// Class dates are plain `YYYY-MM-DD` strings in the workspace time zone; arithmetic runs in UTC
// so that local daylight-saving rules can never shift a day.

const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(ymd: string, days: number): string {
  const date = toUtc(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** The Monday–Sunday week containing the date (§S1). */
export function cycleRangeFor(ymd: string): { from: string; to: string } {
  const daysSinceMonday = (toUtc(ymd).getUTCDay() + 6) % 7;
  const from = addDays(ymd, -daysSinceMonday);
  return { from, to: addDays(from, 6) };
}

// Latin digits in every language, so numbers in titles stay 0-9 (§S10). English month names come
// from en-US because en-IN abbreviates September as "Sept"; day-then-month order is ours either way.
const LOCALES = { en: "en-US", bn: "bn-IN-u-nu-latn", hi: "hi-IN-u-nu-latn" } as const;

function dayAndMonth(ymd: string, lang: keyof typeof LOCALES) {
  const parts = new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(toUtc(ymd));
  return { day: parts.find((p) => p.type === "day")!.value, month: parts.find((p) => p.type === "month")!.value };
}

/** "12–18 Oct" within one month, "28 Sep–4 Oct" across two. */
export function formatRange(from: string, to: string, lang: keyof typeof LOCALES = "en"): string {
  const a = dayAndMonth(from, lang);
  const b = dayAndMonth(to, lang);
  return a.month === b.month ? `${a.day}–${b.day} ${b.month}` : `${a.day} ${a.month}–${b.day} ${b.month}`;
}

/** "Thu 15 Oct": score dates on the profile and the day a student was archived. */
export function formatDay(ymd: string): string {
  const { day, month } = dayAndMonth(ymd, "en");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(toUtc(ymd));
  return `${weekday} ${day} ${month}`;
}

/** "Wed 14 Oct, 7:40 PM" for a timestamp, in the workspace's time zone. */
export function formatDayTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
  return `${formatDay(todayIn(timeZone, date))}, ${time}`;
}

/** The hour of day (0–23) in the workspace's time zone, for "Good morning". */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
}
