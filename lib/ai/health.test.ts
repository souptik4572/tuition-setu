import { afterEach, describe, expect, it } from "vitest";
import { getHealth } from "./health";
import { DEFAULT_MODELS } from "./models";
import { OllamaProvider } from "./ollama";
import type { AIProvider } from "./provider";
import { fakeFetch, json, ndjson, type Route } from "./test-fetch";

const g = globalThis as typeof globalThis & { __tsAiProvider?: AIProvider };
const useOllama = (routes: Record<string, Route>) => {
  const f = fakeFetch(routes);
  g.__tsAiProvider = new OllamaProvider({ host: "http://127.0.0.1:11434", fetch: f.fetch });
  return f;
};
afterEach(() => {
  delete g.__tsAiProvider;
});

const tags = (...names: string[]) => () => json({ models: names.map((name) => ({ name, model: name, size: 4_600_000_000, details: {} })) });

describe("getHealth", () => {
  it("lists installed models and gives the pull command for each missing one, once", async () => {
    useOllama({ "/api/tags": tags("qwen3.5:9b") });
    const health = await getHealth({ aiConfig: { extract: "qwen3.5:9b" } });
    expect(health).toMatchObject({ provider: "ollama", reachable: true, loopback: true });
    expect(health.models).toEqual([
      { task: "extract", name: "qwen3.5:9b", installed: true, sizeGb: 4.6 },
      { task: "draft", name: DEFAULT_MODELS.draft, installed: false, sizeGb: 4.6 },
      { task: "vision", name: DEFAULT_MODELS.vision, installed: false, sizeGb: 4.6 },
    ]);
    expect(health.missing).toEqual([{ name: DEFAULT_MODELS.draft, command: `ollama pull ${DEFAULT_MODELS.draft}` }]);
    expect(health.ramGb).toBeGreaterThan(0);
    expect(health.qualityModeAvailable).toBe(health.ramGb > 12);
  });

  it("treats a name without a tag as :latest", async () => {
    useOllama({ "/api/tags": tags("gemma4:latest") });
    const health = await getHealth({ aiConfig: { extract: "gemma4", draft: "gemma4", vision: "gemma4" } });
    expect(health.models.every((m) => m.installed)).toBe(true);
    expect(health.missing).toEqual([]);
  });

  it("reports an engine that isn't running, without pull commands", async () => {
    useOllama({
      "/api/tags": () => {
        throw new TypeError("fetch failed");
      },
    });
    const health = await getHealth({ aiConfig: { extract: "unreachable-case" } });
    expect(health).toMatchObject({ reachable: false, missing: [] });
    expect(health.models.every((m) => !m.installed)).toBe(true);
  });

  it("runs the sample note through both models and checks the numbers", async () => {
    const f = useOllama({
      "/api/tags": tags(DEFAULT_MODELS.extract),
      "/api/show": () => json({ capabilities: ["completion"] }),
      "/api/chat": (body) =>
        body.stream
          ? ndjson([
              { message: { content: "Riya scored 14/20 (70%) in her Chapter 5 test." }, done: false },
              { message: { content: "" }, done: true, prompt_eval_count: 20, eval_count: 12, total_duration: 1e9 },
            ])
          : json({
              message: {
                content: JSON.stringify({
                  entries: [
                    {
                      name_as_written: "Riya",
                      source_span: "Riya ch5 test 14/20",
                      topics: ["ch5"],
                      assessments: [{ label: "ch5 test", scored: 14, max: 20, raw: "14/20" }],
                      homework: { status: "unknown", missed_count: null },
                      attendance: "unknown",
                      strengths: [],
                      concerns: [],
                      fee_mentioned: false,
                      remarks: null,
                    },
                  ],
                  unattributed: [],
                }),
              },
              done: true,
              prompt_eval_count: 300,
              eval_count: 80,
              total_duration: 2e9,
            }),
    });
    const health = await getHealth({ test: true });
    expect(health.test).toMatchObject({ ok: true, numbersOk: true, wrote: "Riya scored 14/20 (70%) in her Chapter 5 test." });
    const extract = f.calls.find((c) => c.path === "/api/chat" && !c.body.stream)!.body;
    expect(JSON.stringify(extract.messages)).toContain("Riya ch5 test 14/20");
  });

  it("fails the sample test when the sentence invents a number", async () => {
    useOllama({
      "/api/tags": tags(DEFAULT_MODELS.extract),
      "/api/show": () => json({ capabilities: [] }),
      "/api/chat": (body) =>
        body.stream
          ? ndjson([{ message: { content: "Riya scored 18/20." }, done: true, total_duration: 1 }])
          : json({
              message: { content: JSON.stringify({ entries: [{ name_as_written: "Riya", source_span: "Riya ch5 test 14/20", topics: [], assessments: [{ label: "test", scored: 14, max: 20, raw: "14/20" }], homework: { status: "unknown", missed_count: null }, attendance: "unknown", strengths: [], concerns: [], fee_mentioned: false, remarks: null }], unattributed: [] }) },
              done: true,
              total_duration: 1,
            }),
    });
    expect((await getHealth({ test: true })).test).toMatchObject({ ok: false, numbersOk: false, wrote: "Riya scored 18/20." });
  });

  it("skips the sample test when a model is missing", async () => {
    useOllama({ "/api/tags": tags() });
    expect((await getHealth({ test: true })).test).toMatchObject({ ok: false, error: "model_missing" });
  });
});
