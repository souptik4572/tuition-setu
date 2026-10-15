// A stand-in for `fetch` in AI tests: routes by URL path and records every request body.

export type Route = (body: Record<string, unknown>, init: RequestInit) => Response | Promise<Response>;

export function fakeFetch(routes: Record<string, Route>) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname;
    const body = typeof init.body === "string" && init.body ? JSON.parse(init.body) : {};
    calls.push({ path, body });
    const route = routes[path];
    if (!route) return new Response(JSON.stringify({ error: `no route for ${path}` }), { status: 500, headers: { "content-type": "application/json" } });
    return route(body, init);
  }) as typeof fetch;
  return { fetch: impl, calls };
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const ndjson = (lines: unknown[]) => new Response(lines.map((l) => JSON.stringify(l)).join("\n") + "\n", { headers: { "content-type": "application/x-ndjson" } });

/** Never answers; rejects when the request is aborted, like a model that is still loading. */
export const hang: Route = (_body, init) =>
  new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true }));
