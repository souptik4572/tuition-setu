"use server";

import { redirect } from "next/navigation";
import { hashPin } from "@/lib/auth/local/pin";
import { signIn } from "@/lib/auth/local/session";
import type { ActionResult } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { BEFORE_SIGN_IN } from "@/lib/db/queries/scope";
import { createWorkspaceWithOwner, hasWorkspace } from "@/lib/db/queries/workspaces";
import { loadSampleData } from "@/lib/db/sample-data";
import { env } from "@/lib/env";
import { Secret, validateSecret } from "@/lib/schemas/secret";
import { SetupProfile, WorkspaceSettings } from "@/lib/schemas/settings";

/** B2–B3 (§7.1). Open only while no workspace exists; it creates the one workspace and its owner. */
export async function completeSetup(profile: SetupProfile, secret: Secret): Promise<ActionResult<never>> {
  const p = SetupProfile.safeParse(profile);
  const s = Secret.safeParse(secret);
  if (!p.success || !s.success || validateSecret(s.data)) {
    return { ok: false, error: { code: "invalid", message: "Something here isn't filled in the way it should be. Check each step and try again." } };
  }
  if (await hasWorkspace()) redirect("/login");

  // Hashing takes a moment, so it happens before the transaction, which holds the database.
  const { hash, salt } = await hashPin(s.data);
  const { displayName, signature, ...settings } = p.data;
  const created = await withDb(BEFORE_SIGN_IN, async () => {
    // Checked again inside the transaction, so two tabs finishing at once can't make two workspaces.
    if (await hasWorkspace()) return null;
    const ids = await createWorkspaceWithOwner(WorkspaceSettings.parse({ ...settings, name: displayName }), {
      userId: crypto.randomUUID(),
      displayName,
      signature,
      pinHash: hash,
      pinSalt: salt,
      pinKind: s.data.kind,
    });
    if (env.SEED_SAMPLE) await loadSampleData({ ...ids, system: true });
    return ids;
  });
  if (!created) redirect("/login");

  await signIn(created);
  redirect("/setup/ai");
}
