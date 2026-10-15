import { defineConfig } from "drizzle-kit";

// SQLite migrations for the local version. Hosted Postgres DDL gets its own config in M12.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.sqlite.ts",
  out: "./drizzle",
});
