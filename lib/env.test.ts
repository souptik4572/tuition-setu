import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const hosted = {
  APP_MODE: "hosted",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  DATABASE_URL: "postgres://u:p@host:6543/postgres",
  APP_URL: "https://tuitionsetu.tech",
  AI_PROVIDER_NAME: "DigitalOcean",
  AI_PROVIDER: "openai-compatible",
  OPENAI_COMPAT_BASE_URL: "https://inference.example.com/v1",
};

describe("parseEnv", () => {
  it("runs the local version with no settings at all", () => {
    const env = parseEnv({});
    expect(env.APP_MODE).toBe("local");
    expect(env.AI_PROVIDER).toBe("ollama");
    expect(env.OLLAMA_HOST).toBe("http://127.0.0.1:11434");
    expect(env.DATABASE_PATH).toBe("./data/tuition-setu.db");
    expect(env.SESSION_TTL_DAYS).toBe(30);
    expect(env.PREVIEW_INSTANCE).toBe(false);
    expect(env.AI_QUOTA_CALLS_PER_WORKSPACE_DAY).toBe(150);
  });

  it("treats empty values from .env.example as unset", () => {
    const env = parseEnv({ MODEL_DRAFT: "", OPENAI_COMPAT_BASE_URL: "  ", SESSION_TTL_DAYS: "" });
    expect(env.MODEL_DRAFT).toBeUndefined();
    expect(env.OPENAI_COMPAT_BASE_URL).toBeUndefined();
    expect(env.SESSION_TTL_DAYS).toBe(30);
  });

  it("parses booleans and numbers", () => {
    const env = parseEnv({ ...hosted, PREVIEW_INSTANCE: "true", SEED_SAMPLE: "1", AI_QUOTA_DRAFTS_PER_MEMBER_HOUR: "12" });
    expect(env.PREVIEW_INSTANCE).toBe(true);
    expect(env.SEED_SAMPLE).toBe(true);
    expect(env.AI_QUOTA_DRAFTS_PER_MEMBER_HOUR).toBe(12);
  });

  it("accepts a complete hosted configuration", () => {
    expect(parseEnv(hosted).APP_MODE).toBe("hosted");
  });

  it("names every missing hosted setting in one readable error", () => {
    expect(() => parseEnv({ APP_MODE: "hosted" })).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL: required when APP_MODE=hosted[\s\S]*DATABASE_URL[\s\S]*APP_URL[\s\S]*AI_PROVIDER_NAME/,
    );
  });

  it("requires a base URL for the OpenAI-compatible provider", () => {
    expect(() => parseEnv({ AI_PROVIDER: "openai-compatible" })).toThrowError(/OPENAI_COMPAT_BASE_URL: required/);
  });

  it("rejects values of the wrong shape", () => {
    expect(() => parseEnv({ APP_MODE: "cloud" })).toThrowError(/APP_MODE/);
    expect(() => parseEnv({ OLLAMA_HOST: "not a url" })).toThrowError(/OLLAMA_HOST/);
    expect(() => parseEnv({ SESSION_TTL_DAYS: "-3" })).toThrowError(/SESSION_TTL_DAYS/);
  });
});
