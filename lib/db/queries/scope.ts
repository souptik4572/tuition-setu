import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { DbCtx, SystemCtx } from "../types";

/** `id = ? AND workspace_id = ctx.workspaceId`: a row from another workspace is never found. */
export function own(table: { id: SQLiteColumn; workspaceId: SQLiteColumn }, ctx: DbCtx, id: string): SQL {
  return and(eq(table.id, id), eq(table.workspaceId, ctx.workspaceId))!;
}

/**
 * For the few queries that run before anyone is signed in (setup, login, session lookup; §7).
 * Each one says why it doesn't need a workspace.
 */
export const BEFORE_SIGN_IN: SystemCtx = { workspaceId: "", memberId: "", system: true };
