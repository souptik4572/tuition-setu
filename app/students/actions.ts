"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { asMember } from "@/lib/auth/require-member";
import type { ActionResult } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { audit } from "@/lib/db/queries/audit";
import * as students from "@/lib/db/queries/students";
import { StudentInput } from "@/lib/schemas/student";

const CHANGE = "Only owners and teachers can change a student's details.";
const DELETE = "Only the owner can delete a student permanently.";

const INVALID = { ok: false, error: { code: "invalid", message: "Some details aren't filled in the way they should be. Check the form and try again." } } as const;
const GONE = { ok: false, error: { code: "not_found", message: "This student isn't here any more. They may have been deleted on another device." } } as const;

export async function createStudent(input: StudentInput): Promise<ActionResult<{ id: string }>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const data = StudentInput.safeParse(input);
    if (!data.success) return INVALID;
    const student = await students.createStudent(ctx, data.data);
    refresh();
    return { ok: true, data: { id: student.id } };
  });
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult<{ id: string }>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const data = StudentInput.safeParse(input);
    if (!data.success) return INVALID;
    if (!(await students.updateStudent(ctx, id, data.data))) return GONE;
    refresh();
    return { ok: true, data: { id } };
  });
}

/** Hidden from the roster, weekly reviews and name matching; the history stays (R4). */
export async function archiveStudent(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    if (!(await students.archiveStudent(ctx, id))) return GONE;
    refresh();
    return { ok: true, data: null };
  });
}

export async function restoreStudent(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    if (!(await students.restoreStudent(ctx, id))) return GONE;
    refresh();
    return { ok: true, data: null };
  });
}

/** R5: the student and everything about them, for good. The audit row keeps the id only, never the name. */
export async function deleteStudent(id: string): Promise<ActionResult<null>> {
  const result = await asMember("owner", DELETE, async (ctx) => {
    const deleted = await withDb(ctx, async () => {
      if (!(await students.deleteStudent(ctx, id))) return false;
      await audit(ctx, "student_deleted", { table: "students", id });
      return true;
    });
    return deleted ? { ok: true as const, data: null } : GONE;
  });
  if (result.ok) redirect("/students");
  return result;
}
