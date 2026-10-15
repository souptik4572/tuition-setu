import type { Ctx } from "@/lib/auth/types";

export type SystemCtx = { workspaceId: string; memberId: string; system: true };

// M2 replaces this with the Drizzle SQLite instance type; queries are written
// once against it and the Postgres instance is cast to it (IMPL §3.2).
export type Db = unknown;

export type WithDb = <T>(ctx: Ctx | SystemCtx, fn: (db: Db) => Promise<T>) => Promise<T>;
