import "server-only";
import { count, eq } from "drizzle-orm";
import type { ExtractedEntry } from "@/lib/schemas/extraction";
import type { StudentFacts } from "@/lib/schemas/facts";
import { addDays, cycleRangeFor, formatRange, todayIn } from "@/lib/util/dates";
import { withDb } from "./client";
import { assessments, cycles, drafts, extractedEntries, members, noteInputs, students, workspaces } from "./schema";
import type { DbCtx } from "./types";

// Fictional students matching the designs (IMPL M2 sample-data table). Bengali and Hindi text
// needs a native speaker's review before release, like the message templates (§A).

type Key = "riya" | "arjun" | "tanmoy" | "ishita" | "kabir" | "payel";

const STUDENTS: Record<Key, Omit<typeof students.$inferInsert, "workspaceId" | "parentPhone">> = {
  riya: {
    fullName: "Riya Sen",
    messageName: "Riya",
    classGrade: "7",
    batch: "Tue/Thu 5 PM",
    parentName: "Mrs Sen",
    parentLanguage: "bn",
    aliasesJson: ["Riyu"],
    subjectsJson: ["Maths"],
    standingNotes: "Mrs Sen likes a short line on what to practise at home.",
  },
  arjun: { fullName: "Arjun Das", messageName: "Arjun", classGrade: "7", batch: "Tue/Thu 5 PM", parentName: "Mr Das", parentLanguage: "en", subjectsJson: ["Maths", "Science"] },
  tanmoy: { fullName: "Tanmoy Ghosh", messageName: "Tanmoy", classGrade: "8", parentLanguage: "bn", subjectsJson: ["Maths", "Science"] },
  ishita: { fullName: "Ishita Roy", messageName: "Ishita", classGrade: "6", batch: "Sat 10 AM", parentName: "Mrs Roy", parentLanguage: "en", subjectsJson: ["Maths", "Science"] },
  kabir: { fullName: "Kabir Mehta", messageName: "Kabir", classGrade: "8", parentLanguage: "hi", subjectsJson: ["Maths", "Science"] },
  payel: { fullName: "Payel Dutta", messageName: "Payel", classGrade: "9", parentName: "Mrs Dutta", parentLanguage: "bn", subjectsJson: ["Maths", "Science"] },
};

type Line = {
  text: string;
  topics: string[];
  score: { label: string; scored: number; max: number };
  homeworkMissed?: number;
  strengths?: string[];
  concerns?: string[];
  /** The update that was sent that week; only for the two earlier weeks. */
  body?: string;
};

// Index 0 = two weeks ago, 1 = last week, 2 = this week. This week has notes for three students
// only, like the dashboard boards ("3 with notes · 3 without"), and no drafts yet.
const WEEKS: Partial<Record<Key, Line>>[] = [
  {
    riya: { text: "Riya weekly quiz 6/10, rushed the last two", topics: ["weekly quiz"], score: { label: "weekly quiz", scored: 6, max: 10 }, concerns: ["rushed the last questions"], body: "এই সপ্তাহে রিয়া সাপ্তাহিক কুইজে পেয়েছে 6/10। শেষ দুটো প্রশ্নে তাড়াহুড়ো করেছিল, বাড়িতে সময় ধরে অনুশীলন করলে ভালো হবে।" },
    arjun: { text: "Arjun ch4 quiz 7/10", topics: ["chapter 4"], score: { label: "ch4 quiz", scored: 7, max: 10 }, body: "This week Arjun scored 7/10 in the Chapter 4 quiz and is keeping up well with the new topic." },
    tanmoy: { text: "Tanmoy fractions quiz 12/25, struggling with unlike denominators", topics: ["fractions"], score: { label: "fractions quiz", scored: 12, max: 25 }, concerns: ["unlike denominators"], body: "এই সপ্তাহে তন্ময় ভগ্নাংশের কুইজে পেয়েছে 12/25। ভিন্ন হরের ভগ্নাংশে একটু অসুবিধা হচ্ছে, বাড়িতে কয়েকটা অঙ্ক করলে উপকার হবে।" },
    ishita: { text: "Ishita decimals quiz 8/10, very neat", topics: ["decimals"], score: { label: "decimals quiz", scored: 8, max: 10 }, strengths: ["neat working"], body: "This week Ishita scored 8/10 in the decimals quiz, with very neat working." },
    kabir: { text: "Kabir ch3 test 10/15", topics: ["chapter 3"], score: { label: "ch3 test", scored: 10, max: 15 }, body: "इस हफ़्ते कबीर ने तीसरे अध्याय की परीक्षा में 10/15 अंक पाए।" },
    payel: { text: "Payel ratio quiz 6/10", topics: ["ratio"], score: { label: "ratio quiz", scored: 6, max: 10 }, body: "এই সপ্তাহে পায়েল অনুপাতের কুইজে পেয়েছে 6/10।" },
  },
  {
    riya: { text: "Riya ch4 test 11/20, sign mistakes in algebra", topics: ["chapter 4"], score: { label: "ch4 test", scored: 11, max: 20 }, concerns: ["sign mistakes in algebra"], body: "এই সপ্তাহে রিয়া চতুর্থ অধ্যায়ের পরীক্ষায় পেয়েছে 11/20। বীজগণিতে চিহ্নের ভুল হচ্ছে, প্রতিটা ধাপ মুখে বলে মিলিয়ে নিলে সুবিধা হবে।" },
    arjun: { text: "Arjun ch4 test 15/20 good effort", topics: ["chapter 4"], score: { label: "ch4 test", scored: 15, max: 20 }, strengths: ["good effort"], body: "Arjun scored 15/20 in the Chapter 4 test. It was a good effort and the practice is showing." },
    tanmoy: { text: "Tanmoy fractions quiz 15/25 better", topics: ["fractions"], score: { label: "fractions quiz", scored: 15, max: 25 }, body: "তন্ময় এবার ভগ্নাংশের কুইজে পেয়েছে 15/25, আগের চেয়ে ভালো।" },
    ishita: { text: "Ishita ch4 test 17/20", topics: ["chapter 4"], score: { label: "ch4 test", scored: 17, max: 20 }, body: "Ishita scored 17/20 in the Chapter 4 test this week." },
    kabir: { text: "Kabir ch4 test 11/15", topics: ["chapter 4"], score: { label: "ch4 test", scored: 11, max: 15 }, body: "कबीर ने चौथे अध्याय की परीक्षा में 11/15 अंक पाए।" },
    payel: { text: "Payel ch3 test 13/20", topics: ["chapter 3"], score: { label: "ch3 test", scored: 13, max: 20 }, body: "পায়েল তৃতীয় অধ্যায়ের পরীক্ষায় পেয়েছে 13/20।" },
  },
  {
    riya: { text: "Riya ch5 test 14/20 careless in algebra, missed HW twice", topics: ["chapter 5", "linear equations"], score: { label: "ch5 test", scored: 14, max: 20 }, homeworkMissed: 2, concerns: ["careless in algebra"] },
    arjun: { text: "Arjun ex 5.3 done neatly, test 16/20, word problems still slow", topics: ["exercise 5.3"], score: { label: "test", scored: 16, max: 20 }, strengths: ["neat work"], concerns: ["slow with word problems"] },
    tanmoy: { text: "Tanmoy improving in fractions, quiz 17/25", topics: ["fractions"], score: { label: "quiz", scored: 17, max: 25 }, strengths: ["improving in fractions"] },
  },
];

const TITLES = {
  en: (name: string, range: string) => `Weekly update — ${name} (${range})`,
  bn: (name: string, range: string) => `${name}-এর সাপ্তাহিক আপডেট (${range})`,
  hi: (name: string, range: string) => `${name} का साप्ताहिक अपडेट (${range})`,
};
const GREETINGS = { en: "Hello", bn: "নমস্কার", hi: "नमस्ते" };

function entryFor(line: Line): ExtractedEntry {
  return {
    name_as_written: line.text.split(" ")[0],
    source_span: line.text,
    topics: line.topics,
    assessments: [{ ...line.score, raw: `${line.score.scored}/${line.score.max}` }],
    homework: line.homeworkMissed ? { status: "missed", missed_count: line.homeworkMissed } : { status: "unknown", missed_count: null },
    attendance: "unknown",
    strengths: line.strengths ?? [],
    concerns: line.concerns ?? [],
    fee_mentioned: false,
    remarks: null,
  };
}

/**
 * Six fictional students with two finished weeks of notes, scores and sent updates, plus this
 * week's notes for three of them, so a first draft and a trend appear within a minute (§19.14).
 * Only for a workspace with no students yet. One transaction: it all lands or none of it does.
 */
export async function loadSampleData(ctx: DbCtx): Promise<void> {
  await withDb(ctx, async (db) => {
    const [{ n }] = await db.select({ n: count() }).from(students).where(eq(students.workspaceId, ctx.workspaceId));
    if (n > 0) throw new Error("Sample students can only be added to a workspace with no students.");

    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, ctx.workspaceId));
    const [author] = await db.select().from(members).where(eq(members.id, ctx.memberId));
    const workspaceId = ctx.workspaceId;

    const ids = {} as Record<Key, string>;
    let phone = 1;
    for (const [key, student] of Object.entries(STUDENTS) as [Key, (typeof STUDENTS)[Key]][]) {
      const [row] = await db
        .insert(students)
        .values({ ...student, workspaceId, parentPhone: `91900000000${phone++}` })
        .returning({ id: students.id });
      ids[key] = row.id;
    }

    const today = todayIn(workspace.timezone);
    const thisWeek = cycleRangeFor(today);
    for (const [index, week] of WEEKS.entries()) {
      const current = index === WEEKS.length - 1;
      const from = addDays(thisWeek.from, (index - (WEEKS.length - 1)) * 7);
      const to = addDays(from, 6);
      // Earlier weeks: the Thursday class, sent on Sunday evening (IST). This week: today.
      const classDate = current ? today : addDays(from, 3);
      const sundayEvening = `${to}T14:30:00.000Z`;

      const [cycle] = await db
        .insert(cycles)
        .values({ workspaceId, label: formatRange(from, to), startsOn: from, endsOn: to, status: current ? "open" : "completed", completedAt: current ? null : sundayEvening })
        .returning({ id: cycles.id });

      const lines = Object.entries(week) as [Key, Line][];
      const [note] = await db
        .insert(noteInputs)
        .values({ workspaceId, cycleId: cycle.id, source: "typed", classDate, rawText: lines.map(([, l]) => l.text).join("\n"), status: "processed" })
        .returning({ id: noteInputs.id });

      for (const [key, line] of lines) {
        const student = STUDENTS[key];
        const [entry] = await db
          .insert(extractedEntries)
          .values({ workspaceId, noteInputId: note.id, cycleId: cycle.id, nameAsWritten: line.text.split(" ")[0], studentId: ids[key], resolution: "exact", payloadJson: entryFor(line), confirmedAt: `${classDate}T15:00:00.000Z` })
          .returning({ id: extractedEntries.id });
        await db.insert(assessments).values({ workspaceId, studentId: ids[key], cycleId: cycle.id, entryId: entry.id, ...line.score, takenOn: classDate });

        if (current || !line.body) continue;
        const lang = student.parentLanguage;
        const range = formatRange(from, to, lang);
        const greeting = student.parentName ? `${GREETINGS[lang]} ${student.parentName},` : `${GREETINGS[lang]},`;
        const facts: StudentFacts = {
          student: { name: student.messageName, classGrade: student.classGrade, subjects: student.subjectsJson ?? [] },
          cycle: { label: range, from, to },
          assessments: [{ ...line.score, pct: Math.round((line.score.scored / line.score.max) * 100) }],
          trend: "not_enough_data",
          homework: null,
          attendance: null,
          topics: line.topics,
          strengths: line.strengths ?? [],
          concerns: line.concerns ?? [],
          remarks: [],
          standingNotes: student.standingNotes ?? undefined,
        };
        await db.insert(drafts).values({
          workspaceId,
          cycleId: cycle.id,
          studentId: ids[key],
          version: 1,
          language: lang,
          factsJson: facts,
          bodyModel: line.body,
          messageFinal: `*${TITLES[lang](student.messageName, range)}*\n${greeting}\n\n${line.body}\n\n— ${author.signature}`,
          model: "sample",
          promptVersion: "v1",
          guardJson: { status: "pass", issues: [] },
          status: "sent",
          createdBy: author.id,
          approvedBy: author.id,
          sentBy: author.id,
          approvedAt: sundayEvening,
          sentAt: sundayEvening,
        });
      }
    }
  });
}
