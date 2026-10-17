import { getProvider, modelFor } from "@/lib/ai";
import { toAiError } from "@/lib/ai/errors";
import { DRAFT_PROMPT_VERSION, draftPrompt } from "@/lib/ai/prompts/draft";
import { recordAiRun } from "@/lib/ai/run";
import { requireMember } from "@/lib/auth/require-member";
import { AuthError } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { setCycleStatus } from "@/lib/db/queries/cycles";
import { getLiveDraft, insertDraft } from "@/lib/db/queries/drafts";
import { checkAndAssemble, loadDraftContext } from "@/lib/pipeline/draft";

const ERRORS: Record<string, string> = {
  timeout: "The AI engine took too long. Your note is safe and nothing was sent.",
  provider_unreachable: "The AI engine stopped partway through. Your note is safe and nothing was sent.",
  model_missing: "The writing model isn't installed on the laptop. Your note is safe and nothing was sent.",
};

/**
 * S8: writes one student's update as a stream (§7.2, IMPL M9). One JSON object per line:
 * `token` while it writes, then `done` with the stored draft, or `error`. Nothing is stored when
 * it fails or the reader stops; the previous version, if any, stays live.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "forbidden" }, { status: 403 });

  let ctx;
  try {
    ctx = await requireMember("teacher");
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: error.code === "forbidden" ? 403 : 401 });
    throw error;
  }
  const input = (await request.json().catch(() => null)) as { cycleId?: unknown; studentId?: unknown } | null;
  if (typeof input?.cycleId !== "string" || typeof input.studentId !== "string") return Response.json({ error: "invalid" }, { status: 400 });

  const dc = await loadDraftContext(ctx, input.cycleId, input.studentId);
  if (!dc) return Response.json({ error: "not_found" }, { status: 404 });
  if (!dc.hasNotes) return Response.json({ error: "no_notes" }, { status: 409 });
  if ((await getLiveDraft(ctx, dc.cycle.id, dc.student.id))?.status === "sent") return Response.json({ error: "sent" }, { status: 409 });

  const provider = getProvider();
  const model = modelFor("draft", dc.workspace.aiConfigJson);
  const prompt = draftPrompt({ facts: dc.facts, language: dc.student.parentLanguage, tone: dc.workspace.tone });
  const meta = { task: "draft" as const, provider: provider.name, model, promptVersion: DRAFT_PROMPT_VERSION, inputChars: prompt.user.length };
  const started = Date.now();
  const { stream, usage } = provider.streamText({ task: "draft", model, system: prompt.system, prompt: prompt.user, temperature: 0.4, timeoutMs: 90_000 });
  const reader = stream.getReader();
  const encoder = new TextEncoder();
  let stopped = false;

  const body = new ReadableStream<Uint8Array>({
    async start(out) {
      const send = (event: object) => {
        if (!stopped) out.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let text = "";
      try {
        for (let next = await reader.read(); !next.done; next = await reader.read()) {
          text += next.value;
          send({ type: "token", text: next.value });
        }
        if (stopped) return;
        const checked = checkAndAssemble(dc, text);
        const draft = await withDb(ctx, async () => {
          const row = await insertDraft(ctx, {
            cycleId: dc.cycle.id,
            studentId: dc.student.id,
            language: dc.student.parentLanguage,
            factsJson: dc.facts,
            bodyModel: checked.body,
            messageFinal: checked.message,
            model,
            promptVersion: DRAFT_PROMPT_VERSION,
            guardJson: checked.guard,
            status: checked.status,
            createdBy: ctx.memberId,
          });
          // The week moves to reviewing with its first draft (§4.1).
          if (dc.cycle.status === "open") await setCycleStatus(ctx, dc.cycle.id, "reviewing");
          return row;
        });
        await recordAiRun(ctx, meta, { durationMs: Date.now() - started, usage: await usage.catch(() => undefined) });
        send({ type: "done", draft: { id: draft.id, version: draft.version, status: draft.status, message: checked.message, bodyOffset: checked.bodyOffset, guard: checked.guard } });
      } catch (error) {
        const failure = toAiError(error);
        await recordAiRun(ctx, meta, { durationMs: Date.now() - started, error: failure });
        send({ type: "error", code: failure.code, message: ERRORS[failure.code] ?? "Something went wrong while writing. Your note is safe and nothing was sent." });
      } finally {
        if (!stopped) out.close();
      }
    },
    cancel() {
      stopped = true;
      void reader.cancel();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
