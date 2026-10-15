import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { findSessionByTokenHash, insertSession, revokeSessionByTokenHash, touchSession, type Session } from "@/lib/db/queries/sessions";
import { env } from "@/lib/env";
import { isLoopbackHost } from "@/lib/util/lan";

// Local mode only (§9.2). Hosted sessions belong to Supabase Auth (M13).

export const SESSION_COOKIE = "ts_session";

const HOUR_MS = 3_600_000;
const ttlMs = () => env.SESSION_TTL_DAYS * 24 * HOUR_MS;
// The server's sliding expiry decides when a session ends; the cookie only has to outlive it.
// 400 days is the longest browsers keep a cookie.
const COOKIE_MAX_AGE_S = 400 * 24 * 3600;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Returns the token for the cookie; only its hash is stored. */
export async function createSession(owner: { workspaceId: string; memberId: string }, device: { label: string; userAgent: string | null }): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs()).toISOString();
  await insertSession(owner, { tokenHash: hashToken(token), deviceLabel: device.label, userAgent: device.userAgent, expiresAt });
  return token;
}

/** The live session for a cookie value. Use slides the expiry, at most once an hour. */
export async function validateSession(token: string): Promise<Session | null> {
  const session = await findSessionByTokenHash(hashToken(token));
  const now = Date.now();
  if (!session || session.revokedAt || Date.parse(session.expiresAt) <= now) return null;
  if (now - Date.parse(session.lastSeenAt) < HOUR_MS) return session;

  const lastSeenAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs()).toISOString();
  await touchSession(session.id, lastSeenAt, expiresAt);
  return { ...session, lastSeenAt, expiresAt };
}

/** Starts a session for this device and sets the cookie. Server Actions only. */
export async function signIn(member: { workspaceId: string; memberId: string }): Promise<void> {
  const h = await headers();
  const label = isLoopbackHost(`http://${h.get("host") ?? ""}`) ? "This laptop" : "Phone";
  const token = await createSession(member, { label, userAgent: h.get("user-agent")?.slice(0, 300) ?? null });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Only over HTTPS: a phone on the home Wi-Fi uses plain HTTP and would drop a Secure cookie.
    secure: h.get("x-forwarded-proto") === "https",
    maxAge: COOKIE_MAX_AGE_S,
  });
}

/** Signs this device out. Server Actions only. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByTokenHash(hashToken(token));
  jar.delete(SESSION_COOKIE);
}
