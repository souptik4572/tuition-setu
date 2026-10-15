import { alternateModel } from "@/lib/ai/health";
import { requireMember } from "@/lib/auth/require-member";
import { AuthError } from "@/lib/auth/types";
import { getNote, updateNote } from "@/lib/db/queries/notes";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import { scheduleNote } from "@/lib/pipeline/process-note";

/**
 * Reads a note again (§7.2): Try again, Try the other model ({ alternate: true }) and Try now on
 * a note that couldn't be read. Answers at once with the new status; the reading runs in the
 * background and the note's page polls for it.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/notes/[id]/process">) {
  // Server Actions check this themselves; a route handler has to (§7.2).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });

  try {
    const ctx = await requireMember("assistant");
    const { id } = await params;
    const note = await getNote(ctx, id);
    if (!note) return Response.json({ error: "not_found" }, { status: 404 });
    if (note.status !== "failed" && note.status !== "captured") return Response.json({ status: note.status }, { status: 409 });

    const body = (await request.json().catch(() => ({}))) as { alternate?: boolean };
    let model: string | undefined;
    if (body.alternate === true) {
      model = (await alternateModel((await getWorkspace(ctx))?.aiConfigJson))?.name;
      if (!model) return Response.json({ error: "no_alternate" }, { status: 409 });
    }
    await updateNote(ctx, id, { status: "captured", errorCode: null });
    scheduleNote(ctx, id, { model });
    return Response.json({ status: "captured" }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: error.code === "forbidden" ? 403 : 401 });
    throw error;
  }
}
