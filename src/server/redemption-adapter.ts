import { z } from "zod";
import type { CreditsState } from "../core/credits-sandbox";
import type { Operator } from "../core/commerce-sandbox";
import { redemptionCommand } from "../core/redemption";
import { RedemptionVault, bankInput, matchingName } from "./redemption-vault";
export function assertLocalRedemption(env: Record<string, string | undefined>) {
  if (
    env.DOCKED_REDEMPTION_LOCAL !== "true" ||
    env.NODE_ENV === "production" ||
    env.VERCEL ||
    env.APP_ENV === "production"
  )
    throw Error("Live redemption and document collection are disabled");
  const u = new URL(env.DATABASE_URL ?? "http://invalid");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    !/local/i.test(u.pathname)
  )
    throw Error("Explicit isolated local database required");
}
export const redemptionHttp = z
  .object({ request: z.string().uuid(), operation: z.unknown() })
  .strict();
export function prepareRedemption(
  s: CreditsState,
  actor: Operator,
  request: string,
  input: unknown,
  now: number,
  vault: RedemptionVault,
) {
  if (
    input &&
    typeof input === "object" &&
    "action" in input &&
    input.action === "bank-save"
  ) {
    const c = z
        .object({ action: z.literal("bank-save"), bank: bankInput })
        .strict()
        .parse(input),
      i = s.redemption?.identities[actor.id];
    if (!i || actor.role !== "member")
      throw Error("Verified identity required");
    const existing = s.redemption?.destinations[request];
    if (existing) {
      if (
        existing.member !== actor.id ||
        JSON.stringify(vault.open(existing.ciphertext, actor.id, request)) !==
          JSON.stringify(c.bank)
      )
        throw Error("Idempotency conflict");
      return redemptionCommand.parse({
        kind: "redemption",
        operation: { action: "bank-save", destination: existing },
      });
    }
    return redemptionCommand.parse({
      kind: "redemption",
      operation: {
        action: "bank-save",
        destination: {
          id: request,
          member: actor.id,
          ciphertext: vault.seal(c.bank, actor.id, request),
          last4: c.bank.account.slice(-4),
          nameMatched: matchingName(c.bank.holder, i.verifiedName),
          identityRevision: i.revision,
          at: now,
        },
      },
    });
  }
  const c = redemptionCommand.parse({ kind: "redemption", operation: input });
  if (c.operation.action === "bank-save")
    throw Error("Client-supplied bank approval denied");
  if (
    c.operation.action === "identity-submit" &&
    c.operation.evidence !== `fixture-evidence-${actor.id}`
  )
    throw Error(
      "Only the isolated synthetic evidence fixture is supported; real uploads are disabled",
    );
  return c;
}
