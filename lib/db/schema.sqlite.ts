// SPEC §6.1 plus IMPL Appendix A.1. lib/db/schema.pg.ts mirrors every table and column name.
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AiConfig } from "@/lib/schemas/settings";
import type { ExtractedEntry, Flag } from "@/lib/schemas/extraction";
import type { StudentFacts } from "@/lib/schemas/facts";
import type { GuardResult } from "@/lib/schemas/guard";
import type { TranscriptionResult } from "@/lib/schemas/transcription";

const now = () => new Date().toISOString();

const base = {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
};

const workspaceId = () =>
  text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

const LANGUAGES = ["en", "bn", "hi"] as const;
const ROLES = ["owner", "teacher", "assistant"] as const;

export const workspaces = sqliteTable("workspaces", {
  ...base,
  name: text("name").notNull(),
  subjectsJson: text("subjects_json", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  defaultLanguage: text("default_language", { enum: LANGUAGES }).notNull().default("en"),
  tone: text("tone", { enum: ["warm", "neutral", "formal"] }).notNull().default("warm"),
  reportDay: integer("report_day").notNull().default(0), // 0 = Sunday … 6 = Saturday, like Date.getDay()
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  includeFeeReminders: integer("include_fee_reminders", { mode: "boolean" }).notNull().default(false),
  deletePhotosAfterConfirm: integer("delete_photos_after_confirm", { mode: "boolean" }).notNull().default(true),
  aiConfigJson: text("ai_config_json", { mode: "json" }).$type<AiConfig>().notNull().$defaultFn(() => ({})),
  lastBackupAt: text("last_backup_at"),
});

export const members = sqliteTable(
  "members",
  {
    ...base,
    workspaceId: workspaceId(),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    signature: text("signature").notNull(),
    role: text("role", { enum: ROLES }).notNull(),
    status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
    pinHash: text("pin_hash"),
    pinSalt: text("pin_salt"),
    pinKind: text("pin_kind", { enum: ["pin", "passphrase"] }),
  },
  (t) => [uniqueIndex("members_workspace_user").on(t.workspaceId, t.userId), index("members_user_workspace").on(t.userId, t.workspaceId)],
);

export const students = sqliteTable(
  "students",
  {
    ...base,
    workspaceId: workspaceId(),
    fullName: text("full_name").notNull(),
    messageName: text("message_name").notNull(),
    nameNative: text("name_native"),
    aliasesJson: text("aliases_json", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    classGrade: text("class_grade").notNull(),
    batch: text("batch"),
    subjectsJson: text("subjects_json", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    parentName: text("parent_name"),
    parentPhone: text("parent_phone").notNull(),
    parentLanguage: text("parent_language", { enum: LANGUAGES }).notNull(),
    standingNotes: text("standing_notes"),
    feesPending: integer("fees_pending", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    archivedAt: text("archived_at"),
  },
  (t) => [index("students_workspace_status").on(t.workspaceId, t.status)],
);

export const cycles = sqliteTable(
  "cycles",
  {
    ...base,
    workspaceId: workspaceId(),
    label: text("label").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    status: text("status", { enum: ["open", "reviewing", "completed"] }).notNull().default("open"),
    completedAt: text("completed_at"),
  },
  // One open cycle at a time (§6.1), enforced by the database too.
  (t) => [uniqueIndex("cycles_one_open").on(t.workspaceId).where(sql`status <> 'completed'`)],
);

export const noteInputs = sqliteTable(
  "note_inputs",
  {
    ...base,
    workspaceId: workspaceId(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["typed", "photo"] }).notNull(),
    origin: text("origin", { enum: ["capture", "quick_note"] }).notNull().default("capture"),
    classDate: text("class_date").notNull(),
    batch: text("batch"),
    rawText: text("raw_text"),
    transcriptDraftJson: text("transcript_draft_json", { mode: "json" }).$type<TranscriptionResult>(),
    imagePath: text("image_path"),
    status: text("status", {
      enum: ["captured", "transcribing", "awaiting_transcript_review", "extracting", "processed", "failed"],
    })
      .notNull()
      .default("captured"),
    errorCode: text("error_code"),
  },
  (t) => [index("note_inputs_cycle_status").on(t.cycleId, t.status)],
);

export const extractedEntries = sqliteTable(
  "extracted_entries",
  {
    ...base,
    workspaceId: workspaceId(),
    noteInputId: text("note_input_id")
      .notNull()
      .references(() => noteInputs.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    nameAsWritten: text("name_as_written").notNull(),
    studentId: text("student_id").references(() => students.id, { onDelete: "cascade" }),
    resolution: text("resolution", { enum: ["exact", "alias", "fuzzy", "manual", "unmatched", "ignored"] }).notNull(),
    payloadJson: text("payload_json", { mode: "json" }).$type<ExtractedEntry>().notNull(),
    flagsJson: text("flags_json", { mode: "json" }).$type<Flag[]>().notNull().$defaultFn(() => []),
    confirmedAt: text("confirmed_at"),
  },
  (t) => [index("extracted_entries_cycle_student").on(t.cycleId, t.studentId)],
);

export const assessments = sqliteTable(
  "assessments",
  {
    ...base,
    workspaceId: workspaceId(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    entryId: text("entry_id").references(() => extractedEntries.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    scored: real("scored").notNull(),
    max: real("max").notNull(),
    takenOn: text("taken_on").notNull(),
  },
  (t) => [index("assessments_student_taken").on(t.studentId, t.takenOn)],
);

export const drafts = sqliteTable(
  "drafts",
  {
    ...base,
    workspaceId: workspaceId(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    language: text("language", { enum: LANGUAGES }).notNull(),
    factsJson: text("facts_json", { mode: "json" }).$type<StudentFacts>(),
    bodyModel: text("body_model").notNull().default(""),
    bodyFinal: text("body_final"),
    messageFinal: text("message_final").notNull().default(""),
    model: text("model"),
    promptVersion: text("prompt_version"),
    guardJson: text("guard_json", { mode: "json" }).$type<GuardResult>(),
    override: integer("override", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["generating", "ready", "flagged", "stale", "approved", "sent", "skipped"] }).notNull(),
    createdBy: text("created_by"),
    approvedBy: text("approved_by"),
    sentBy: text("sent_by"),
    approvedAt: text("approved_at"),
    sentAt: text("sent_at"),
  },
  (t) => [uniqueIndex("drafts_cycle_student_version").on(t.cycleId, t.studentId, t.version)],
);

// Local mode only (not in schema.pg.ts): hosted mode uses Supabase Auth sessions.
export const sessions = sqliteTable(
  "sessions",
  {
    ...base,
    workspaceId: workspaceId(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label").notNull(),
    userAgent: text("user_agent"),
    lastSeenAt: text("last_seen_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("sessions_token_hash").on(t.tokenHash)],
);

// Local mode only, P1 (§9.4).
export const pairingTokens = sqliteTable("pairing_tokens", {
  ...base,
  workspaceId: workspaceId(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

export const aiRuns = sqliteTable(
  "ai_runs",
  {
    ...base,
    workspaceId: workspaceId(),
    memberId: text("member_id"),
    task: text("task", { enum: ["transcribe", "extract", "draft", "health"] }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    inputChars: integer("input_chars"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    durationMs: integer("duration_ms").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    errorCode: text("error_code"),
  },
  (t) => [index("ai_runs_workspace_created").on(t.workspaceId, t.createdAt)],
);

export const auditEvents = sqliteTable("audit_events", {
  ...base,
  workspaceId: workspaceId(),
  actorMemberId: text("actor_member_id"),
  action: text("action").notNull(),
  targetTable: text("target_table"),
  targetId: text("target_id"),
  metaJson: text("meta_json", { mode: "json" }).$type<Record<string, unknown>>(),
});
