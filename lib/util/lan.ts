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
