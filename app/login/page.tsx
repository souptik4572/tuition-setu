import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { clientIp, pauseLeft } from "@/lib/auth/local/rate-limit";
import { requireMember } from "@/lib/auth/require-member";
import { getLocalOwner } from "@/lib/db/queries/members";
import { env } from "@/lib/env";
import { isLoopbackHost } from "@/lib/util/lan";
import { hostPlatform } from "@/lib/util/platform";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Sign in · TuitionSetu" };

/** Stage C (M1, F3; D-01, D-32). Hosted sign-in is M13. */
export default async function LoginPage() {
  if (env.APP_MODE === "hosted") notFound();
  // better-sqlite3 answers synchronously, so without this Next would render the page once, at build time.
  await connection();
  const owner = await getLocalOwner();
  if (!owner) redirect("/setup");
  if (await requireMember().then(() => true, () => false)) redirect("/");

  const h = await headers();
  const onLaptop = isLoopbackHost(`http://${h.get("host") ?? ""}`);
  return (
    <LoginScreen
      firstName={owner.displayName.trim().split(/\s+/)[0]}
      kind={owner.pinKind ?? "pin"}
      lockedForMs={pauseLeft(clientIp(h))}
      reset={onLaptop ? hostPlatform() : null}
    />
  );
}
