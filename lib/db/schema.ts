import "server-only";
import { env } from "@/lib/env";
import * as pg from "./schema.pg";
import * as sqlite from "./schema.sqlite";

// Queries are typed against the SQLite tables, but each statement must be built from the table
// objects of the connected dialect: column mappers differ (JSON text vs jsonb, 0/1 vs boolean).
// `sessions` and `pairingTokens` are undefined in hosted mode, where nothing calls them.
const tables = (env.APP_MODE === "hosted" ? pg : sqlite) as unknown as typeof sqlite;

export const {
  workspaces,
  members,
  students,
  cycles,
  noteInputs,
  extractedEntries,
  assessments,
  drafts,
  sessions,
  pairingTokens,
  aiRuns,
  auditEvents,
} = tables;
