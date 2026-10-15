import "server-only";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { memberTestSource } from "./member-test-wallet";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { redemptionView } from "../core/redemption-view";
import {
  assertLocalRedemption,
  prepareRedemption,
  redemptionHttp,
} from "./redemption-adapter";
import { RedemptionVault } from "./redemption-vault";
import { persistRedemptionNotices } from "./redemption-notifications";
import type { Operator } from "../core/commerce-sandbox";
import type { CreditsState } from "../core/credits-sandbox";
export async function redemptionSource(admin = false, input?: unknown) {
  if (input !== undefined || admin) assertLocalRedemption(process.env);
  if (process.env.DOCKED_REDEMPTION_LOCAL !== "true") {
    const { s, member } = await memberTestSource();
    // Hosted beta remains non-redeemable even if a future document is malformed.
    const view = redemptionView(
      { ...s, redemption: undefined },
      { id: member, role: "member" },
    );
    return {
      ...view,
      enabled: false,
      balance: {
        ...view.balance,
        available: 0,
        pending: 0,
        other: view.balance.total,
      },
      requests: [],
      destinations: [],
    };
  }
  assertLocalRedemption(process.env);
  const who = await requireIdentity(),
    sql = db();
  if (input && !(await rateLimit(`redemption:${who.user.id}`, 20, 60)))
    throw Error("Please wait before trying again");
  const actor: Operator = {
    id: who.user.id,
    role: admin ? "reviewer" : "member",
    aal: who.aal === "aal2" ? "aal2" : "aal1",
    authenticatedAt: who.authenticatedAt,
  };
  const body = input === undefined ? undefined : redemptionHttp.parse(input);
  const key = process.env.DOCKED_REDEMPTION_BANK_KEY;
  if (!key) throw Error("Local bank vault not configured");
  const vault = new RedemptionVault(Buffer.from(key, "base64"));
  const authorize = async (tx: typeof sql, s: CreditsState) => {
    const access =
      await tx`select enabled from credits_sandbox.access where user_id=${actor.id}::uuid and enabled`;
    if (!access.length) throw Error("Member access required");
    // Recheck admission under the wallet lock, just like marketplace spending.
    if (
      !(await tx`select private.admitted(${actor.id}::uuid) allowed`)[0]
        ?.allowed
    )
      throw Error("Admission revoked");
    if (admin) {
      const rows =
        await tx`select permission from credits_sandbox.redemption_staff where user_id=${actor.id}::uuid and enabled`;
      if (
        actor.aal !== "aal2" ||
        !rows.length ||
        s.redemption?.staff[actor.id]?.some(
          (p) => !rows.some((r) => r.permission === p),
        )
      )
        throw Error("Staff permission and MFA required");
    }
  };
  const store = new CreditsSandboxStore(
    sql,
    authorize,
    (s, c, now) => prepareRedemption(s, actor, body!.request, c, now, vault),
    persistRedemptionNotices,
  );
  const result = body
    ? await store.execute(actor, body.request, body.operation)
    : null;
  const s = await store.read();
  await authorize(sql, s);
  let revealed: unknown;
  if (
    body &&
    typeof body.operation === "object" &&
    body.operation &&
    "action" in body.operation
  ) {
    const op = body.operation as { action: string; reference: string };
    if (op.action === "bank-access") {
      const m = s.withdrawals[op.reference]?.manual;
      if (
        !admin ||
        !m ||
        m.claimedBy !== actor.id ||
        m.status !== "PAYMENT_IN_PROGRESS" ||
        !s.redemption?.staff[actor.id]?.includes("payment")
      )
        throw Error("Bank reveal no longer permitted");
      revealed = vault.open(
        m.destination.ciphertext,
        m.destination.member,
        m.destination.id,
      );
    } else if (op.action === "evidence-access")
      revealed = {
        fixture: true,
        message:
          "Synthetic evidence fixture only. No identity document was uploaded.",
      };
  }
  return { ...redemptionView(s, actor, admin), result, revealed };
}
