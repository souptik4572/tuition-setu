# TuitionSetu — Product & Technical Specification

| | |
|---|---|
| **Version** | 0.1 (draft) — 15 Oct 2026 · both versions ship for the hackathon |
| **Deliverables** | **Local version:** clone the repo and run `./setup.sh` · **Hosted version:** public sign-up at the app URL (§19) |
| **Owner** | Souptik |
| **Context** | DEV Hacktoberfest 2026 · Open-Source AI Challenge · Week 2 "Side Hustle" |
| **Submission deadline** | 18 Oct 2026, 11:59 PM PDT (= 19 Oct 2026, 12:29 PM IST) |
| **Build budget** | 2 working days |
| **Name** | "TuitionSetu" is a working name |

**Priority legend** used throughout: **P0** = must ship for the hackathon · **P1** = ship if time allows · **P2** = roadmap, out of scope for the hackathon.

---

## 0. Summary

TuitionSetu turns a private tutor's messy weekly notes — typed shorthand or a photo of the class register — into an accurate, personalised WhatsApp update for each student's parent, in that parent's language.

It runs on the tutor's own laptop: a single Next.js app plus an open-weight model served by Ollama. The tutor's phone connects over home Wi-Fi to capture notes and send messages. Nothing about the children leaves the house.

For the hackathon there are **two versions from one codebase**:

- **Local version** — clone the repo, run `./setup.sh`, and the app, database and AI all run on the tutor's laptop. This is the privacy-first product described above.
- **Hosted version** — a public URL where anyone can sign up, create a workspace and try TuitionSetu. It uses Supabase Postgres, Supabase Auth accounts, and role-based access enforced by Postgres row-level security (§19).

The model is used for what it is good at (reading messy notes, writing warm prose in Bengali/Hindi/English). Everything that must be exactly right — which student a note belongs to, every number, fee reminders, sign-offs — is handled by deterministic code, and every message is approved by the tutor before it is sent.

---

## 1. Context and decisions

### 1.1 Problem

A home tutor with 20–40 students should send each parent a short weekly update. In practice the notes live in a paper register, WhatsApp-to-self messages and memory, and writing 30 individual messages on a Sunday evening takes hours, so it gets skipped. Parents who feel uninformed are the ones who quietly stop sending their child.

### 1.2 Users

**Primary — the tutor ("Mita", fictional persona).** Teaches maths and science to ~25 students (Classes 6–9) in five evening batches from home in Kolkata. Android phone, 8 GB Windows laptop. Not technical. Writes notes in English shorthand mixed with Bengali words. Parents prefer Bengali or English.

**Secondary — the parent.** Receives a WhatsApp message. Never installs or opens TuitionSetu.

**Operator — the developer.** Installs TuitionSetu on the tutor's laptop the first time (Stage A).

**Hosted mode adds** teachers and assistants at coaching centres, as members of a shared workspace with their own roles (§19.5).

**Visitors and judges** sign up on the hosted version and try it with sample students (§19.14).

### 1.3 Goals

| ID | Goal | How we know |
|---|---|---|
| G1 | A full weekly round of updates for ~25 students takes under 20 minutes | Measured with the first user |
| G2 | Zero wrong numbers reach a parent | Number guard (§4, S9) + human approval |
| G3 | A student's information never reaches another student's parent | Name resolution (S6) + cross-student guard (S9) |
| G4 | Works fully offline on a mid-range laptop | Local mode has no outbound calls |
| G5 | Messages read naturally in the parent's language | Language guard + first-user feedback |
| G6 | Capturing a note never depends on the AI being available | Capture saves before any AI call |

### 1.4 Non-goals (v1)

- A parent-facing app or portal
- Automatic sending (WhatsApp Business API) — every message is sent by the tutor via a `wa.me` link
- Fee ledger, payments or invoicing (only an optional "fee pending" reminder line)
- In the hackathon build: phone-OTP sign-in, multi-factor authentication, per-batch access for teachers, and a self-hosted inference server for the hosted version (§19 marks these P2)
- A native Android/iOS app
- Generating tests, homework or lesson plans

### 1.5 Key decisions

| # | Decision | Why | Revisit when |
|---|---|---|---|
| D1 | One Next.js + TypeScript app (App Router, server-rendered). Server Actions and Route Handlers are the backend. No separate service. | Fewest moving parts; one process; one language | Never for v1 |
| D2 | One data-access layer with two backends: a SQLite file via Drizzle (`better-sqlite3`) in local mode; Supabase Postgres via Drizzle (`postgres` driver) in hosted mode | Local: zero config, one-file backup, data stays on the laptop. Hosted: managed Postgres, backups, row-level security | — |
| D3 | Open-weight models only. Local version: Ollama on the laptop. Hosted version: an OpenAI-compatible endpoint serving an open-weight model, later our own inference server (§19.8) | Privacy is the product; ₹0 marginal inference cost locally | — |
| D4 | Phone access = the same web app over the home LAN, not a native app. Camera via `<input type="file" capture>` | No app-store delay; works over plain HTTP | Adoption proves the need → native app with on-device model (§17) |
| D5 | The model never does arithmetic, never decides which student a note belongs to, and never writes fee lines, greetings or sign-offs | These must be exactly right; code is deterministic and testable | — |
| D6 | A human approves every message; the app never sends on its own | Trust; WhatsApp automation is out of scope | — |
| D7 | Every domain table carries `workspace_id` (the tenant) from day one. Local mode has exactly one workspace with one member, its owner | Hosted mode becomes a data copy plus policies, not a redesign | — |
| D8 | IDs are UUID strings; timestamps are ISO-8601 strings; JSON stored as text | Portable to Postgres (`uuid`, `timestamptz`, `jsonb`) | — |
| D9 | `APP_MODE=local` or `hosted` selects three adapters: database, authentication and file storage. Pipeline, prompts and screens are identical in both | One codebase; local mode stays the privacy-first product | — |
| D10 | Authentication: local PIN (local mode) or Supabase Auth (hosted mode). Authorization: active membership plus role in a workspace, enforced in the app **and** by Postgres row-level security in hosted mode | Database rules protect data even if an app check is missed; app checks give clear errors | — |
| D11 | Two hackathon deliverables from one repo: the **local version** (clone + `./setup.sh`) and the **hosted version** (public sign-up at the app URL) | Local proves the privacy-first product with a real tutor; hosted lets judges and visitors try it in two minutes | After judging (§18, Q7) |

---

## 2. System overview

### 2.1 Architecture

```
 Tutor's phone (browser, same Wi-Fi)                 Tutor's laptop
 ┌──────────────────────────┐   HTTP over LAN   ┌────────────────────────────────────────┐
 │ Quick capture (text/photo)│ ───────────────▶ │ Next.js server (Node runtime)          │
 │ Review & "Send on WhatsApp"│                  │  ├─ Pages (React Server Components)    │
 └────────────┬─────────────┘                   │  ├─ Server Actions (CRUD, approvals)    │
              │ wa.me deep link                  │  ├─ Route Handlers (AI streaming,       │
              ▼                                  │  │   uploads, export, backup)           │
        WhatsApp app                             │  ├─ lib/pipeline (S1–S12, §4)          │
   (tutor presses Send)                          │  ├─ SQLite file  data/tuition-setu.db   │
                                                 │  └─ data/uploads/  (temporary photos)   │
                                                 │              │ http://127.0.0.1:11434   │
                                                 │              ▼                          │
                                                 │   Ollama — open-weight models           │
                                                 └────────────────────────────────────────┘
```

### 2.2 Network and trust boundaries

- Next.js listens on `127.0.0.1` by default. LAN mode (`0.0.0.0`) is opt-in via `npm run start:lan`, and requires a PIN-authenticated session for every page.
- Ollama listens on `127.0.0.1` only. Only the Next.js server talks to it; the phone never does.
- In local mode the app makes **no outbound internet calls**: no analytics, no runtime CDN (fonts are self-hosted by `next/font` at build time).
- Over LAN the page is plain HTTP, which browsers treat as an insecure context. Consequences the design accepts:
  - no service worker (the "install" is a home-screen shortcut, not an offline PWA);
  - no `getUserMedia` (we use `<input type="file" accept="image/*" capture="environment">`, which works without a secure context);
  - session cookies must **not** set `Secure` when the request is HTTP.
- If the configured AI provider is not a loopback address, every page shows a red banner: "AI runs outside this device — student data leaves this laptop." (Applies to local mode. Hosted mode tells users where data goes at sign-up instead, §19.4.)
- **Hosted mode** (§19) is served over HTTPS, which is a secure context: service workers, a real installable PWA and the camera API all become available there.

### 2.3 Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (latest stable), App Router, React, TypeScript `strict` |
| Runtime | Node.js LTS; all routes use the Node runtime (SQLite needs a filesystem) |
| UI | Tailwind CSS + shadcn/ui components |
| Fonts | `next/font/google` (self-hosted at build time): Nunito for Latin UI, Baloo 2 for display and Devanagari, Baloo Da 2 for Bengali |
| Database | Local: SQLite via `better-sqlite3`. Hosted: Supabase Postgres via `postgres`. Both through Drizzle ORM and `drizzle-kit` |
| Auth (hosted) | Supabase Auth with `@supabase/ssr` (§19.3) |
| Hosting (hosted) | A Node server host: Render, DigitalOcean App Platform or Vercel (§19.14) |
| Local install | `setup.sh` / `start.sh` (macOS, Linux); `setup.ps1` / `start.ps1` (Windows, P1) (§13.4) |
| Validation | Zod — one schema per shape, shared by forms, DB I/O and AI outputs |
| AI client | `ollama` npm package (native `/api/chat`, JSON-schema `format`, `images`) |
| Zod → JSON Schema | `z.toJSONSchema()` (Zod 4) or `zod-to-json-schema` |
| QR codes (P1) | `qrcode` |
| Tests | Vitest (unit tests and the eval runner) |
| Sending Email | resend (https://resend.com/) with proper configurable HTML templates |

---

## 3. User journey: from first launch to everyday habit

The journey has six stages. Stages A–C happen once or rarely; D and E are the habit loop; F is what makes the app better the longer it is used.

```
A Install ──▶ B First-launch setup ──▶ C Login ──▶ ┌─▶ D Daily capture ──┐
   (once)        (once)                 (per device) │                     │
                                                     └── E Weekly review ◀─┘
                                                          & send
                                          F Learning & maintenance (ongoing)
```

Stages A–C below describe **local mode**. Hosted mode replaces them with sign-up, workspace creation and invitations (§19.4); Stages D–F are the same in both modes.

### Stage A — Install with one script (local version) · P0

Prerequisites: Node.js LTS and Ollama installed. The script checks both and prints the download links if either is missing. Then:

```bash
git clone https://github.com/<owner>/tuition-setu.git
cd tuition-setu
./setup.sh          # Windows: .\setup.ps1 (P1)
./start.sh          # add --lan to reach it from a phone on the same Wi-Fi
```

`setup.sh` is specified in §13.4 and is safe to run again. `start.sh` prints the laptop address and, with `--lan`, the Wi-Fi address (P1: plus a QR code for the phone).

Optional: a desktop shortcut or login item that runs `start.sh`, so the tutor never touches a terminal.

**Acceptance:** on a machine with Node and Ollama already installed, `./setup.sh` finishes with no manual steps (model download time aside), and `./start.sh` serves the setup wizard at `http://localhost:3000`.

### Stage B — First launch: setup wizard (`/setup`) · P0

Available only while no workspace exists; afterwards `/setup` redirects to `/login`. Finishing B2–B3 creates the workspace and its owner member.

B1 is an unnumbered welcome. B2–B7 are the numbered steps "Setting up · step n of 6" (About you, PIN, AI check, Students, Phone, Try it). Phone and Try it appear only once they are built.

| Step | Screen | What happens | Priority |
|---|---|---|---|
| B1 | Welcome | One paragraph: what TuitionSetu does, and that all data stays on this laptop | P0 |
| B2 | About you | Display name, message signature (e.g. "Mita Ma'am"), subjects, default message language, tone (warm / neutral / formal), report day (default Sunday), include fee reminders (default off). Name and signature are required. A side panel previews how an update will sound in the chosen language and tone, with the greeting, fee line and signature built by the same code as real messages (§S10) | P0 |
| B3 | Set a PIN | 6-digit PIN, or a passphrase of 8+ characters, entered twice. Common PINs are refused (§9.1). Explains: "Anyone on your Wi-Fi could open this page — your PIN keeps student details private." | P0 |
| B4 | AI check | Calls `GET /api/ai/health`: is Ollama running, which models are installed, laptop RAM. Recommends a default model (≤12 GB RAM → small model only; >12 GB → also offers "quality mode"). Runs one short test generation and shows the time taken. If a model is missing, shows the exact `ollama pull` command. | P0 |
| B5 | Add students | Manual form, one student at a time, with a running list of students added so far. "I'll add students later" skips the step. **P1:** "Paste a list": one student per line (name, class, parent's WhatsApp number, language, separated by commas or tabs), parsed by code into a checked list (§5.4) | P0 / P1 |
| B6 | Connect your phone | QR code that pairs the phone in one scan (see §9.4). Skippable | P1 |
| B7 | Try it | A pre-filled sample note using the tutor's own roster runs through the full pipeline so she sees a real draft before her first real week. Sample data is deleted afterwards | P1 |

On finishing B3 the tutor is signed in on this device and lands on the dashboard after B4–B7.

**Student fields collected in B5:** full name, the name to use in messages (filled in from the first name), class, batch (optional), subjects, parent's name (optional), parent's WhatsApp number, parent's language (`en`, `bn`, `hi`; P1: Roman-script Bengali/Hindi), nicknames (optional), standing notes for messages (optional, e.g. "father prefers short messages"). Full name, message name, class, number and language are required. A form with missing fields keeps what was typed and lists what's left to fill in.

Phone numbers are normalised on save: strip spaces, `+`, dashes and a leading `0`; a 10-digit Indian number gets `91` prefixed. A number typed with `+` and a country code other than 91 is kept as an international number. Stored as digits only, e.g. `919800000000`. The form shows the result ("Messages will go to +91 98000 00001"), says when it tidied the input, and gives the digit count when a number is too short. Two students may share a number (siblings); the form notes this but doesn't block it. **Check on WhatsApp** opens `https://wa.me/<number>` with no text, so the tutor can see whose name and photo come up.

### Stage C — Returning login (`/login`) · P0

- PIN screen: a 6-digit pad that submits on the 6th digit, or a text field when the tutor chose a passphrase. Successful login creates a 30-day sliding session for this device.
- A wrong PIN says how many tries are left before the pause. 5 failed attempts within 10 minutes → locked for 10 minutes, shown as a live countdown with the keypad disabled.
- "Forgot PIN" explains: run `npm run reset-pin` on the laptop (physical access to the laptop is the trust anchor). This works during the 10-minute pause. On the laptop itself the steps appear right on the PIN screen. Resetting signs out every device.
- P1: Settings → Devices lists signed-in devices with "Sign out" per device.

### Stage D — Daily capture (after each class) · P0

The tutor's daily action is small: right after a batch ends, open TuitionSetu on the phone (home-screen shortcut) and capture.

1. Tap **Quick note**. The current week's cycle is created automatically if none is open.
2. Either **type** shorthand ("Riya ch5 test 14/20 careless in algebra, missed HW twice; Arjun absent; Tanmoy improving in fractions") or tap **Photo** to photograph the register page (P0 typed; P1 photo).
3. Optional: pick the batch and class date (defaults: no batch, today).
4. Tap **Save**. The note is stored immediately with status `captured` — no AI involved, so saving never fails because the model is busy or down.
5. Processing then starts automatically (S2–S7 in §4). A status chip on the note shows progress.
6. Anything the app is not sure about lands in the **Needs you** inbox on the dashboard: a name it cannot match, a score without a total, a handwriting line it was unsure of.

Typical daily effort: under a minute per batch, plus clearing any "Needs you" items.

### Stage E — Weekly review and send (on the report day) · P0

1. The dashboard shows the open cycle: students with notes, students without notes, drafts ready, sent.
2. Tap **Review this week** → the review screen (desktop: split view; phone: list → detail).
3. Tap **Generate drafts**. Drafts are generated one student at a time (the local model handles one request at a time well); each streams into a WhatsApp-style bubble.
4. Each draft is checked by the guard (S9). Passed drafts show a green tick; flagged drafts highlight the exact problem text (e.g. a number not in the notes).
5. For each student the tutor can: **Edit** the text, **Regenerate** (P1: "warmer", "shorter", "more formal"), fix a fact (e.g. correct a score), **Skip** this week, or **Approve**. A fact change, or a new note about the student, makes the draft **Out of date** (§4.1). The draft then shows which numbers changed ("was 14/20, now 15/20") and can't be approved until it is written again or edited to match.
6. **Send on WhatsApp** opens `https://wa.me/<number>?text=<message>`; the tutor presses Send inside WhatsApp.
7. Back in TuitionSetu, a prompt asks "Sent?" → **Mark sent** / **Not yet**. (The app cannot see WhatsApp, so it never assumes.) Approved drafts that aren't marked sent wait in a **Waiting to send** group with **Mark as sent** and **Open WhatsApp**. Sent students collapse into one **Sent** row.
8. Students without notes are listed separately with **Add a quick note** or **Skip this week**. A quick note is typed right there and **Write update** turns it into a draft. Skipping means that parent gets no message this week. Undo is available on every skip.
9. **Complete week** is enabled when every student is sent or skipped; until then it says who is left. **Complete week early…** asks first, lists who isn't done, and marks them skipped. Approved drafts are kept, so they can still be sent later. Completing shows a summary: sent, skipped, edited-before-sending, minutes taken, and the date the next week starts.

### Stage F — Learning and maintenance (ongoing)

| Behaviour | What happens | Priority |
|---|---|---|
| Nickname learning | When the tutor assigns an unmatched name ("Riyu") to a student, the app offers "Remember 'Riyu' as Riya" (default on). Next time it matches automatically | P0 |
| Trends | From the second week, drafts can say a student is improving or slipping, computed in code from stored scores (S7) | P0 |
| Standing notes | Per-student notes ("mother reads English", "keep it short") are passed to every draft for that student | P0 |
| Student history | Student page shows past messages and a score table; P1 adds a small trend chart | P0 / P1 |
| Backup | Settings → "Download backup" saves a copy of the database file; a gentle reminder appears if no backup in 30 days | P1 |
| Archive / delete | Archive a student who has left: hidden from the roster, weekly reviews and name matching, history kept, **Restore** any time (Students → Archived). Delete removes the student and all their data permanently — for when a parent asks. It needs the student's full name typed to confirm and says that messages already sent stay in the parent's WhatsApp | P0 |

### Journey timeline (what "dedicated daily use" looks like)

| When | Tutor's experience |
|---|---|
| Day 0 | Developer installs; tutor completes setup and adds students (~15 min) |
| Week 1 | Captures after each class; first Sunday review needs some edits and a few "Needs you" answers as nicknames are learned |
| Weeks 2–4 | Most names match automatically; trends start appearing; Sunday review is mostly read → approve → send |
| Month 2+ | The register photo is the habit; history per student is useful at parent–teacher conversations |

---

## 4. The pipeline

Every note travels through the same stages. **Model** stages are marked 🤖; everything else is deterministic code or a human step.

```
S1 Capture ─▶ S2 🤖 Transcribe ─▶ S3 Review transcript ─▶ S4 🤖 Extract ─▶ S5 Validate
 (typed notes skip S2–S3)          (human, photo only)                     (code)
                                                                              │
S12 Send & log ◀─ S11 Approve ◀─ S10 Assemble ◀─ S9 Guard ◀─ S8 🤖 Draft ◀─ S7 Build facts ◀─ S6 Resolve names
  (human)          (human)         (code)         (code)                     (code)              (code + human)
```

Stages S1–S6 run per **note** (daily). Stages S7–S12 run per **student per cycle** (weekly).

### 4.1 Status machines

**Note input**

```
captured ─▶ transcribing ─▶ awaiting_transcript_review ─▶ extracting ─▶ processed
    │                                                         │
    └──────────────(typed notes)──────────────────────────────┘
any AI step can fail ─▶ failed (keeps raw input; "Retry" returns it to the failed step)
processed may still have entries in the "Needs you" inbox (S5/S6 flags)
```

A `failed` note is shown as **Couldn't read**, always with the note exactly as typed ("Your note is saved"), and with actions that depend on the cause:

| Cause (`error_code`) | Actions |
|---|---|
| `timeout` | Try again · Use the faster model |
| `invalid_json`, `schema_mismatch` (couldn't make sense of it) | Try again · Try the other model · Edit the note |
| `provider_unreachable` (AI engine off, local mode) | Try now. The note is retried automatically as soon as the engine answers again |
| unreadable photo (P1) | Retake · Type it instead |

**Draft**

```
generating ─▶ ready ───────────┐
     │          (guard passed) ├─▶ approved ─▶ sent
     └──────▶ flagged ─────────┘      ▲
               (guard issues;          │ edits re-run the guard;
                approve requires       │ a fact change or a new note marks the draft stale
                edit or override)      │
stale ─▶ (write again) ─▶ generating   skipped (from any state before sent)
stale ─▶ (edit the text) ─▶ ready / flagged (guard re-run against the current facts)
```

**Stale ("Out of date" in the UI)**: a live draft becomes `stale` when one of the student's facts changes (a score edited in the facts panel) or a new entry about the student is confirmed after the draft was written. This applies to `ready`, `flagged` and `approved` drafts. An approved draft loses its approval, so nothing old goes out. A `sent` draft is never changed: it shows "Sent before this change — next week's update will use the new score." A stale draft can't be approved. If the tutor had edited the text, **Write again** warns that it replaces the edits, and **Keep my text** re-runs the guard on the edited text against the current facts.

**Cycle**: `open` (notes accumulate) → `reviewing` (first draft generated) → `completed` (all students sent or skipped, or tutor closes it).

### S1 — Capture · P0 (typed) / P1 (photo)

| | |
|---|---|
| Trigger | Tutor saves a Quick note |
| Input | Typed text **or** a photo; optional batch; class date (default today, `Asia/Kolkata`) |
| Processing | Attach to the open cycle (create one if none: Monday–Sunday containing the class date). **Photos are downscaled in the browser** before upload: longest side ≤ 1600 px, JPEG quality 0.85, via `createImageBitmap` + canvas. Server accepts ≤ 8 MB, checks magic bytes (JPEG/PNG/WebP), stores under `data/uploads/<uuid>.jpg` (outside `public/`) |
| Output | `note_inputs` row, status `captured` |
| Failure | Upload error → keep the form filled, show retry. Never lose typed text (also kept in `sessionStorage` until saved) |

### S2 — Transcribe 🤖 · P1 (photo notes only)

| | |
|---|---|
| Input | The stored image |
| Model | Vision-capable model (`MODEL_VISION`), temperature 0, JSON-schema output, timeout 180 s |
| Output | `TranscriptionResult` saved as `transcript_draft`; status `awaiting_transcript_review` |

```ts
export const TranscriptionResult = z.object({
  lines: z.array(z.object({
    text: z.string(),            // exactly as written; "[?]" for unreadable words
    uncertain: z.boolean(),      // model is unsure about something in this line
  })),
});
```

### S3 — Review transcript (human) · P1

Photo on the left (pinch-zoom on phone), editable transcript on the right with `uncertain` lines highlighted. **Confirm** copies the edited text into `raw_text`, deletes the photo (setting "Delete photos after confirming", default on) and continues to S4. This is the only route by which handwriting reaches extraction.

### S4 — Extract 🤖 · P0

| | |
|---|---|
| Input | `raw_text`, class date, batch, roster names + nicknames (spelling reference only) |
| Model | `MODEL_EXTRACT`, temperature 0, JSON-schema `format`, timeout 120 s, `keep_alive: "15m"` |
| Output | `ExtractionResult` |
| Failure | Invalid JSON or Zod failure → one retry with the validation error appended to the prompt → otherwise `failed` with **Retry** / **Use the other model** / **Edit the note** (§4.1 lists the actions per cause). "The other model" is labelled **Use the faster model** when it is the smaller one |

```ts
export const Assessment = z.object({
  label: z.string(),                     // "ch5 test", "weekly quiz"
  scored: z.number().nullable(),
  max: z.number().nullable(),            // null when the notes give no total
  raw: z.string(),                       // verbatim text, e.g. "14/20"
});

export const ExtractedEntry = z.object({
  name_as_written: z.string(),
  source_span: z.string(),               // verbatim excerpt this entry came from
  topics: z.array(z.string()),
  assessments: z.array(Assessment),
  homework: z.object({
    status: z.enum(["done", "partial", "missed", "unknown"]),
    missed_count: z.number().int().nullable(),
  }),
  attendance: z.enum(["present", "absent", "late", "unknown"]),
  strengths: z.array(z.string()),        // short English paraphrases
  concerns: z.array(z.string()),
  fee_mentioned: z.boolean(),
  remarks: z.string().nullable(),
});

export const ExtractionResult = z.object({
  entries: z.array(ExtractedEntry),
  unattributed: z.array(z.string()),     // lines the model could not tie to a student
});
```

### S5 — Validate extraction (code) · P0

Rules applied to every entry; violations become **flags** on the entry.

| Rule | Check | On failure |
|---|---|---|
| V1 | `source_span` appears in `raw_text` (case-insensitive, whitespace-normalised) | Flag `unsupported_entry` (blocking) |
| V2 | Every number in the entry appears in its `source_span` (after digit normalisation, §4.2) | Remove that number, flag `number_not_in_notes` |
| V3 | `max > 0` and `scored ≤ max` | Flag `impossible_score` (blocking) |
| V4 | `max` is null | Flag `missing_total` (blocking) — "Riya 14 out of what?" |
| V5 | Two entries for the same name in one note | Merge them |
| V6 | `unattributed` is non-empty | One "Needs you" item per line: assign to a student or ignore |
| V7 | `fee_mentioned` is true | Non-blocking "Needs you" prompt: "Mark fees pending for Riya?" (sets `students.fees_pending`) |

### S6 — Resolve names (code + human) · P0

1. Normalise: lowercase, trim, collapse spaces, strip punctuation and diacritics.
2. **Exact** match on full name or message name → `exact`. Match on a stored nickname → `alias`.
3. **Fuzzy**: Levenshtein distance ≤ 1 for names of ≤ 5 characters, ≤ 2 for longer names, against all names and nicknames. Exactly one candidate → `fuzzy` (auto-assigned but shown with an "auto-matched — undo" chip). Fuzzy matches are also listed under **Matched for you** in Needs you, with Undo; they don't count as items to check.
4. None or several candidates → `unmatched` → "Needs you": **Assign to a student…** (searchable by name or nickname, with "Remember this nickname", default on) / **New student** (a short form: full name prefilled from the note, class, parent's number, language; the rest can be added later) / **Ignore** (confirms first; the rest of the note is still used, and Undo is offered). Lines tied to no student (V6) get Assign to a student… / Ignore. Assistants can assign and ignore but not add a student; that item stays for an owner or teacher.
5. **Auto-confirm**: an entry that is resolved and has no blocking flags is confirmed immediately and its assessments are written to the `assessments` table. Everything else waits in "Needs you".

### S7 — Build facts (code) · P0

Runs when a draft is requested. Aggregates all **confirmed** entries for the student in the cycle into a `StudentFacts` snapshot.

```ts
type StudentFacts = {
  student: { name: string; classGrade: string; subjects: string[] };
  cycle: { label: string; from: string; to: string };          // ISO dates
  assessments: { label: string; scored: number; max: number; pct: number }[];
  trend: "improving" | "steady" | "declining" | "not_enough_data";
  trendBasis?: { previousAvgPct: number; latestPct: number };
  homework: { missed: number; sessionsWithHomework: number } | null;
  attendance: { present: number; absent: number; late: number } | null;
  topics: string[];
  strengths: string[];
  concerns: string[];
  remarks: string[];
  standingNotes?: string;
};
```

- `pct = Math.round(scored / max * 100)`.
- **Trend** uses the latest assessment in this cycle against the mean `pct` of up to 3 earlier assessments (any earlier cycle). Fewer than 2 earlier assessments → `not_enough_data`. Delta ≥ +8 → `improving`; ≤ −8 → `declining`; otherwise `steady` (threshold configurable).
- Homework: `missed` = sum of explicit `missed_count` values, or where absent the number of entries with status `missed`; `sessionsWithHomework` = entries whose homework status is not `unknown`. `null` when every entry is `unknown`.
- The snapshot is stored with the draft (`facts_json`) so every message is traceable to exactly what the model was given.

### S8 — Draft 🤖 · P0

| | |
|---|---|
| Input | `StudentFacts`, parent language, tutor tone, prompt version |
| Model | `MODEL_DRAFT`, temperature 0.4, streamed plain text, timeout 90 s; thinking mode disabled if the model has one |
| Output | Message **body only** — no greeting, sign-off or fee line (S10 adds those) |
| Orchestration (P0) | The review page calls `POST /api/drafts/generate` for one student at a time, sequentially. No server-side queue in v1 |

### S9 — Guard (code) · P0

Runs on the model's body after streaming finishes, and again on any human edit (on blur).

| Rule | Check | Severity |
|---|---|---|
| G1 Numbers | After digit normalisation, every number in the body is in the **allowed set**: every number anywhere in the facts snapshot (`scored`, `max`, `pct`, counts, `trendBasis`, and numbers inside topic/remark strings such as "Chapter 5"), the class grade, and the day numbers of the cycle dates. Every `a/b` must equal an actual assessment pair; every `x%` must equal a `pct` or `trendBasis` value | Flag — highlight the number |
| G2 Own name | Student's message name (or native-script name, P1) appears | Flag |
| G3 Other students | No other active student's name or nickname appears as a whole word | **Flag, highest severity** |
| G4 Language | `bn`: ≥ 60% of letters in U+0980–U+09FF; `hi`: ≥ 60% in U+0900–U+097F; `en`: ≥ 90% Latin letters | Flag |
| G5 Length | Body is 30–160 words | Warning |
| G6 Fees | No fee/payment words (`fee`, `fees`, `payment`, `pay`, `ফি`, `টাকা`, `फ़ीस`, `फीस`, `पैसे`) — fee lines only come from S10 | Flag |
| G7 Artefacts | No `{`, `}`, `FACTS`, `JSON`, "as an AI" | Flag |

Result: `{ status: "pass" | "flagged", issues: [{ rule, message, start, end }] }`. A flagged draft can be approved only after an edit that passes, or an explicit **Send anyway**, which is recorded as an override.

### S10 — Assemble (code) · P0

```
*{title}*                                  ← code template per language (§A.1)
{greeting},                                ← code template + parent's name if known

{body}                                     ← model output, possibly edited

{fee line}                                 ← only if fees pending AND reminders enabled
— {tutor signature}
```

Dates in titles are formatted with `Intl.DateTimeFormat` using a Latin-digit locale (e.g. `bn-IN-u-nu-latn`) so numbers stay `0–9` in every language.

### S11 — Approve (human) · P0

Approve is enabled when the guard passes or after an override, and never while the draft is `stale`. Editing an approved draft returns it to `ready`/`flagged`. Changing a fact in the facts panel, or a new confirmed note about the student, marks the draft `stale` (§4.1).

### S12 — Send and log · P0

- **Send on WhatsApp** opens `https://wa.me/{phone}?text={encodeURIComponent(message)}` in a new tab/app.
- On return, a "Sent?" prompt sets `sent` (with `sent_at`) or leaves it `approved`.
- Every AI call writes an `ai_runs` row (model, durations, token counts from Ollama's `prompt_eval_count` / `eval_count`, success/error) — **never the content**.

### 4.2 Digit normalisation (used by S5 and S9)

Before any number comparison, convert Bengali digits `০১২৩৪৫৬৭৮৯` and Devanagari digits `०१२३४५६७८९` to `0–9`. Recognised number shapes: integers, decimals (`14.5`), fractions (`14/20`, `14 / 20`), "x out of y" (`out of`, `এর মধ্যে`, `में से`), and percentages (`70%`). Numbers written as words ("two") are not checked — a documented limitation; the prompt asks for digits.

### 4.3 Errors and degraded modes

| Situation | Behaviour |
|---|---|
| Ollama not running | Yellow banner "AI engine is off — notes are still saved"; capture works; processing resumes on its own when Ollama answers again (local mode; the dashboard's **Process pending notes** also does it). `./start.sh` starts Ollama if it is installed but not running |
| Model not installed | Settings and setup show the exact `ollama pull …` command |
| AI timeout | Note → `failed` with Retry; draft → `flagged` with "Generation timed out — Regenerate" |
| Invalid JSON twice | `failed`; error code stored in `ai_runs` |
| Laptop asleep while phone captures | Phone shows "Can't reach your laptop" — keeps the typed text in `sessionStorage` |

---

## 5. Prompts (version `v1`)

Prompts live in `lib/ai/prompts/*.ts` as functions that return `{ system, user }`. Each draft and AI run records `prompt_version`. Changing a prompt means bumping the version and re-running the evals (§11).

### 5.1 Extraction (S4)

**System**

```
You extract structured facts from a private tutor's rough class notes.
Output JSON that matches the schema. No commentary.

Rules:
- Create one entry per student mentioned. Copy the student's name exactly as written into name_as_written.
- source_span: copy, character for character, the part of the notes this entry came from.
- Record only numbers that literally appear in the notes. Never calculate, round or guess.
- A score without a total (e.g. "Riya 14") has max = null.
- Something like "12/10" next to a date word, or without test/marks/quiz/score context, is a date, not a score.
- Homework and attendance are "unknown" unless the notes say so.
- strengths and concerns: short English phrases paraphrasing the notes. Do not invent anything.
- Put lines you cannot tie to any student into unattributed.

Students (for spelling reference only — do not add students who are not mentioned):
{roster: "Riya Sen (nicknames: Riyu)", "Arjun Das", …}
```

**User**

```
Class date: {date}   Batch: {batch | "not given"}
Notes:
"""
{raw_text}
"""
```

### 5.2 Transcription (S2)

**System**

```
Transcribe this handwritten page from a tutor's register exactly as written, line by line.
Keep the original spelling, abbreviations, mixed languages and every number exactly.
Do not correct, summarise, translate or interpret.
If you are unsure about any word or number in a line, write your best guess and set uncertain = true.
Write [?] for anything unreadable.
```

### 5.3 Draft (S8)

**System**

```
You write the middle part of a short WhatsApp message from a private tutor to a student's parent.

Language: {languageName}, written in {script}. Write only in this language. Write numbers with digits 0-9.
Tone: {tone}. Length: 50 to 110 words. Plain text, short paragraphs, at most one emoji.

Rules:
- Use ONLY the FACTS. Every number you write must appear exactly in FACTS.
- Cover: what was studied; one specific strength; if there is a concern, describe it kindly with one practical thing the parent can do at home; test results if any; the trend if it is not "not_enough_data".
- Call the student "{studentName}" exactly as written here.
- Do NOT write a greeting or a sign-off — they are added separately.
- Do NOT mention fees or payments. Do NOT mention or compare with any other student.
- Never use harsh or labelling words about the child.
```

**User**

```
FACTS:
{StudentFacts as pretty JSON}

Tutor's standing notes for this family: {standingNotes | "none"}
```

### 5.4 Roster paste (B5) · P1 — parsed by code, no prompt

The paste format is fixed, so no model is needed. One student per line: name, class, parent's WhatsApp number, language, separated by commas or tabs. Fields are recognised by shape: a number with 9+ digits is the phone and is normalised (§3 B5); `English`, `Bengali`, `বাংলা`, `Hindi`, `हिन्दी` (any case) is the language; a short number or `class 7` is the class; the rest is the name. So a missing field is reported, not guessed. Each line shows **Ready** or what it needs, e.g. "Needs a number". Tidied numbers say what they were tidied from. Nothing is saved until **Add {n} students**, which adds only the ready lines; lines that aren't ready stay in the box.

---

## 6. Data model

All tables have `id TEXT PRIMARY KEY` (UUID via `crypto.randomUUID()`), `workspace_id TEXT NOT NULL` (except `workspaces`), `created_at` and `updated_at` as ISO-8601 text. JSON columns are text validated by Zod on read and write. Foreign keys are on, with `ON DELETE CASCADE` from `workspaces` to everything in the workspace and from `students` to everything that belongs to a student. The same tables exist in hosted-mode Postgres with native types (§19.12).

### 6.1 Tables

| Table | Key columns | Notes |
|---|---|---|
| `workspaces` | `name`, `subjects_json`, `default_language`, `tone` (`warm`/`neutral`/`formal`), `report_day` (0–6), `timezone` (default `Asia/Kolkata`), `include_fee_reminders`, `delete_photos_after_confirm`, `ai_config_json` (model per task) | The tenant. Local mode: exactly one row. Hosted: one per tutor or coaching centre |
| `members` | `workspace_id`, `user_id` (hosted: Supabase `auth.users.id`; local: a generated id), `display_name`, `signature`, `role` (`owner`/`teacher`/`assistant`), `status` (`active`/`removed`), `pin_hash`, `pin_salt`, `pin_kind` (`pin`/`passphrase`) (local mode only) | Signature is per member, so each teacher signs their own messages. Unique `(workspace_id, user_id)`. `pin_kind` tells the login screen whether to show the PIN pad or a text field |
| `students` | `full_name`, `message_name`, `name_native` (P1), `aliases_json`, `class_grade`, `batch`, `subjects_json`, `parent_name`, `parent_phone` (digits), `parent_language` (`en`/`bn`/`hi`; P1 `bn-Latn`/`hi-Latn`), `standing_notes`, `fees_pending` (bool), `status` (`active`/`archived`), `archived_at` | `fees_pending` is a manual toggle, also set from the V7 prompt (§4, S5). `archived_at` is shown in the archived list |
| `cycles` | `label`, `starts_on`, `ends_on` (dates), `status` (`open`/`reviewing`/`completed`), `completed_at` | One open cycle at a time |
| `note_inputs` | `cycle_id`, `source` (`typed`/`photo`), `origin` (`capture`/`quick_note`), `class_date`, `batch`, `raw_text`, `transcript_draft_json`, `image_path`, `status` (§4.1), `error_code` | `raw_text` is null for a photo until S3 confirms. `quick_note` = typed from the weekly review's "No notes this week" list; the week summary tags those updates "From a quick note" |
| `extracted_entries` | `note_input_id`, `cycle_id`, `name_as_written`, `student_id` (nullable), `resolution` (`exact`/`alias`/`fuzzy`/`manual`/`unmatched`/`ignored`), `payload_json` (`ExtractedEntry`), `flags_json`, `confirmed_at` | The "Needs you" inbox = entries with blocking flags or `unmatched` |
| `assessments` | `student_id`, `cycle_id`, `entry_id`, `label`, `scored`, `max`, `taken_on` | Written on confirm; editable from the facts panel |
| `drafts` | `cycle_id`, `student_id`, `version`, `language`, `facts_json`, `body_model`, `message_final`, `model`, `prompt_version`, `guard_json`, `override` (bool), `status` (§4.1), `created_by`, `approved_by`, `sent_by` (member ids), `approved_at`, `sent_at` | Latest `version` per (cycle, student) is the live draft; older versions kept for history |
| `sessions` | `member_id`, `token_hash`, `device_label`, `user_agent`, `last_seen_at`, `expires_at`, `revoked_at` | Local mode only — hosted mode uses Supabase Auth sessions |
| `pairing_tokens` | `token_hash`, `expires_at`, `used_at` | Local mode only, P1 |
| `ai_runs` | `task` (`transcribe`/`extract`/`draft`/`health`), `provider`, `model`, `prompt_version`, `input_chars`, `prompt_tokens`, `completion_tokens`, `duration_ms`, `ok`, `error_code` | No note or message content, ever |
| `audit_events` | `actor_member_id`, `action`, `target_table`, `target_id`, `meta_json` | Approvals, sends, guard overrides, exports, deletions; in hosted mode also privacy acceptance, invitations and role changes. No note or message content |
| `invitations` | `email`, `role`, `token_hash`, `invited_by`, `expires_at`, `accepted_at` | Hosted mode only (§19.4) |

**Indexes:** `members(user_id, workspace_id)`, `students(workspace_id, status)`, `note_inputs(cycle_id, status)`, `extracted_entries(cycle_id, student_id)`, `assessments(student_id, taken_on)`, `drafts(cycle_id, student_id, version)`, `sessions(token_hash)`.

### 6.2 Drizzle example

```ts
// lib/db/schema.sqlite.ts — lib/db/schema.pg.ts mirrors it with pg types (§19.12)
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

const base = {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
};

export const students = sqliteTable("students", {
  ...base,
  workspaceId: text("workspace_id").notNull(),
  fullName: text("full_name").notNull(),
  messageName: text("message_name").notNull(),
  aliasesJson: text("aliases_json").notNull().default("[]"),
  classGrade: text("class_grade").notNull(),
  batch: text("batch"),
  parentName: text("parent_name"),
  parentPhone: text("parent_phone").notNull(),
  parentLanguage: text("parent_language", { enum: ["en", "bn", "hi"] }).notNull(),
  standingNotes: text("standing_notes"),
  feesPending: integer("fees_pending", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
}, (t) => [index("students_workspace_status").on(t.workspaceId, t.status)]);

export const assessments = sqliteTable("assessments", {
  ...base,
  workspaceId: text("workspace_id").notNull(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  cycleId: text("cycle_id").notNull(),
  entryId: text("entry_id"),
  label: text("label").notNull(),
  scored: real("scored").notNull(),
  max: real("max").notNull(),
  takenOn: text("taken_on").notNull(),
});
```

All queries live in `lib/db/queries/*.ts`, take the caller's `workspaceId` as their first argument, and are the only code that touches the database. Components and actions never build SQL themselves. This is what keeps the hosted-mode move (§19) contained.

---

## 7. Server surface

**Rule of thumb:** Server Actions for form mutations; Route Handlers for streaming, file uploads, downloads and anything the phone polls. Every action and handler starts with `const ctx = await requireMember(minRole)`. It verifies the session (local PIN session or Supabase user), loads the active membership, checks the role and returns `{ userId, memberId, workspaceId, role }`, or rejects. Every query uses `ctx.workspaceId`; a workspace id is never read from the request body. Exceptions: setup, login, pairing and sign-up. Minimum role per capability: §19.5 (in local mode the single member is the owner).

### 7.1 Server Actions

| Action | Purpose | P |
|---|---|---|
| `completeSetup(profile, secret)` | Stage B2–B3; `secret` is `{ kind: "pin" \| "passphrase", value }`; creates the workspace and its owner member; only when no workspace exists | P0 |
| `login(secret)` / `logout()` | Stage C | P0 |
| `createStudent` / `updateStudent` / `archiveStudent` / `restoreStudent` / `deleteStudent` | Roster | P0 |
| `saveNote({ text, batch, classDate, origin? })` | S1 typed; `origin: "quick_note"` from the weekly review | P0 |
| `editNote(noteId, text)` | Fixes the text of a `failed` note and processes it again | P0 |
| `confirmTranscript(noteId, text)` | S3 | P1 |
| `resolveEntry(entryId, { studentId, rememberAlias } \| { ignore: true } \| { newStudent })` / `undoResolve(entryId)` | S6 human step; undo restores an ignored line or an auto-match to "Needs you" | P0 |
| `setEntryTotal(entryId, assessmentIndex, max)` | Answers a `missing_total` flag | P0 |
| `updateAssessment(id, { scored, max, label })` | Facts panel edit → marks draft stale | P0 |
| `editDraft(id, text)` / `approveDraft(id, { override })` / `skipDraft(id)` / `markSent(id)` | S11–S12 | P0 |
| `completeCycle(id, { early? })` | Stage E9; `early` marks students not yet sent or skipped as skipped and leaves approved drafts as they are | P0 |
| `updateSettings(...)` | Settings | P0 |
| `createPairingToken()` / `revokeSession(id)` | §9.4 | P1 |
| `sendSignInCode(email)` / `verifySignInCode(email, code)` | Hosted sign-in (§19.3) | P0 (hosted) |
| `acceptPrivacyNotice()` / `createWorkspace(settings)` | Hosted onboarding (§19.4) | P0 (hosted) |
| `loadSampleData()` | Adds fictional students and two weeks of history to the current workspace (§19.14) | P0 (hosted) |
| `inviteMember(email, role)` / `changeRole(memberId, role)` / `removeMember(memberId)` | Team management (§19.5) | P1 |

### 7.2 Route Handlers

| Method & path | Purpose | P |
|---|---|---|
| `GET /api/ai/health` | Ollama reachable, installed models, RAM, recommended defaults, test-generation latency | P0 |
| `POST /api/notes/[id]/process` | Runs the next AI step(s) for a note (S2 or S4–S6); returns the new status | P0 |
| `POST /api/notes/photo` | Multipart upload (S1 photo) → returns `noteId` | P1 |
| `POST /api/drafts/generate` | Body `{ cycleId, studentId, tone? }` → streams the body text (S8); on completion runs S9–S10 and stores the draft | P0 |
| `GET /api/export` | All data as JSON | P1 |
| `GET /api/backup` | Consistent copy of the SQLite file via `better-sqlite3`'s online `backup()` | P1 |
| `GET /pair?t=…` (page) | Phone pairing (local) | P1 |
| `GET /auth/callback` | Exchanges the Google sign-in code for a session (hosted) | P1 |

Route Handlers check that the `Origin` header's host matches `Host` (Server Actions already do this).

---

## 8. Screens

| Route | Screen | Phone layout | P |
|---|---|---|---|
| `/setup` | Wizard B1–B7: About you with a live message preview; PIN or passphrase; AI check; add students (form, running list, P1 paste) | Single column; desktop adds a side panel | P0 |
| `/login` | PIN pad (6 digits) or passphrase field; tries left; live lockout countdown; Forgot PIN | Single column, large keys | P0 |
| `/` | Dashboard: open cycle card, **Needs you** inbox, **Quick note** + **Photo** buttons, AI status pill ("Local · <model>") | Buttons first, then inbox | P0 |
| `/capture` | Quick note: textarea, Photo button, batch, date, Save | Full-screen textarea, 16 px font (avoids iOS zoom) | P0 |
| `/capture/[id]` | Saved note: reading progress, then the students found; for a failed note, "Couldn't read" with the note as typed and the actions in §4.1 | Single column | P0 |
| `/capture/[id]/transcript` | Photo vs transcript review (S3) | Photo above, transcript below | P1 |
| `/needs-you`, `/needs-you/[id]` | Everything waiting (unknown names, lines about no one, missing totals, notes that couldn't be read) plus **Matched for you** (auto-matches with Undo). "Nothing is sent until you decide." | One item per screen with "Also waiting" below; desktop: list beside the open item | P0 |
| `/students`, `/students/new`, `/students/[id]` | Roster with search (name or nickname) and Active / Archived filter; student form; profile with nicknames, standing notes, parent's number, Messages and Scores tabs, and an actions menu (Edit, Archive, Delete permanently — each shown only to roles that may use it, §19.5) | Lists; desktop: table beside the profile | P0 |
| `/cycles/[id]` | **Weekly review.** Left: student list with status chips, grouped as Sent, Waiting to send and No notes this week; progress "{sent} of {n} sent · {skipped} skipped"; Complete week / Complete week early…. Centre: facts panel (editable). Right: WhatsApp-style bubble preview with inline guard highlights; actions Edit / Regenerate / Skip / Approve / Send on WhatsApp | List → detail page per student | P0 |
| `/cycles/[id]/done` | Week complete: sent, skipped, edited before sending, minutes; each student's result; next week's start date | Single column | P0 |
| `/settings` | Profile, language, tone, report day, fee reminders, models per task + "Test", devices, backup/export, delete all data | Sections | P0 (P1 parts as marked above) |
| `/login` (hosted) | Email → 6-digit code; "Continue with Google" (P1) | Single column | P0 (hosted) |
| `/onboarding` (hosted) | Privacy notice → create workspace → "Load sample students" or add your own | Single column, one step per screen | P0 (hosted) |
| `/settings/members` (hosted) | Members, roles, invitations | List | P1 |
| Workspace switcher (hosted) | Header menu for people in several workspaces | Bottom sheet | P1 |

The hosted version shows a slim preview banner on every page while `PREVIEW_INSTANCE=true` (§19.14).

**Status chips** always pair colour with an icon and a word (not colour alone): Needs you, Checked, Flagged, Approved, Sent, Skipped, Out of date (a stale draft; bordered so it never reads as Checked) and Couldn't read (a failed note; plain grey, because the note is safe and only needs another try). Tap targets ≥ 44 px. Bengali text uses Baloo Da 2 and Devanagari text uses Baloo 2, so previews in every language render correctly. Previews use the app's fonts, not WhatsApp's own system font.

---

## 9. Authentication and security — local mode

In local mode, "first login" means a **PIN on this laptop**; there is no cloud account. Hosted mode uses Supabase Auth with real accounts, workspaces and roles, plus row-level security in the database — see §19.

### 9.1 PIN

- Exactly 6 digits, or a passphrase of at least 8 characters (spaces allowed). `members.pin_kind` records which.
- Easy PINs are refused: six of the same digit, and a short list of runs and patterns (`123456`, `654321`, `012345`, `234567`, `345678`, `456789`, `987654`, `876543`, `121212`, `123123`, `112233`, `102030`).
- Stored as `scrypt` hash (Node `crypto.scrypt`, 16-byte random salt); compared with `crypto.timingSafeEqual`.
- Rate limit: 5 failures per 10 minutes per client IP (in-memory), then 10-minute lockout. The login response gives the tries left and, when locked, the time the pause ends.
- `npm run reset-pin` (on the laptop) sets a new PIN or passphrase and revokes all sessions. It ignores the lockout.

### 9.2 Sessions

- Token: 32 random bytes, base64url. Only its SHA-256 hash is stored.
- Cookie `ts_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` **only** when the request arrived over HTTPS (LAN HTTP would otherwise drop the cookie).
- 30-day sliding expiry; `last_seen_at` updated at most once per hour.
- Middleware (named `proxy` in newer Next.js versions) only checks that the cookie exists and redirects to `/login` otherwise. Real validation happens in `requireMember()` (database lookup of the session and membership) inside every page, Server Action and Route Handler, because SQLite is not available in edge middleware.

### 9.3 Exposure

- Default bind `127.0.0.1`. LAN mode is explicit (`start:lan`) and shown in Settings ("Your phone can reach TuitionSetu at http://192.168.x.x:3000").
- Uploads: ≤ 8 MB, magic-byte check, random filenames, stored outside `public/`, served only through an authenticated handler.
- No user-supplied HTML is ever rendered; message previews are plain text.
- Dependencies pinned with a lockfile.

### 9.4 Phone pairing · P1

1. Settings → **Connect your phone** creates a one-time token (10-minute expiry) and shows a QR code for `http://<lan-ip>:<port>/pair?t=<token>`. The LAN IP is the first non-internal IPv4 from `os.networkInterfaces()`.
2. The phone scans it; the server checks the token is unused and unexpired, creates a session labelled "Phone", marks the token used, and redirects to `/`.
3. Without pairing (P0), the tutor types the LAN URL on the phone and logs in with the PIN.

---

## 10. Privacy and data handling

| Data | Where | Kept until |
|---|---|---|
| Workspace settings, member profile, PIN hash | SQLite | Delete all data |
| Students, parents' numbers, notes, scores, messages | SQLite | Student deleted, or delete all data |
| Register photos | `data/uploads/` | Transcript confirmed (default) or student/all-data deletion |
| AI run telemetry | SQLite `ai_runs` | 90 days (P1 pruning) — contains no content |
| Server logs | Terminal only | Process lifetime — ids, durations and error codes only, never note or message text |
| **Hosted mode:** all of the above | Supabase Postgres and a private Storage bucket, India (Mumbai) region | Same rules; deletions also remove Storage objects (§19.10) |

Principles:

- **Local mode guarantee:** with `AI_PROVIDER=ollama` and `OLLAMA_HOST` on loopback, no student data leaves the laptop. Anything else triggers the red banner (§2.2).
- **Deletion is real:** deleting a student hard-deletes all their rows and photos (cascade).
- **Export:** the tutor can download everything as JSON (P1).
- **The hosted hackathon instance** asks visitors to use sample or fictional student data only (§19.14).
- **Hosted mode** stores data in the cloud. That is a different promise from local mode, so it is stated plainly at sign-up and protected by accounts, roles and row-level security (§19).

---

## 11. AI configuration, model choice and evaluation

### 11.1 Provider abstraction

```ts
// lib/ai/provider.ts
export interface AIProvider {
  generateObject<T>(opts: {
    task: "extract" | "transcribe";
    model: string;
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    images?: string[];          // base64, transcription only
    temperature: number;
    timeoutMs: number;
  }): Promise<{ object: T; usage: Usage }>;

  streamText(opts: {
    task: "draft";
    model: string;
    system: string;
    prompt: string;
    temperature: number;
    timeoutMs: number;
  }): { stream: ReadableStream<string>; usage: Promise<Usage> };
}
```

- **`OllamaProvider`** (local, P0): native `chat` with `format: <JSON Schema from Zod>`, `images` for vision, `options.temperature`, `keep_alive: "15m"`, and thinking disabled for models that support it.
- **`OpenAICompatibleProvider`** (hosted version, P0, §19.8): `response_format` JSON schema where the endpoint supports it, otherwise JSON mode plus Zod validation and the same single retry.

### 11.2 Models per task

| Task | Requirement | Default selection |
|---|---|---|
| Extract | Reliable JSON, follows "don't invent numbers" | Smallest model that meets the eval bar below |
| Draft | Natural Bengali / Hindi / English prose | May be the same model; "quality mode" offers a larger one on laptops with >12 GB RAM |
| Transcribe | Image input | A vision-capable model; Gemma 3 4B accepts images; Qwen2.5-VL is the alternative to test |

Candidates for the eval (pick by measurement, not reputation): current small Gemma (~4B), current small Qwen (~4B), and their ~8B siblings for quality mode. Size the default for an **8 GB laptop**: a ~7–8B model at 4-bit needs roughly 5–6 GB of RAM, which is too much alongside a browser.

### 11.3 Eval harness · P0 (first 8 cases), P1 (all 15)

`evals/fixtures/<case>/` holds `notes.txt`, `roster.json`, `expected.json` (and `photo.jpg` for transcription cases). Cases cover:

1. Clean English shorthand, 3 students
2. Hinglish
3. Bengali words in Roman script ("bhalo korche")
4. Several students on one line
5. Nickname ("Riyu" for Riya)
6. Score without total ("Riya 14")
7. Date that looks like a score ("test on 12/10")
8. Decimal and "out of" scores ("14.5 out of 20")
9. Absent student
10. Fee mention
11. Unknown student not on the roster
12. Two students with the same first name
13. Typos in names
14. Nothing but general remarks (no students)
15. Long, rambling note (10 students)

`npm run eval -- --task extract --model <name>` reports:

| Metric | Bar for the default model |
|---|---|
| Student attribution accuracy | ≥ 95% |
| Assessment exact match (scored, max) | ≥ 95% |
| Numbers not present in the notes (after S5) | 0 |
| Unknown-student detection | 100% of cases 11–12 flagged |
| Valid JSON on first try | ≥ 90% |
| Latency p50 / p95 | recorded |

`--task draft` reports guard pass rate, language-check pass rate, cross-student leaks (must be 0), length compliance, and writes 10 drafts per language to a Markdown file for a manual 1–5 rating. Results are saved to `evals/results/<date>-<model>.md` and quoted in the write-up.

---

## 12. Non-functional requirements

Latency figures are **targets** to be measured on the development laptop with the chosen default model; the eval runner records the real numbers.

| Area | Target |
|---|---|
| Save a note | < 300 ms (no AI on the save path) |
| Extraction, one note with ≤ 5 students | ≤ 20 s |
| Draft, first visible text / complete | ≤ 3 s / ≤ 15 s |
| Transcription of one photo | ≤ 30 s |
| Dashboard load on the phone over LAN | < 1 s |
| Offline | Everything works with the internet disconnected (local mode) |
| Data safety | SQLite in WAL mode; a crash mid-AI-call never loses captured input |
| Accessibility | 16 px minimum input text on mobile; 44 px tap targets; status never shown by colour alone |
| Browsers | Current Chrome on Android, Safari on iOS, Chrome/Edge on Windows/macOS |

---

## 13. Configuration and repository layout

### 13.1 Environment

```bash
APP_MODE=local                        # local | hosted (§19)
AI_PROVIDER=ollama                    # ollama | openai-compatible
OLLAMA_HOST=http://127.0.0.1:11434
MODEL_EXTRACT=<decided by eval>
MODEL_DRAFT=<decided by eval>
MODEL_VISION=<decided by eval>
OPENAI_COMPAT_BASE_URL=               # hosted version's inference endpoint (§19.8)
OPENAI_COMPAT_API_KEY=                # hosted version's inference endpoint (§19.8)
DATABASE_PATH=./data/tuition-setu.db
UPLOAD_DIR=./data/uploads
SESSION_TTL_DAYS=30                   # local mode sessions

# Hosted mode only (§19.9)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= # public by design; safe only because RLS is on everywhere
SUPABASE_SECRET_KEY=                  # server and scripts only; never NEXT_PUBLIC_
DATABASE_URL=                         # Supabase pooler connection string for Drizzle
STORAGE_BUCKET=register-photos
PREVIEW_INSTANCE=false                # true on the hackathon instance: "fictional data only" banner (§19.14)
AI_QUOTA_DRAFTS_PER_MEMBER_HOUR=30
AI_QUOTA_CALLS_PER_WORKSPACE_DAY=150
```

Models chosen in Settings override the environment defaults (stored in `workspaces.ai_config_json`).

### 13.2 Scripts

| Script | Does |
|---|---|
| `dev` / `dev:lan` | `next dev` / `next dev -H 0.0.0.0` |
| `build`, `start` / `start:lan` | Production build; serve on localhost / LAN |
| `./setup.sh` | One-command local install (§13.4); calls `npm run setup` internally |
| `./start.sh [--lan]` | Starts the local version; `--lan` binds to Wi-Fi and prints the phone address |
| `setup.ps1` / `start.ps1` | Windows equivalents (P1) |
| `setup` | Migrate the database, check Ollama, print next steps |
| `db:hosted:migrate` | Applies `supabase/migrations` to the hosted project with the Supabase CLI |
| `check:rls` | Fails if any `public` table has row-level security off (CI) |
| `check:bundle` | Fails if the secret key's prefix appears in the client bundle (CI) |
| `db:generate`, `db:migrate`, `db:seed` | Drizzle migrations; demo seed |
| `eval` | Eval runner (§11.3) |
| `reset-pin` | Interactive PIN reset (§9.1) |
| `test` | Vitest unit tests |

### 13.3 Layout

```
tuition-setu/
├─ setup.sh  start.sh  setup.ps1  start.ps1  .env.example
├─ app/
│  ├─ setup/  login/  capture/  students/  cycles/[id]/  settings/  pair/
│  ├─ page.tsx                      # dashboard
│  └─ api/
│     ├─ ai/health/route.ts
│     ├─ notes/photo/route.ts
│     ├─ notes/[id]/process/route.ts
│     ├─ drafts/generate/route.ts
│     └─ export/route.ts  backup/route.ts
├─ components/                      # UI, WhatsApp bubble, status chips
├─ lib/
│  ├─ ai/        provider.ts  ollama.ts  openai-compatible.ts  prompts/
│  ├─ pipeline/  capture.ts  transcribe.ts  extract.ts  validate.ts
│  │             resolve.ts  facts.ts  draft.ts  guard.ts  assemble.ts
│  ├─ db/        schema.sqlite.ts  schema.pg.ts  client.ts  queries/
│  ├─ auth/      require-member.ts  local/ (pin, session, rate-limit)
│  │             supabase/ (server client, session refresh)
│  ├─ storage/   local-fs.ts  supabase-storage.ts
│  ├─ schemas/   zod schemas shared across layers
│  └─ util/      digits.ts  phone.ts  dates.ts  lan.ts
├─ evals/        fixtures/  run.ts  results/
├─ scripts/      setup.ts  reset-pin.ts  seed.ts
├─ drizzle/      migrations (SQLite)
├─ supabase/     migrations/ (Postgres tables, RLS policies, functions)  tests/ (pgTAP)
└─ data/         (git-ignored) tuition-setu.db  uploads/
```

### 13.4 Local setup script (`setup.sh`) · P0

Goal: clone → one command → a working app. The script is idempotent: running it again only does what is still missing.

| Step | Does | If it fails |
|---|---|---|
| 1 | Checks Node.js (minimum version from `package.json` `engines`) and npm | Prints the download link and exits |
| 2 | Checks Ollama is installed and answering on `127.0.0.1:11434`; if it is installed but not running, starts `ollama serve` in the background | Prints the Ollama download link and exits. It never pipes a remote install script into the shell |
| 3 | `npm ci` | Shows the npm error and exits |
| 4 | Creates `.env.local` from `.env.example` with `APP_MODE=local`; never overwrites an existing file | — |
| 5 | Reads the machine's RAM, picks the default models (§11.2), shows each download size, then runs `ollama pull` | Continues; the setup wizard shows the missing model and the command |
| 6 | `npm run db:migrate` (creates `data/tuition-setu.db`) | Exits |
| 7 | Asks "Add sample students to try it out? [y/N]" → `npm run db:seed -- --sample` | — |
| 8 | `npm run build` | Exits |
| 9 | Prints the next step: `./start.sh`, then open `http://localhost:3000`; `./start.sh --lan` for the phone | — |

Flags: `--yes` (accept defaults, for CI), `--skip-models`, `--lan` (also writes the LAN host setting to `.env.local`).

Docker is deliberately not used for the local version: Ollama inside Docker on macOS cannot use the Mac's GPU, which makes local inference much slower.

Supported: macOS and Linux via `setup.sh` (P0); Windows via `setup.ps1` (P1). Each script is tested on a clean machine before submission.

---

## 14. Testing

| Layer | What | P |
|---|---|---|
| Unit (Vitest) | Digit normalisation; phone normalisation; number-shape parser; S5 validators; S6 name resolver (exact, alias, fuzzy, ambiguous); S7 trend thresholds; S9 every guard rule incl. Bengali/Devanagari digits and cross-student names; S10 assembly per language; stale-draft rules (§4.1); PIN and passphrase rules incl. the easy-PIN list; PIN hash/verify; session expiry; roster paste parser (P1) | P0 |
| Evals | §11.3 against real models | P0 |
| Manual QA checklist | Setup on a clean machine; PIN lockout; phone over LAN (Android + iPhone); camera capture opens the rear camera; `wa.me` opens WhatsApp with the text; Bengali and Hindi render correctly in preview and in WhatsApp; Ollama stopped mid-review; delete a student removes their history; `./setup.sh` on a fresh clone on clean macOS and Linux; hosted sign-up with a never-used email address, on desktop and on a phone; hosted quotas show a friendly message when reached | P0 |
| Authorization (both modes) | `requireMember()` rejects missing sessions, removed members and roles below the minimum; queries never cross `workspace_id` | P0 |
| Row-level security (hosted) | pgTAP via `supabase test db`: isolation between two workspaces for every table, owner vs assistant checks, last-owner protection (P0); every row of the §19.5 matrix and the photo bucket (P1) | P0 / P1 |
| End-to-end (Playwright) | Setup → note → draft → approve | P2 |

---

## 15. Two-day build plan

Both versions ship (D11). They share everything except three adapters (§19.2), so Day 1 builds the core once on the local version and Day 2 adds drafting plus the hosted adapters. This is a full two days; the cut order protects what matters.

Estimates in hours.

**Cut order if behind:** photo capture (S2–S3) → Google sign-in → invitations → phone pairing QR → roster paste import → tone variants on Regenerate → Hindi (keep English + Bengali) → Windows setup script.

**Never cut:** RLS on every table, the workspace-isolation tests, the number guard, the preview banner and AI quotas on the hosted instance.

### Day 1 — core loop on the local version

| # | Task | h |
|---|---|---|
| 1 | Scaffold: Next.js + TypeScript, Tailwind, shadcn/ui; adapter interfaces for db, auth, storage and AI; `APP_MODE` switch | 1.0 |
| 2 | Schema in both dialects (`schema.sqlite.ts`, `schema.pg.ts`), SQLite migration, sample-data seed | 1.0 |
| 3 | `OllamaProvider` + `OpenAICompatibleProvider`, `/api/ai/health` | 1.0 |
| 4 | Local setup wizard B1–B4, PIN, sessions, login, `requireMember()` | 1.25 |
| 5 | Students CRUD + phone normalisation | 0.75 |
| 6 | Quick note (S1) → extract (S4) → validate (S5) → resolve (S6) → "Needs you" inbox | 2.0 |
| 7 | Eval fixtures 1–8 + runner; first model comparison | 0.75 |
| 8 | `setup.sh`, `start.sh`, README quick start | 0.5 |
| | **Day 1 done when:** on a fresh clone, `./setup.sh && ./start.sh` works and a typed note for 3 students produces confirmed entries and scores | **8.25** |

### Day 2 — drafts, hosted version, ship

| # | Task | h |
|---|---|---|
| 1 | Facts (S7) + streaming draft (S8) + guard (S9) + assemble (S10) | 1.75 |
| 2 | Weekly review screen: bubbles, highlights, edit/approve/skip, `wa.me`, mark sent, complete cycle | 1.75 |
| 3 | Hosted database: Supabase project (Mumbai), Postgres migration, RLS helper and policies for every table, `check:rls` | 1.25 |
| 4 | Hosted auth: `@supabase/ssr`, email-code sign-in with custom SMTP, onboarding (privacy notice → workspace → sample students), Supabase `requireMember()` adapter | 1.5 |
| 5 | pgTAP isolation tests (two workspaces) + owner vs assistant checks | 0.5 |
| 6 | Deploy the hosted version: host, inference endpoint, quotas, preview banner; mobile layout pass on a real phone | 1.0 |
| 7 | First-user session with a real tutor on the local version (one real week of notes) | 1.0 |
| 8 | Record the demo (both versions) and write the DEV post | 2.0 |
| | **Day 2 done when:** all three Definitions of Done below are met | **10.75** |

Photo capture (S1 photo, S2, S3: about 1.5 h) and Google sign-in (about 0.5 h) are built only if time remains after this list. The submission deadline (19 Oct, 12:29 PM IST) leaves a little slack beyond the two days for that.

### Definition of Done — local version

- [ ] Fresh clone → `./setup.sh` → `./start.sh` → setup → first draft in under 15 minutes (model download aside)
- [ ] Typed notes for 5 students → 5 guarded drafts in English and Bengali
- [ ] Guard catches an injected wrong number and another student's name (unit-tested)
- [ ] Works with Wi-Fi on but internet disconnected
- [ ] Phone over LAN: capture, review, `wa.me` send
- [ ] Eval results table committed

### Definition of Done — hosted version

See §19.13.

### Definition of Done — submission

- [ ] README: local quick start, link to the hosted version, architecture diagram
- [ ] Post published with demo, code, "Why open", first user and prize categories

---

## 16. Demo and submission

### 16.1 Two ways to try it

| | Hosted version (judges and visitors) | Local version (real tutors) |
|---|---|---|
| How | Open the app URL → sign up with an email code → "Load sample students" | `git clone` → `./setup.sh` → `./start.sh` |
| Time to first draft | About 2 minutes | About 15 minutes, plus model download |
| Data | Supabase (Mumbai); visitors are asked to use fictional data | Never leaves the laptop |
| AI | Open-weight model on a hosted endpoint | Open-weight model via Ollama on the laptop |

Hosting on Render or DigitalOcean, and serving it on a free .tech domain, also enter those partner categories.

### 16.2 Write-up outline (maps to the DEV template)

1. **What I Built** — Mita's Sunday problem; who pays (₹ per month idea) and why
2. **Demo** — the hosted URL, plus a 45-second GIF: typed note (or register photo, if built) → drafts in Bengali/English → guard catching a wrong number → WhatsApp; and a short clip of `./setup.sh` on a fresh clone
3. **Code** — repo embed; local quick start
4. **How I Built It** — the pipeline diagram; "the model writes, code checks"; eval table; one codebase with two modes; how row-level security keeps workspaces apart
5. **Why Open Innovation Matters** — children's data never leaves the laptop; ₹0 per message makes a ₹99/month product viable; swapping models for Bengali quality; no lock-in
6. **My First User** — the real tutor's week: time taken, edits made, what she asked for next
7. **Prize categories** — Gemma (if it wins the eval); Render or DigitalOcean (hosting or inference); .tech domain, if used

---

## 17. Roadmap (P2)

### 17.1 Hosted version

Its core ships for the hackathon (§19). Next: Google sign-in and invitations if they were cut, multi-factor authentication for owners, per-batch access, phone-OTP sign-in, import from a local install, an offline capture queue, and our own inference server so no student data reaches a third party.

### 17.2 Later

- Native Android app with a small on-device model, so the phone works without the laptop
- Per-batch access for teachers in coaching centres (`member_batches`, §19.5)
- Monthly report card (PDF) per student
- Bengali/Hindi interface
- Fee ledger
- Reminders on report day

---

## 18. Open questions (answer with the first user)

1. Do parents prefer Bengali script or Bengali written in English letters?
2. Weekly updates, or a short update after every class?
3. Should fee reminders ever share a message with progress updates, or always be separate?
4. How much RAM does the first user's laptop have (decides the default model)?
5. ~~Should students without notes this week get a short generic message, or nothing?~~ Decided in the designs: nothing, unless the tutor adds a quick note (§3 E8).
6. For hosted mode: do tutors prefer signing in with an email code, Google, or a phone OTP (which costs money per SMS)?
7. After judging, should the hosted instance be wiped, or kept open for early users? Keeping it means dropping the preview banner and its "fictional data only" rule, and moving to our own inference server first.

---

## 19. Hosted version: Supabase Postgres, authentication and authorization · P0 core

Ships for the hackathon alongside the local version (D11). The same Next.js codebase runs with `APP_MODE=hosted`; the pipeline (§4), prompts (§5) and screens (§8) do not change. What changes is where data lives, who can sign in, and who may do what. Items marked P1 or P2 below come after the core.

### 19.1 Why, and what changes

Hosted mode is for tutors who want to use their phone without keeping a laptop on, for coaching centres with several teachers sharing one roster, for offering TuitionSetu as a paid service, and, during the hackathon, for judges and visitors to try it in two minutes.

| | Local mode | Hosted mode |
|---|---|---|
| Data lives | SQLite file on the tutor's laptop | Supabase Postgres, India (Mumbai) region |
| Photos | `data/uploads/` on the laptop | Private Supabase Storage bucket |
| Sign-in | Local PIN | Supabase Auth accounts |
| Who uses it | One tutor | Many workspaces; several members per workspace, each with a role |
| AI runs on | Ollama on the laptop | Open-weight model on a hosted endpoint; our own inference server later |
| Reached at | `http://<laptop-ip>` on home Wi-Fi | `https://` app domain, from anywhere |
| Privacy promise | Nothing leaves the laptop | Stored in the cloud, protected by accounts, roles and RLS — stated plainly at sign-up |

**Supabase provides the building blocks, not the guarantee.** Accounts, sessions, row-level security and private storage are all available, but data is only safe if RLS is enabled on every table, the policies are correct, every user request runs *as that user*, and the secret key never reaches a browser. §19.5–19.9 specify each of these.

### 19.2 Architecture

```
 Phone / laptop browser (installable PWA over HTTPS)
          │
          ▼
 Next.js server (Node runtime — Vercel, Render or a DigitalOcean droplet, India region)
   ├─ Supabase Auth ......... sign-in and sessions via @supabase/ssr cookies
   ├─ Supabase Postgres ..... Drizzle queries run as the signed-in user, so RLS applies
   ├─ Supabase Storage ...... private bucket "register-photos", short-lived signed URLs only
   └─ Inference ............. hosted open-weight endpoint now; our own server later (§19.8)
```

`APP_MODE` picks one adapter per concern; everything else is shared:

| Adapter | Local mode | Hosted mode |
|---|---|---|
| Database | Drizzle + `better-sqlite3` | Drizzle + `postgres` driver through the Supabase connection pooler |
| Authentication | PIN + `sessions` table (§9) | Supabase Auth via `@supabase/ssr` |
| Files | Local filesystem | Supabase Storage |
| AI | `OllamaProvider` → the laptop | `OpenAICompatibleProvider` → hosted open-weight endpoint (§19.8) |

The interfaces live in `lib/db`, `lib/auth`, `lib/storage` and `lib/ai`. No page, action or pipeline step imports an adapter directly. The SQLite adapter is loaded with a dynamic import only when `APP_MODE=local`, so hosted builds never load the native `better-sqlite3` module.

### 19.3 Authentication

| Topic | Decision |
|---|---|
| Sign-in methods | Email one-time code (6 digits) — **P0**, no per-message cost. Google sign-in — **P1**. Phone OTP — P2 (needs an SMS provider and costs per message). Sign-up and sign-in are the same flow: a new email creates the account |
| Email delivery | Custom SMTP (a transactional email service) configured in Supabase — **P0**. Supabase's built-in email service is meant for testing: it only delivers to your own team's addresses and is tightly rate-limited, so public sign-up fails without custom SMTP. The sign-in email template uses `{{ .Token }}` so people receive a 6-digit code rather than a link |
| Bot protection | CAPTCHA on the sign-in form (Cloudflare Turnstile or hCaptcha, both supported by Supabase Auth) — P1 |
| Next.js integration | `@supabase/ssr`: a server client that reads and writes the auth cookies; the middleware/proxy refreshes the session on each request |
| Verifying the user on the server | Always `supabase.auth.getUser()`, or `getClaims()` when asymmetric JWT signing keys are enabled. Never trust `getSession()` alone on the server: it reads the cookie without re-validating it |
| Sessions | Short-lived access token plus refresh token in HttpOnly cookies set by the server client. **Sign out** ends this device; **Sign out everywhere** revokes all refresh tokens |
| Multi-factor | TOTP for owners (P2); once enabled, owner-only actions require a session at assurance level AAL2 |
| Rate limits | Supabase Auth's built-in limits on codes and sign-ins, plus app limits on AI routes per member (e.g. 60 drafts per hour) |
| Recovery | Email code. No PIN and no `reset-pin` script in hosted mode |

**`requireMember(minRole)` in hosted mode:** verify the Supabase user → load the active membership for the current workspace → check the role → return `{ userId, memberId, workspaceId, role }`, or reject. A person in several workspaces chooses one from a switcher; the choice is kept in a cookie but always re-checked against `members` on every request.

### 19.4 Hosted journey (replaces local Stages A–C; D–F unchanged)

1. **Sign up** with an email code or Google.
2. **Privacy notice:** where data is stored (Supabase, Mumbai region), that AI runs on TuitionSetu's own servers, who can see the data, and how to delete it. Must be accepted to continue; acceptance is recorded in `audit_events`.
3. **Create a workspace:** name ("Mita's Tuition"), timezone, default language, tone, report day. The creator becomes its `owner`. One database function writes the workspace and the owner membership in the same transaction.
4. **Profile:** display name and message signature, per member, so each teacher signs their own messages.
5. **Add students**: **Load sample students** (P0, §19.14), add your own (P0), or **Import from your laptop** (P1, §19.11).
6. **Invite teammates** (coaching centres, P1): the owner enters an email and a role → single-use invitation, 7-day expiry, token stored hashed → the invitee signs in with that email → membership created.
7. **Phone:** open the app address, sign in, Add to Home Screen. Over HTTPS this is a full PWA with a service worker; an offline capture queue can follow.

### 19.5 Authorization: roles and permissions

Three roles per workspace. One person can hold different roles in different workspaces.

| Capability | Owner | Teacher | Assistant |
|---|:-:|:-:|:-:|
| View students, notes, drafts and history | ✓ | ✓ | ✓ |
| Capture notes; answer "Needs you" items (adding a new student from one needs Teacher) | ✓ | ✓ | ✓ |
| Add, edit and archive students | ✓ | ✓ | — |
| Generate, edit, approve and send drafts | ✓ | ✓ | — |
| "Send anyway" guard override | ✓ | ✓ | — |
| Complete a week | ✓ | ✓ | — |
| Delete a student permanently | ✓ | — | — |
| Workspace settings, models, fee reminders | ✓ | — | — |
| Invite or remove members; change roles | ✓ | — | — |
| Export data; delete all data; delete the workspace | ✓ | — | — |
| Read the audit log | ✓ | — | — |

Rules:

- A workspace always has at least one owner. Removing or demoting the last owner is rejected by a database trigger, not just the UI.
- Local mode's single member is an owner, so the same checks run in both modes.
- Hackathon scope: all three roles exist in `requireMember()` and in the RLS policies from the start (P0). People other than the owner join through invitations (P1).
- Per-batch access (a teacher sees only their batches) can be added later through a `member_batches` table and one change to the helper function in §19.6.

Every rule is enforced in three layers:

1. **App:** `requireMember(minRole)` at the top of every page, Server Action and Route Handler. Gives clear errors and hides buttons the role cannot use.
2. **Queries:** every query is scoped by `ctx.workspaceId` from the verified membership, never by an id from the request body.
3. **Database:** Postgres row-level security (§19.6) enforces the same rules even if layer 1 or 2 has a bug.

### 19.6 Row-level security

**How requests run under RLS.** The server never uses a privileged connection for a user's request. Each request's queries run inside a transaction that first sets the verified user's claims and switches to the `authenticated` role, so `auth.uid()` resolves and every policy applies. This is the pattern Drizzle documents for Supabase:

```sql
select set_config('request.jwt.claims', $1, true);  -- verified claims for this user, this transaction only
set local role authenticated;
-- … the request's queries …
```

The privileged connection (table owner or secret key) is used only by migrations, scheduled jobs and admin scripts, never on a request path.

**Helper function**, in a schema the Supabase Data API does not expose:

```sql
create schema if not exists private;

create or replace function private.is_member(ws uuid, min_role text default 'assistant')
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and case min_role
            when 'owner'   then m.role = 'owner'
            when 'teacher' then m.role in ('owner', 'teacher')
            else true
          end
  );
$$;
```

**Policies, shown for `students`.** Every domain table follows the same shape, with minimum roles taken from §19.5:

```sql
alter table public.students enable row level security;

create policy students_select on public.students
  for select to authenticated
  using (private.is_member(workspace_id));

create policy students_insert on public.students
  for insert to authenticated
  with check (private.is_member(workspace_id, 'teacher'));

create policy students_update on public.students
  for update to authenticated
  using (private.is_member(workspace_id, 'teacher'))
  with check (private.is_member(workspace_id, 'teacher'));

create policy students_delete on public.students
  for delete to authenticated
  using (private.is_member(workspace_id, 'owner'));
```

Rules:

- RLS is enabled on **every** table in `public`. A CI step queries the catalog and fails the build if any table has it off.
- The `anon` role has no privileges on any table.
- Every insert and update policy has `with check`, so a row can never be moved into another workspace.
- `workspaces`: members read, owners update. New workspaces are created only through `private.create_workspace(...)`, which also inserts the owner membership.
- `members`: members read their own workspace's members; only owners insert, update or remove; a trigger blocks removing the last owner.
- `invitations`: owners only. Accepting goes through a security-definer function that checks the hashed token, the expiry, and that the signed-in user's email matches.
- `audit_events` and `ai_runs`: any member inserts (through the app); only owners read.
- Policies call `(select auth.uid())` rather than `auth.uid()`, and `members(user_id, workspace_id)` is indexed, so checks stay fast.

### 19.7 Photo storage · P1 (ships with photo capture)

- Private bucket `register-photos`, with object paths `{workspace_id}/{note_input_id}.jpg`.
- Storage policies on `storage.objects` reuse the same helper: read and upload allowed when `private.is_member(((storage.foldername(name))[1])::uuid)`; delete for teachers and owners.
- Photos are shown through signed URLs that expire after about 60 seconds, never public URLs.
- Same retention as local mode: deleted once the transcript is confirmed (default), and with the student or workspace.

### 19.8 AI in hosted mode

- **Hackathon (P0):** an OpenAI-compatible endpoint serving an open-weight model. Options: a DigitalOcean GPU Droplet running Ollama or a 1-Click model (also enters the DigitalOcean category), or a serverless inference service, as long as the model it serves is open-weight. The provider is named in the privacy notice, and visitors are asked to use fictional data (§19.14).
- **Later (P2):** our own inference server (Ollama or vLLM on a GPU machine in the same region), reachable only from the app servers through a private network or firewall rule, so no student data goes to a third-party AI company.
- The pipeline, guards and metadata-only `ai_runs` logging are unchanged.

### 19.9 Secrets and configuration

| Variable | Exposure | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Browser and server clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (older projects: anon key) | Public by design — safe **only** because RLS is on everywhere | Auth flows |
| `SUPABASE_SECRET_KEY` (older projects: service-role key) | Server and scripts only; never `NEXT_PUBLIC_`; never on a request path | Migrations, admin scripts, sending invitations |
| `DATABASE_URL` | Server only | Drizzle through the Supabase pooler. With transaction-mode pooling, disable prepared statements (`prepare: false`) |
| `STORAGE_BUCKET` | Server | `register-photos` |
| `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY` | Server only | Hosted inference endpoint (§19.8) |
| `PREVIEW_INSTANCE`, `AI_QUOTA_*` | Server | Preview banner and quotas (§19.14) |

A build step searches the client bundle (`.next/static`) for the secret key's prefix and fails if it is found. Any exposed key is rotated.

### 19.10 Data protection

| Area | Decision |
|---|---|
| Region | Supabase project in India (Mumbai); app server and inference endpoint in or near India where the provider allows |
| In transit and at rest | TLS everywhere; Supabase encrypts data at rest |
| Backups | Supabase managed backups for the plan in use; point-in-time recovery where the plan allows |
| Audit | `audit_events` records privacy acceptance, approvals, sends, guard overrides, exports, deletions, invitations and role changes |
| Deletion | Deleting a student removes all their rows and Storage objects; deleting a workspace removes everything in it; deleting an account removes its memberships and, after confirmation, any workspace where it is the only owner |
| Parents | A short notice tutors can share: what is stored, why, and how to ask for deletion |
| Logs | Same rule as local mode: ids, durations and error codes only, never notes or messages |

### 19.11 Moving a local workspace to hosted · P1

1. On the laptop: Settings → **Export** (JSON of every table, UUIDs preserved; photos are not included because they are temporary).
2. In hosted mode, an owner chooses **Import from your laptop** and uploads the file.
3. The server validates every row with Zod, rewrites `workspace_id` to the new workspace and the local member id to the signed-in member, and inserts everything in dependency order in one transaction. Any failure rolls back the whole import.
4. The laptop install can then be cleared with Settings → Delete all data.

### 19.12 Schema and migrations

- Two Drizzle schema files with identical table and column names: `lib/db/schema.sqlite.ts` and `lib/db/schema.pg.ts`.
- Type map: UUID text → `uuid`; ISO-8601 text → `timestamptz`; JSON text → `jsonb`; integer booleans → `boolean`; scores `real` → `numeric(6,2)`.
- Queries in `lib/db/queries/` use only features both databases support; anything database-specific stays inside its adapter.
- Hosted migrations live in `supabase/migrations/`: table DDL generated by `drizzle-kit` for Postgres, followed by hand-written SQL for RLS policies, helper functions and triggers, applied with the Supabase CLI.

### 19.13 Hosted version — Definition of Done

For the hackathon (P0):

- [ ] Public sign-up works with a never-used email address (custom SMTP delivers the code)
- [ ] New visitor → privacy notice → workspace → sample students → first draft in under 5 minutes, on desktop and on a phone
- [ ] RLS enabled on every table; `check:rls` passes
- [ ] pgTAP: a member of workspace A can't read, insert, update or delete anything in workspace B, for every table
- [ ] Owner vs assistant checks tested at both the app and RLS layers
- [ ] Last-owner protection tested
- [ ] Secret key absent from the client bundle (`check:bundle`)
- [ ] Privacy notice shown at sign-up and its acceptance recorded
- [ ] AI quotas enforced and the preview banner shown

Later (P1/P2):

- [ ] A test for every row of the §19.5 role matrix, and for the photo bucket
- [ ] Invitations, Google sign-in, CAPTCHA
- [ ] A local export imports cleanly into a new workspace
- [ ] Our own inference server, unreachable from the public internet

### 19.14 The hosted hackathon instance · P0

| Topic | Decision |
|---|---|
| Address | The host's default domain, or a free .tech domain from the Hacktoberfest promos (also a partner category) |
| Hosting | A Node server host (Render, DigitalOcean App Platform or Vercel), in or near India to sit close to the Mumbai database |
| Preview banner | With `PREVIEW_INSTANCE=true`, every page shows: "Preview — please use sample or fictional student data. This instance may be reset after the hackathon." The privacy notice repeats it |
| Sample data | Onboarding offers **Load sample students**: 6 fictional students with two weeks of notes and scores, so a visitor sees a real draft within a minute |
| Quotas | Protect the inference budget: 30 drafts per member per hour; 150 AI calls per workspace per day; 50 students per workspace; 3 workspaces per account. Counted from `ai_runs` on the server; reaching a limit shows a friendly message, never an error page |
| Abuse | Supabase Auth's built-in rate limits; CAPTCHA (P1); owners can delete their workspace at any time |
| After judging | Wipe or keep — open question 7 (§18) |

**Deploy checklist**

1. Create the Supabase project in the Mumbai region.
2. `npm run db:hosted:migrate` (tables, RLS policies, helper functions, triggers).
3. Auth settings: site URL and redirect URLs; sign-in email template with `{{ .Token }}`; custom SMTP; Google provider (P1); CAPTCHA (P1).
4. Private `register-photos` bucket and its policies (P1, with photo capture).
5. Set the hosting environment variables (§19.9) with `APP_MODE=hosted` and `PREVIEW_INSTANCE=true`.
6. Deploy, then run `check:rls` and the pgTAP suite against the live project.
7. Sign up with a fresh email address from a phone and go from sign-up to first draft.

---

## Appendix A — Message templates (code, not model)

Native-speaker review required before release.

### A.1 Titles and greetings

| Language | Title | Greeting (with / without parent name) |
|---|---|---|
| `en` | `Weekly update — {name} ({range})` | `Hello {parentName},` / `Hello,` |
| `bn` | `{name}-এর সাপ্তাহিক আপডেট ({range})` | `নমস্কার {parentName},` / `নমস্কার,` |
| `hi` | `{name} का साप्ताहिक अपडेट ({range})` | `नमस्ते {parentName},` / `नमस्ते,` |

### A.2 Fee reminder line (only when `fees_pending` and reminders are on)

| Language | Line |
|---|---|
| `en` | `A gentle reminder that this month's tuition fee is pending.` |
| `bn` | `মনে করিয়ে দিচ্ছি, এই মাসের টিউশন ফি এখনও বাকি আছে।` |
| `hi` | `याद दिला दूँ, इस महीने की ट्यूशन फ़ीस अभी बाकी है।` |

### A.3 Example (English, fictional)

```
*Weekly update — Riya (12–18 Oct)*
Hello Mrs Sen,

This week Riya worked on Chapter 5, linear equations. She scored 14/20 (70%) in Thursday's test, up from her recent average of 58%, so the extra practice is paying off. She is quick with word problems. Small sign errors in algebra still cost her marks; asking her to re-check each step aloud at home would help. She missed homework twice, so a fixed homework time this week would be great.

— Mita Ma'am
```

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| Cycle | One reporting period (default Monday–Sunday) |
| Note input | One capture: typed text or a register photo |
| Entry | One student's facts extracted from one note |
| Needs you | Inbox of entries the app will not guess about |
| Facts | Code-built snapshot the draft model is allowed to use |
| Guard | Code checks run on every draft before approval |
| Assemble | Code adds title, greeting, fee line and signature around the model's body |
| Local mode / Hosted mode | `APP_MODE` values: laptop + SQLite + PIN, or server + Supabase + accounts |
| Workspace | The tenant: one tutor's or one coaching centre's data. Every domain table carries `workspace_id` |
| Member | A person's membership in a workspace, with a role |
| Role | `owner`, `teacher` or `assistant` (§19.5) |
| RLS | Postgres row-level security: per-row access rules enforced by the database itself |