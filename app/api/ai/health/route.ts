import { getHealth } from "@/lib/ai/health";
import { requireMember } from "@/lib/auth/require-member";
import { AuthError } from "@/lib/auth/types";
import { getWorkspace, hasWorkspace } from "@/lib/db/queries/workspaces";

// Open while no workspace exists (§7); afterwards any member may check, and only the owner may
// run the sample test, which spends model time and is logged against the workspace.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const test = params.get("test") === "1";
  const fresh = params.get("fresh") === "1";
  if (!(await hasWorkspace())) return Response.json(await getHealth({ test, fresh }));

  try {
    const ctx = await requireMember(test ? "owner" : "assistant");
    const workspace = await getWorkspace(ctx);
    return Response.json(await getHealth({ test, fresh, aiConfig: workspace?.aiConfigJson, ctx }));
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: error.code === "forbidden" ? 403 : 401 });
    throw error;
  }
}
