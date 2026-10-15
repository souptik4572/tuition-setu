import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, pauseLeft, recordFailure, recordSuccess } from "./rate-limit";

const g = globalThis as typeof globalThis & { __tsLoginBuckets?: Map<string, unknown> };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
  g.__tsLoginBuckets?.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

const MIN = 60_000;

describe("login rate limit", () => {
  it("counts down 4…1, then pauses for 10 minutes on the 5th wrong PIN", () => {
    expect([1, 2, 3, 4].map(() => recordFailure("10.0.0.2").triesLeft)).toEqual([4, 3, 2, 1]);
    expect(recordFailure("10.0.0.2")).toEqual({ triesLeft: 0, pauseMs: 10 * MIN });
    expect(pauseLeft("10.0.0.2")).toBe(10 * MIN);
    expect(pauseLeft("127.0.0.1")).toBe(0);
  });

  it("lets the client try again after the pause, with all 5 tries", () => {
    for (let i = 0; i < 5; i++) recordFailure("10.0.0.2");
    vi.advanceTimersByTime(10 * MIN - 1);
    expect(pauseLeft("10.0.0.2")).toBe(1);
    vi.advanceTimersByTime(1);
    expect(pauseLeft("10.0.0.2")).toBe(0);
    expect(recordFailure("10.0.0.2").triesLeft).toBe(4);
  });

  it("forgets wrong tries older than 10 minutes", () => {
    for (let i = 0; i < 4; i++) recordFailure("10.0.0.2");
    vi.advanceTimersByTime(10 * MIN);
    expect(recordFailure("10.0.0.2").triesLeft).toBe(4);
  });

  it("starts over after a right PIN", () => {
    recordFailure("10.0.0.2");
    recordFailure("10.0.0.2");
    recordSuccess("10.0.0.2");
    expect(recordFailure("10.0.0.2").triesLeft).toBe(4);
  });

  it("pauses everyone after 20 wrong tries from addresses that keep changing", () => {
    for (let i = 0; i < 19; i++) expect(recordFailure(`10.0.1.${i}`).pauseMs).toBe(0);
    expect(recordFailure("10.0.1.99").pauseMs).toBe(10 * MIN);
    expect(pauseLeft("127.0.0.1")).toBe(10 * MIN);
  });

  it("reads the first X-Forwarded-For address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "192.168.1.7, 10.0.0.1" }))).toBe("192.168.1.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
