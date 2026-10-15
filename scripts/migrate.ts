// npm run db:migrate — creates or updates the local SQLite file (SPEC §13.4 step 6).
// Runs with `--conditions=react-server` so lib/env's `server-only` import resolves outside Next.
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { env } = await import("@/lib/env");
  if (env.APP_MODE !== "local") throw new Error("db:migrate is for the local version. Hosted mode uses db:hosted:migrate.");
  const { openSqlite } = await import("@/lib/db/sqlite");
  openSqlite(env.DATABASE_PATH).client.close();
  console.log(`Database ready at ${env.DATABASE_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
