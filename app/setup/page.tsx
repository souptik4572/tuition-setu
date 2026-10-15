import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { hasWorkspace } from "@/lib/db/queries/workspaces";
import { env } from "@/lib/env";
import { SetupWizard } from "./setup-wizard";

export const metadata: Metadata = { title: "Set up · TuitionSetu" };

/** B1–B3, open only until the workspace exists (§3 Stage B). Hosted mode has onboarding instead (M13). */
export default async function SetupPage() {
  if (env.APP_MODE === "hosted") notFound();
  // better-sqlite3 answers synchronously, so without this Next would render the page once, at build time.
  await connection();
  if (await hasWorkspace()) redirect("/login");
  return <SetupWizard />;
}
