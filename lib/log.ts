/** One line of server log: ids, durations and codes only, never note or message text (IMPL §3.5). */
export function log(event: string, data: Record<string, string | number | boolean | null | undefined> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
