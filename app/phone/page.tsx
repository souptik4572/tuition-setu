import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { isLoopbackHost, lanAddress } from "@/lib/util/lan";
import { loadShell } from "../shell";
import { PhoneGuide, type PhoneStatus } from "./guide";

export const metadata: Metadata = { title: "Use on your phone · TuitionSetu" };

// Asks this laptop's own Wi-Fi address, so it only answers when TuitionSetu was started with --lan.
async function answersOnWifi(url: string): Promise<boolean> {
  try {
    await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

/** How to open TuitionSetu on a phone over the same Wi-Fi (IMPL D-42; SPEC §9.4 without pairing). */
export default async function PhonePage() {
  const ctx = await requirePageMember();
  const { shell } = await loadShell(ctx);
  const h = await headers();
  const host = h.get("host") ?? "";
  const port = new URL(`http://${host}`).port;
  const ip = lanAddress();
  const address = ip ? `http://${ip}${port ? `:${port}` : ""}` : null;

  let status: PhoneStatus;
  if (!isLoopbackHost(`http://${host}`)) status = "phone";
  else if (!address) status = "no_wifi";
  else status = (await answersOnWifi(`${address}/login`)) ? "ready" : "laptop_only";

  return (
    <AppShell {...shell}>
      <PhoneGuide status={status} address={address} platform={/android/i.test(h.get("user-agent") ?? "") ? "android" : "iphone"} />
    </AppShell>
  );
}
