import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/db/queries/members";
import { env } from "@/lib/env";
import { SESSION_COOKIE, validateSession } from "./local/session";
import { AuthError, ROLE_RANK, type Ctx, type Role } from "./types";

/**
 * The signed-in member, checked against the database on every call (§9.2: the proxy only looks
 * for the cookie). Throws AuthError; every page, Server Action and Route Handler starts here.
 */
export async function requireMember(minRole: Role = "assistant"): Promise<Ctx> {
  if (env.APP_MODE === "hosted") throw new Error("Hosted sign-in is built in M13 (IMPL §3.1).");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await validateSession(token) : null;
  if (!session) throw new AuthError("unauthenticated");

  const member = await getMember({ workspaceId: session.workspaceId, memberId: session.memberId, system: true }, session.memberId);
  if (member?.status !== "active") throw new AuthError("unauthenticated");
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) throw new AuthError("forbidden");
  return { userId: member.userId, memberId: member.id, workspaceId: member.workspaceId, role: member.role };
}

/** For pages: a signed-out visitor goes to sign in. */
export async function requirePageMember(minRole: Role = "assistant"): Promise<Ctx> {
  try {
    return await requireMember(minRole);
  } catch (error) {
    if (error instanceof AuthError && error.code === "unauthenticated") redirect("/login");
    throw error;
  }
}
