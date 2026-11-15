import "server-only";
import type { TransactionSql } from "postgres";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import { assertMemberTestEconomy } from "../core/member-test-wallet";
import {
  founderCreditCampaign,
  founderCreditIssue,
  founderCreditCommand,
} from "../core/founder-credits";

export async function founderCredits(input?: unknown) {
  if (
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.DOCKED_COMMERCIAL_CHECKOUT === "true"
  )
    throw Error("Free beta credits unavailable");
  const who = await requireRole(["owner"]),
    sql = db();
  if (
    !(await rateLimit(
      `founder-free-credits:${who.user.id}`,
      input === undefined ? 30 : 10,
      60,
    ))
  )
    throw Error("Please wait before another request");
  if (input !== undefined) {
    const value = founderCreditIssue.parse(input);
    const store = new CreditsSandboxStore(sql, async (tx, state) => {
      await setCommunityClaims(tx as unknown as TransactionSql, who);
      await tx`select beta_packs.assert_grant(${value.member}::uuid)`;
      assertMemberTestEconomy(state);
    });
    const result = await store.execute(
      { id: who.user.id, role: "reviewer", aal: "aal2" },
      value.request,
      founderCreditCommand(value),
    );
    return { issued: true, request: value.request, result };
  }
  return sql.begin(async (tx) => {
    await setCommunityClaims(tx as unknown as TransactionSql, who);
    const [row] = await tx`select beta_packs.owner_members() members`;
    const state = await new CreditsSandboxStore(
      tx as unknown as typeof sql,
    ).read();
    assertMemberTestEconomy(state);
    return {
      members: row.members as { id: string; label: string }[],
      remaining: Math.max(
        0,
        state.policy.campaignLimit -
          (state.campaigns[founderCreditCampaign] ?? 0),
      ),
    };
  });
}
