import { networkInterfaces } from "node:os";

/** True when the URL points at this machine: localhost, 127.0.0.0/8 or ::1 (§2.2). Anything else shows the red banner. */
export function isLoopbackHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127(\.\d{1,3}){3}$/.test(host);
}

/** This laptop's Wi-Fi address for phones: the first non-internal IPv4, as `scripts/lan-ip.mjs` prints it for start.sh (§9.4). */
export function lanAddress(): string | null {
  return Object.values(networkInterfaces()).flat().find((a) => a?.family === "IPv4" && !a.internal)?.address ?? null;
}
