"use server";

import { requireMember } from "@/lib/auth/require-member";
import { AuthError, type ActionResult } from "@/lib/auth/types";
import { getWorkspace, updateWorkspace } from "@/lib/db/queries/workspaces";

/** B4 offers quality mode on laptops with more than 12 GB of RAM (§3 B4). */
export async function setQualityMode(on: boolean): Promise<ActionResult<null>> {
  const ctx = await requireMember("owner").catch((error: unknown) => {
    if (error instanceof AuthError) return null;
    throw error;
  });
  if (!ctx) return { ok: false, error: { code: "unauthenticated", message: "You've been signed out. Sign in again to change this." } };

  const workspace = await getWorkspace(ctx);
  await updateWorkspace(ctx, { aiConfigJson: { ...workspace?.aiConfigJson, qualityMode: on === true } });
  return { ok: true, data: null };
}
