import "server-only";

// §9.1: 5 wrong PINs in 10 minutes from one client → a 10-minute pause. In memory, so a restart
// or `npm run reset-pin` (another process) doesn't clear it.

const WINDOW_MS = 10 * 60_000;
const LOCK_MS = 10 * 60_000;
const MAX_FAILURES = 5;
// Next keeps an X-Forwarded-For header the client sends itself, so anyone on the Wi-Fi can claim
// a new address for every guess. This cap across all clients still stops guessing; the tutor's
// own phone and laptop only lock each other out while someone is trying it.
const MAX_FAILURES_ALL = 20;
const ALL = "*";

type Bucket = { failures: number[]; lockedUntil?: number };

const g = globalThis as typeof globalThis & { __tsLoginBuckets?: Map<string, Bucket> };
const buckets = (g.__tsLoginBuckets ??= new Map<string, Bucket>());

/** The client's address as the server saw it (Next sets X-Forwarded-For from the socket when the client didn't). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function current(key: string, now: number): Bucket | undefined {
  const bucket = buckets.get(key);
  if (!bucket) return undefined;
  if (bucket.lockedUntil !== undefined && bucket.lockedUntil <= now) {
    buckets.delete(key);
    return undefined;
  }
  bucket.failures = bucket.failures.filter((at) => now - at < WINDOW_MS);
  if (!bucket.failures.length && bucket.lockedUntil === undefined) {
    buckets.delete(key);
    return undefined;
  }
  return bucket;
}

/** How long this client must still wait, in ms (0 = it may try now). Checked before the PIN. */
export function pauseLeft(ip: string): number {
  const now = Date.now();
  const until = Math.max(current(ip, now)?.lockedUntil ?? 0, current(ALL, now)?.lockedUntil ?? 0);
  return Math.max(0, until - now);
}

export function recordFailure(ip: string): { triesLeft: number; pauseMs: number } {
  const now = Date.now();
  const add = (key: string, max: number) => {
    const bucket = current(key, now) ?? { failures: [] };
    bucket.failures.push(now);
    if (bucket.failures.length >= max) bucket.lockedUntil = now + LOCK_MS;
    buckets.set(key, bucket);
    return max - bucket.failures.length;
  };
  const triesLeft = Math.min(add(ip, MAX_FAILURES), add(ALL, MAX_FAILURES_ALL));
  const pauseMs = pauseLeft(ip);
  return { triesLeft: pauseMs ? 0 : triesLeft, pauseMs };
}

export function recordSuccess(ip: string): void {
  buckets.delete(ip);
}
