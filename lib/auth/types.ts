export type Role = "owner" | "teacher" | "assistant";

export const ROLE_RANK: Record<Role, number> = { assistant: 1, teacher: 2, owner: 3 };

export type Ctx = {
  userId: string;
  memberId: string;
  workspaceId: string;
  role: Role;
  claims?: { sub: string; role: "authenticated"; email?: string }; // hosted only, for RLS
};

export class AuthError extends Error {
  constructor(public code: "unauthenticated" | "forbidden" | "no_workspace") {
    super(code);
  }
}
