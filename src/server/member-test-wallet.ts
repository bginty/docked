import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import {
  memberTestCommand,
  memberTestView,
  assertMemberTestEconomy,
  testReceipt,
} from "@/core/member-test-wallet";
export async function memberTestWallet(input?: unknown) {
  if (
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    throw Error("Test wallet unavailable");
  const who = await requireIdentity(),
    sql = db();
  const [access] =
    await sql`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled`;
  if (!access) throw Error("Test wallet admission required");
  const isOwner = access.kind === "owner";
  if (isOwner && who.aal !== "aal2") throw Error("Owner MFA required");
  if (input && !(await rateLimit(`test-wallet:${who.user.id}`, 40, 60)))
    throw Error("Please wait before another request");
  const peers =
    await sql`select user_id::text id,label from credits_sandbox.access where enabled and beta_private.admitted(user_id)`;
  let command: ReturnType<typeof memberTestCommand> | undefined;
  const store = new CreditsSandboxStore(sql, async (tx, state) => {
    assertMemberTestEconomy(state);
    const rows =
      await tx`select kind from credits_sandbox.access where user_id=${who.user.id}::uuid and enabled`;
    if (!rows.length || (rows[0].kind === "owner" && who.aal !== "aal2"))
      throw Error("Admission revoked");
    if (
      !(await tx`select beta_private.admitted(${who.user.id}::uuid) allowed`)[0]
        ?.allowed
    )
      throw Error("Admission revoked");
    const counterparties =
      command?.kind === "offer"
        ? [command.other]
        : command?.kind === "buy"
          ? [state.listings[command.listing]?.member]
          : command?.kind === "accept"
            ? [
                state.swaps[command.swap]?.member,
                state.swaps[command.swap]?.other,
              ]
            : [];
    for (const id of counterparties) {
      if (
        !id ||
        !(
          await tx`select user_id from credits_sandbox.access where user_id=${id}::uuid and enabled and beta_private.admitted(user_id)`
        ).length
      )
        throw Error("Counterparty no longer admitted");
    }
  });
  let result: unknown = null;
  if (input !== undefined) {
    const body = z
      .object({ request: z.string().uuid(), command: z.unknown() })
      .strict()
      .parse(input);
    command = memberTestCommand(body.command);
    const other = command.kind === "offer" ? command.other : null;
    if (other && !peers.some((p) => p.id === other))
      throw Error("Counterparty not admitted");
    assertMemberTestEconomy(await store.read());
    result = await store.execute(
      { id: who.user.id, role: "member" },
      body.request,
      command,
    );
  }
  const s = await store.read();
  assertMemberTestEconomy(s);
  if (command?.kind === "open-pack")
    result = testReceipt(s, command.entitlement, who.user.id);
  return {
    state: memberTestView(
      s,
      who.user.id,
      peers.map((p) => ({ id: String(p.id), label: String(p.label) })),
      isOwner,
    ),
    result,
  };
}
