// npm run db:seed — a developer shortcut: an empty local install gets a demo workspace with the
// sample students, without going through the setup wizard. Tutors get sample data from setup
// instead (SEED_SAMPLE, IMPL D-25). Runs with `--conditions=react-server`, like migrate.ts.
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { env } = await import("@/lib/env");
  if (env.APP_MODE !== "local") throw new Error("db:seed is for the local version.");

  const { createWorkspaceWithOwner, hasWorkspace } = await import("@/lib/db/queries/workspaces");
  const { loadSampleData } = await import("@/lib/db/sample-data");
  const { WorkspaceSettings } = await import("@/lib/schemas/settings");

  if (await hasWorkspace()) {
    console.log("A workspace already exists, so nothing was added. Seeding only fills an empty install.");
    return;
  }
  const settings = WorkspaceSettings.parse({ name: "Mita's Tuition", subjects: ["Maths", "Science"], defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const userId = crypto.randomUUID();
  const ids = await createWorkspaceWithOwner(settings, { userId, displayName: "Mita Sarkar", signature: "Mita Ma'am" });
  await loadSampleData({ ...ids, userId, role: "owner" });
  console.log(`Added "Mita's Tuition" with 6 sample students to ${env.DATABASE_PATH}.`);
  console.log("It has no PIN yet: set one with `npm run reset-pin` (built in M4) before signing in.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
