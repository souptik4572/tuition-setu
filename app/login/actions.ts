"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPin } from "@/lib/auth/local/pin";
import { clientIp, pauseLeft, recordFailure, recordSuccess } from "@/lib/auth/local/rate-limit";
import { signIn, signOut } from "@/lib/auth/local/session";
import { getLocalOwner } from "@/lib/db/queries/members";

// The pause is sent as time left, not a clock time, so the countdown is right even when the
// phone's clock disagrees with the laptop's.
export type LoginResult = { ok: false; triesLeft: number } | { ok: false; lockedForMs: number };

/** Stage C. While this client is paused, the PIN isn't even checked (§9.1). */
export async function login(value: string): Promise<LoginResult> {
  const ip = clientIp(await headers());
  const paused = pauseLeft(ip);
  if (paused) return { ok: false, lockedForMs: paused };

  const owner = await getLocalOwner();
  if (!owner) redirect("/setup");

  const secret = { kind: owner.pinKind ?? "pin", value: typeof value === "string" ? value.slice(0, 200) : "" };
  const ok = owner.pinHash !== null && owner.pinSalt !== null && (await verifyPin(secret, owner.pinHash, owner.pinSalt));
  if (!ok) {
    const failure = recordFailure(ip);
    return failure.pauseMs ? { ok: false, lockedForMs: failure.pauseMs } : { ok: false, triesLeft: failure.triesLeft };
  }

  recordSuccess(ip);
  await signIn({ workspaceId: owner.workspaceId, memberId: owner.id });
  redirect("/");
}

export async function logout(): Promise<void> {
  await signOut();
  redirect("/login");
}
