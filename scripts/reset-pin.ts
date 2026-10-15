// npm run reset-pin — sets a new PIN or passphrase for the local owner and signs every device out
// (§9.1). Being at the laptop is the proof of identity. It runs as its own process, so the
// server's in-memory pause doesn't stop it. Runs with `--conditions=react-server`, like migrate.ts.
import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

let muted = false;
// Typed characters are echoed through this stream, so muting it hides the PIN as it's typed.
const echo = new Writable({
  write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  },
});
const rl = createInterface({ input: process.stdin, output: echo, terminal: process.stdin.isTTY === true });
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden && process.stdin.isTTY) process.stdout.write("\n");
  if (done) throw new Error("Stopped before a new PIN was set. Nothing changed.");
  return value;
}

const PROBLEMS = {
  format: "Use exactly 6 digits.",
  easy: "That one is too easy to guess. Avoid repeats and runs like 456789.",
  short: "Use at least 8 characters. Spaces are fine.",
};

async function main() {
  loadEnvConfig(process.cwd());
  const { env } = await import("@/lib/env");
  if (env.APP_MODE !== "local") throw new Error("reset-pin is for the local version. Hosted accounts sign in with email.");

  const { getLocalOwner, setMemberSecret } = await import("@/lib/db/queries/members");
  const { revokeAllSessions } = await import("@/lib/db/queries/sessions");
  const { withDb } = await import("@/lib/db/client");
  const { hashPin } = await import("@/lib/auth/local/pin");
  const { validateSecret } = await import("@/lib/schemas/secret");

  const owner = await getLocalOwner();
  if (!owner) throw new Error("There's no workspace yet. Open TuitionSetu in the browser and finish setting up first.");
  console.log(`Resetting the sign-in for ${owner.displayName}.`);

  let kind: "pin" | "passphrase" | undefined;
  while (!kind) {
    const answer = (await ask("PIN or passphrase? [p/w] ")).trim().toLowerCase();
    kind = answer === "p" || answer === "pin" ? "pin" : answer === "w" || answer === "passphrase" ? "passphrase" : undefined;
    if (!kind) console.log("Type p for a 6-digit PIN, or w for a passphrase.");
  }

  const noun = kind === "pin" ? "PIN" : "passphrase";
  let value: string | undefined;
  while (value === undefined) {
    const first = await ask(kind === "pin" ? "New 6-digit PIN: " : "New passphrase (8 or more characters): ", true);
    const problem = validateSecret({ kind, value: first });
    if (problem) {
      console.log(PROBLEMS[problem]);
      continue;
    }
    const again = await ask(`Type the ${noun} again: `, true);
    if ((kind === "pin" ? again : again.trim()) !== (kind === "pin" ? first : first.trim())) {
      console.log(`The two ${noun}s don't match. Let's start again.`);
      continue;
    }
    value = first;
  }

  const { hash, salt } = await hashPin({ kind, value });
  const ctx = { workspaceId: owner.workspaceId, memberId: owner.id, system: true as const };
  const signedOut = await withDb(ctx, async () => {
    await setMemberSecret(ctx, { pinHash: hash, pinSalt: salt, pinKind: kind });
    return revokeAllSessions(owner.workspaceId);
  });
  console.log(`Done. Every device is signed out${signedOut ? ` (${signedOut} ${signedOut === 1 ? "session" : "sessions"})` : ""}. Sign in with the new ${noun}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
