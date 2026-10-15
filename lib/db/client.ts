import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type BetterSqlite3 from "better-sqlite3";
import { env } from "@/lib/env";
import type { Db, DbCtx } from "./types";

type Local = { client: BetterSqlite3.Database; db: Db };

// On globalThis so dev hot reload keeps one connection and one queue.
const g = globalThis as typeof globalThis & { __tsLocalDb?: Local; __tsDbTail?: Promise<unknown>; __tsDbTx?: AsyncLocalStorage<Db> };
const activeTx = (g.__tsDbTx ??= new AsyncLocalStorage<Db>());

async function localDb(): Promise<Local> {
  // Dynamic import, so hosted builds never load the native better-sqlite3 module (§19.2).
  g.__tsLocalDb ??= (await import("./sqlite")).openSqlite(env.DATABASE_PATH);
  return g.__tsLocalDb;
}

// better-sqlite3 transactions can't span an `await`, and every request shares one connection,
// so transactions run one at a time. Queries take microseconds; never call a model in here.
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__tsDbTail ?? Promise.resolve()).then(fn, fn);
  g.__tsDbTail = run.catch(() => undefined);
  return run;
}

/**
 * Runs `fn` in one transaction (IMPL §3.2). A call made inside another `withDb` joins the outer
 * transaction, so queries compose: an action can wrap several query functions to make them atomic.
 */
export async function withDb<T>(ctx: DbCtx, fn: (db: Db) => Promise<T>): Promise<T> {
  const outer = activeTx.getStore();
  if (outer) return fn(outer);
  if (env.APP_MODE === "hosted") throw new Error("The hosted database adapter is built in M12 (IMPL §3.2).");

  const { client, db } = await localDb();
  return exclusive(async () => {
    client.exec("BEGIN IMMEDIATE");
    try {
      const result = await activeTx.run(db, () => fn(db));
      client.exec("COMMIT");
      return result;
    } catch (error) {
      client.exec("ROLLBACK");
      throw error;
    }
  });
}
