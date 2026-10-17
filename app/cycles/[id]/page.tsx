import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { loadShell } from "../../shell";
import { loadReview } from "../data";
import { ReviewScreen } from "./review";

export const metadata: Metadata = { title: "Weekly review · TuitionSetu" };

/** The weekly review (D3, M6–M9). `?student=` opens one student's update. */
export default async function ReviewPage(props: PageProps<"/cycles/[id]">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const ctx = await requirePageMember();
  const { workspace, shell } = await loadShell(ctx);
  const review = await loadReview(ctx, id, typeof query.student === "string" ? query.student : undefined, workspace.timezone);
  if (!review) notFound();
  return (
    // One student's update on a phone is full screen with its keys pinned (M7), so no bottom nav there.
    <AppShell {...shell} phoneNav={!review.chosen}>
      <ReviewScreen review={review} canAct={ctx.role !== "assistant"} />
    </AppShell>
  );
}
