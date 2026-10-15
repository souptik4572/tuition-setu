import { getHealth } from "@/lib/ai/health";

// M4 adds the member check and passes the workspace's model choices (IMPL M4 objectives).
export async function GET(request: Request) {
  const test = new URL(request.url).searchParams.get("test") === "1";
  return Response.json(await getHealth({ test }));
}
