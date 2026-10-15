import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Ctx } from "@/lib/auth/types";

export type SystemCtx = { workspaceId: string; memberId: string; system: true };

/** What a query needs from the caller: whose workspace, and who is acting. */
export type DbCtx = Ctx | SystemCtx;

// Queries are written once against the SQLite types; hosted mode casts its Postgres instance to
// this type (IMPL §3.2). Never use the SQLite-only .all() / .get() / .run() / .values().
export type Db = BetterSQLite3Database;

export type WithDb = <T>(ctx: DbCtx, fn: (db: Db) => Promise<T>) => Promise<T>;
