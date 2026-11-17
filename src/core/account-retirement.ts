import { createHash } from "node:crypto";

export type RetirementUser = {
  id: string;
  email?: string;
  deleted_at?: string;
};
export type RetirementCheckpoint = {
  userId: string;
  kind: "owner" | "customer" | "system";
  phase: "retained" | "access_blocked" | "auth_retired";
  emailSha256: string;
};
type Result = { data: { user: RetirementUser | null }; error: unknown };
export type RetirementAdmin = {
  getUserById(id: string): Promise<Result>;
  deleteUser(id: string, soft: true): Promise<Result>;
};

/** Requires previously COMMITTED database containment. Never hard-deletes,
 * creates a replacement, treats 404 as success, or restores access on failure.
 * Provider timeout is ambiguous: read back on the next invocation before retry.
 */
export async function retireContainedAccount(input: {
  checkpoint: RetirementCheckpoint;
  admin: RetirementAdmin;
  recordAttempt(): Promise<void>;
  verifyAndRecord(): Promise<void>;
}) {
  const { checkpoint: c, admin } = input;
  if (
    c.kind !== "customer" ||
    !["access_blocked", "auth_retired"].includes(c.phase)
  )
    throw Error("Only a contained ordinary beta customer may be retired");
  const read = async () => {
    const r = await admin.getUserById(c.userId);
    if (r.error || !r.data.user || r.data.user.id !== c.userId)
      throw Error("Auth readback unavailable: access must remain blocked");
    return r.data.user;
  };
  let user = await read();
  if (!user.deleted_at) {
    if (c.phase === "auth_retired")
      throw Error("Previously retired identity became active");
    const digest = createHash("sha256")
      .update((user.email ?? "").toLowerCase())
      .digest("hex");
    if (digest !== c.emailSha256)
      throw Error("Verified identity drift; review required");
    await input.recordAttempt(); // durable checkpoint BEFORE irreversible boundary
    const result = await admin.deleteUser(c.userId, true);
    if (result.error)
      throw Error(
        "Auth retirement result uncertain; inspect readback before retry",
      );
    user = await read();
  }
  if (!user.deleted_at) throw Error("Auth soft deletion not confirmed");
  await input.verifyAndRecord(); // independently checks Auth row, sessions, MFA and phone claim
  return {
    retired: true as const,
    userId: c.userId,
    originalIdentityPreserved: true as const,
  };
}
