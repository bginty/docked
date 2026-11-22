import "server-only";
import type { Sql } from "postgres";
import { z } from "zod";
import { currentConsentVersions } from "@/core/auth-readiness";
import { assertIsolatedPublicPreview } from "@/core/isolated-public-preview.mjs";
import { ownerPackAwardCommand } from "@/core/owner-pack-awards";
import { requireRole } from "./auth";
import { commercialRuntime } from "./commercial-runtime";
import { rateLimit } from "./db";

export class OwnerPackAwardAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 429,
  ) {
    super(message);
  }
}

async function awardContext(
  access: "read" | "mutation",
  expectedOwner?: string,
) {
  const actor = await requireRole(["owner"]);
  // Bind a saved review to the verified owner even when another owner signs in
  // in a different tab. The header is an expectation, never an authority.
  if (
    (expectedOwner !== undefined || access === "mutation") &&
    (!z.string().uuid().safeParse(expectedOwner).success ||
      expectedOwner !== actor.user.id)
  )
    throw new OwnerPackAwardAccessError(
      "The signed-in Owner changed. Return to the Owner dashboard before continuing.",
      403,
    );
  if (
    process.env.DOCKED_BETA_STAGING === "true" ||
    process.env.DOCKED_COMMERCIAL_SERVICE !== "true"
  )
    throw new OwnerPackAwardAccessError(
      "Commercial pack awards are unavailable in this environment.",
      403,
    );
  // The existing shared Preview authorizes only its explicitly scoped billing
  // test identity. Adding an Owner page must not enlarge that mutation scope.
  if (access === "mutation" && assertIsolatedPublicPreview(process.env))
    throw new OwnerPackAwardAccessError(
      "Pack awards are read-only in this acceptance environment.",
      403,
    );
  if (
    !(await rateLimit(
      `owner-pack-awards:${access}:${actor.user.id}`,
      access === "read" ? 60 : 20,
      60,
    ))
  )
    throw new OwnerPackAwardAccessError(
      "Too many requests. Wait briefly, then retry the saved award.",
      429,
    );
  const { ledger } = await commercialRuntime();
  const authorize = async (tx: Sql) => {
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
  };
  return { actor, ledger, authorize };
}

export async function ownerPackAwardsView(offset = 0, expectedOwner?: string) {
  z.number().int().min(0).max(100000).parse(offset);
  const { actor, ledger, authorize } = await awardContext(
    "read",
    expectedOwner,
  );
  return ledger.ownerPackAwards(actor.user.id, authorize, offset);
}

export async function ownerPackAward(input: unknown, expectedOwner: string) {
  const { actor, ledger, authorize } = await awardContext(
    "mutation",
    expectedOwner,
  );
  const command = ownerPackAwardCommand.parse(input);
  return ledger.awardPacks(
    actor.user.id,
    command,
    authorize,
    currentConsentVersions(),
  );
}
