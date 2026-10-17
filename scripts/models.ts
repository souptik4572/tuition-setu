// npm run models — the models ./setup.sh pulls, one per line as "name<TAB>download GB": the ones
// named in .env.local, else the defaults (IMPL D-38). Photos (vision) only when MODEL_VISION is set,
// since photo capture isn't built. Runs with `--conditions=react-server`, like migrate.ts.
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { configuredModel, modelFor } = await import("@/lib/ai");
  const { DOWNLOAD_GB } = await import("@/lib/ai/models");
  const vision = configuredModel("vision");
  for (const name of new Set([modelFor("extract"), modelFor("draft"), ...(vision ? [vision] : [])])) console.log(`${name}\t${DOWNLOAD_GB[name] ?? ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
