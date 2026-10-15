import { log } from "@/lib/log";

type Job = () => Promise<void>;

// On globalThis: pages, route handlers and instrumentation are separate bundles in one process,
// and they must share one queue so the AI reads one note at a time. It also survives dev reloads.
const g = globalThis as typeof globalThis & { __tsQueue?: { jobs: Map<string, Job>; running: string | null; idle: Promise<void> } };
const queue = (g.__tsQueue ??= { jobs: new Map(), running: null, idle: Promise.resolve() });

/** One job at a time, oldest first (IMPL §3.3). A key that is already waiting or running isn't added again. */
export function enqueue(key: string, job: Job): void {
  if (queue.running === key || queue.jobs.has(key)) return;
  queue.jobs.set(key, job);
  if (!queue.running) queue.idle = drain();
}

async function drain() {
  while (queue.jobs.size > 0) {
    const [key, job] = queue.jobs.entries().next().value!;
    queue.jobs.delete(key);
    queue.running = key;
    try {
      await job();
    } catch (error) {
      log("job_failed", { key, error: error instanceof Error ? error.name : "unknown" });
    }
  }
  queue.running = null;
}

/** Resolves once every queued job has finished; for tests and scripts. */
export function whenIdle(): Promise<void> {
  return queue.idle;
}
