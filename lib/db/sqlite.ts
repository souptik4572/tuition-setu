import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Opens the SQLite file and brings its schema up to date. Migrating on open means a tutor who
 * pulls a new version never runs an old schema; applied migrations are skipped, so it's cheap.
 */
export function openSqlite(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  client.pragma("busy_timeout = 5000");
  const db = drizzle({ client });
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  return { client, db };
}
