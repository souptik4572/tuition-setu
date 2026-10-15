import "server-only";
import { z } from "zod";

const count = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const schema = z
  .object({
    APP_MODE: z.enum(["local", "hosted"]).default("local"),
    AI_PROVIDER: z.enum(["ollama", "openai-compatible"]).default("ollama"),
    OLLAMA_HOST: z.url().default("http://127.0.0.1:11434"),
    MODEL_EXTRACT: z.string().optional(),
    MODEL_DRAFT: z.string().optional(),
    MODEL_VISION: z.string().optional(),
    OPENAI_COMPAT_BASE_URL: z.url().optional(),
    OPENAI_COMPAT_API_KEY: z.string().optional(),
    DATABASE_PATH: z.string().default("./data/tuition-setu.db"),
    UPLOAD_DIR: z.string().default("./data/uploads"),
    SESSION_TTL_DAYS: count(30),
    SEED_SAMPLE: z.stringbool().default(false),
    REPO_URL: z.url().optional(),

    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SECRET_KEY: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    STORAGE_BUCKET: z.string().default("register-photos"),
    PREVIEW_INSTANCE: z.stringbool().default(false),
    AI_QUOTA_DRAFTS_PER_MEMBER_HOUR: count(30),
    AI_QUOTA_CALLS_PER_WORKSPACE_DAY: count(150),
    APP_URL: z.url().optional(),
    AI_PROVIDER_NAME: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const need = (key: keyof typeof env, when: string) => {
      if (env[key] === undefined) ctx.addIssue({ code: "custom", path: [key], message: `required when ${when}` });
    };
    if (env.AI_PROVIDER === "openai-compatible") need("OPENAI_COMPAT_BASE_URL", "AI_PROVIDER=openai-compatible");
    if (env.APP_MODE === "hosted") {
      for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL", "APP_URL", "AI_PROVIDER_NAME"] as const) {
        need(key, "APP_MODE=hosted");
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // `.env.example` leaves unused keys empty; treat them as unset so defaults apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example for every setting.`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
