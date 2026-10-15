// Mirrors lib/db/schema.sqlite.ts with the §19.12 type map: uuid, timestamptz, jsonb, boolean,
// numeric(6,2), date. Same table and column names, minus the local-only `sessions` and
// `pairing_tokens`, plus the hosted-only `invitations`. RLS policies live in supabase/migrations (M12).
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ExtractedEntry, Flag } from "@/lib/schemas/extraction";
import type { StudentFacts } from "@/lib/schemas/facts";
import type { GuardResult } from "@/lib/schemas/guard";
import type { AiConfig } from "@/lib/schemas/settings";
import type { TranscriptionResult } from "@/lib/schemas/transcription";

const now = () => new Date().toISOString();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

const base = {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  updatedAt: ts("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
};

const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

const LANGUAGES = ["en", "bn", "hi"] as const;
const ROLES = ["owner", "teacher", "assistant"] as const;

export const workspaces = pgTable("workspaces", {
  ...base,
  name: text("name").notNull(),
  subjectsJson: jsonb("subjects_json").$type<string[]>().notNull().$defaultFn(() => []),
  defaultLanguage: text("default_language", { enum: LANGUAGES }).notNull().default("en"),
  tone: text("tone", { enum: ["warm", "neutral", "formal"] }).notNull().default("warm"),
  reportDay: integer("report_day").notNull().default(0),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  includeFeeReminders: boolean("include_fee_reminders").notNull().default(false),
  deletePhotosAfterConfirm: boolean("delete_photos_after_confirm").notNull().default(true),
  aiConfigJson: jsonb("ai_config_json").$type<AiConfig>().notNull().$defaultFn(() => ({})),
  lastBackupAt: ts("last_backup_at"),
});

export const members = pgTable(
  "members",
  {
    ...base,
    workspaceId: workspaceId(),
    userId: uuid("user_id").notNull(),
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

export const students = pgTable(
  "students",
  {
    ...base,
    workspaceId: workspaceId(),
    fullName: text("full_name").notNull(),
    messageName: text("message_name").notNull(),
    nameNative: text("name_native"),
    aliasesJson: jsonb("aliases_json").$type<string[]>().notNull().$defaultFn(() => []),
    classGrade: text("class_grade").notNull(),
    batch: text("batch"),
    subjectsJson: jsonb("subjects_json").$type<string[]>().notNull().$defaultFn(() => []),
    parentName: text("parent_name"),
    parentPhone: text("parent_phone").notNull(),
    parentLanguage: text("parent_language", { enum: LANGUAGES }).notNull(),
    standingNotes: text("standing_notes"),
    feesPending: boolean("fees_pending").notNull().default(false),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    archivedAt: ts("archived_at"),
  },
  (t) => [index("students_workspace_status").on(t.workspaceId, t.status)],
);

export const cycles = pgTable(
  "cycles",
  {
    ...base,
    workspaceId: workspaceId(),
    label: text("label").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    status: text("status", { enum: ["open", "reviewing", "completed"] }).notNull().default("open"),
    completedAt: ts("completed_at"),
  },
  (t) => [uniqueIndex("cycles_one_open").on(t.workspaceId).where(sql`status <> 'completed'`)],
);

export const noteInputs = pgTable(
  "note_inputs",
  {
    ...base,
    workspaceId: workspaceId(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["typed", "photo"] }).notNull(),
    origin: text("origin", { enum: ["capture", "quick_note"] }).notNull().default("capture"),
    classDate: date("class_date", { mode: "string" }).notNull(),
    batch: text("batch"),
    rawText: text("raw_text"),
    transcriptDraftJson: jsonb("transcript_draft_json").$type<TranscriptionResult>(),
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

export const extractedEntries = pgTable(
  "extracted_entries",
  {
    ...base,
    workspaceId: workspaceId(),
    noteInputId: uuid("note_input_id")
      .notNull()
      .references(() => noteInputs.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    nameAsWritten: text("name_as_written").notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    resolution: text("resolution", { enum: ["exact", "alias", "fuzzy", "manual", "unmatched", "ignored"] }).notNull(),
    payloadJson: jsonb("payload_json").$type<ExtractedEntry>().notNull(),
    flagsJson: jsonb("flags_json").$type<Flag[]>().notNull().$defaultFn(() => []),
    confirmedAt: ts("confirmed_at"),
  },
  (t) => [index("extracted_entries_cycle_student").on(t.cycleId, t.studentId)],
);

export const assessments = pgTable(
  "assessments",
  {
    ...base,
    workspaceId: workspaceId(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => extractedEntries.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    scored: numeric("scored", { precision: 6, scale: 2, mode: "number" }).notNull(),
    max: numeric("max", { precision: 6, scale: 2, mode: "number" }).notNull(),
    takenOn: date("taken_on", { mode: "string" }).notNull(),
  },
  (t) => [index("assessments_student_taken").on(t.studentId, t.takenOn)],
);

export const drafts = pgTable(
  "drafts",
  {
    ...base,
    workspaceId: workspaceId(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    language: text("language", { enum: LANGUAGES }).notNull(),
    factsJson: jsonb("facts_json").$type<StudentFacts>(),
    bodyModel: text("body_model").notNull().default(""),
    bodyFinal: text("body_final"),
    messageFinal: text("message_final").notNull().default(""),
    model: text("model"),
    promptVersion: text("prompt_version"),
    guardJson: jsonb("guard_json").$type<GuardResult>(),
    override: boolean("override").notNull().default(false),
    status: text("status", { enum: ["generating", "ready", "flagged", "stale", "approved", "sent", "skipped"] }).notNull(),
    createdBy: uuid("created_by"),
    approvedBy: uuid("approved_by"),
    sentBy: uuid("sent_by"),
    approvedAt: ts("approved_at"),
    sentAt: ts("sent_at"),
  },
  (t) => [uniqueIndex("drafts_cycle_student_version").on(t.cycleId, t.studentId, t.version)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    ...base,
    workspaceId: workspaceId(),
    memberId: uuid("member_id"),
    task: text("task", { enum: ["transcribe", "extract", "draft", "health"] }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    inputChars: integer("input_chars"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    durationMs: integer("duration_ms").notNull(),
    ok: boolean("ok").notNull(),
    errorCode: text("error_code"),
  },
  (t) => [index("ai_runs_workspace_created").on(t.workspaceId, t.createdAt)],
);

export const auditEvents = pgTable("audit_events", {
  ...base,
  workspaceId: workspaceId(),
  actorMemberId: uuid("actor_member_id"),
  action: text("action").notNull(),
  targetTable: text("target_table"),
  targetId: uuid("target_id"),
  metaJson: jsonb("meta_json").$type<Record<string, unknown>>(),
});

// Hosted mode only (§19.4).
export const invitations = pgTable("invitations", {
  ...base,
  workspaceId: workspaceId(),
  email: text("email").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
});
