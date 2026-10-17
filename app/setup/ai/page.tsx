import type { Metadata } from "next";
import { SetupFrame } from "@/components/ts/setup-frame";
import { configuredModel, qualityDraftModel } from "@/lib/ai";
import { getHealth } from "@/lib/ai/health";
import { requirePageMember } from "@/lib/auth/require-member";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import { hostPlatform } from "@/lib/util/platform";
import { AiCheck } from "./ai-check";

export const metadata: Metadata = { title: "Check the AI engine · TuitionSetu" };

/** B4 (D1, D1-ModelMissing). Always a fresh check: the tutor may have just downloaded a model. */
export default async function AiCheckPage() {
  const ctx = await requirePageMember("owner");
  const workspace = await getWorkspace(ctx);
  const aiConfig = workspace?.aiConfigJson ?? {};
  const health = await getHealth({ fresh: true, aiConfig, ctx });
  const { terminal, restartAi } = hostPlatform();
  return (
    <SetupFrame step={3}>
      <AiCheck
        health={health}
        qualityMode={aiConfig.qualityMode === true}
        qualityModel={qualityDraftModel()}
        // A writing model named in .env.local wins over quality mode, so the switch would do nothing.
        qualityLocked={configuredModel("draft") !== undefined}
        terminal={terminal}
        restartAi={restartAi}
      />
    </SetupFrame>
  );
}
