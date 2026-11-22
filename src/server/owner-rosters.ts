import "server-only";
import type { Sql } from "postgres";
import { z } from "zod";
import {
  ownerRosterQuery,
  rosterBatchCommand,
  rosterActivationCommand,
} from "@/core/commercial-player-roster";
import { assertIsolatedPublicPreview } from "@/core/isolated-public-preview.mjs";
import { requireRole } from "./auth";
import { commercialRuntime } from "./commercial-runtime";
import { CommercialPlayerRosterStore } from "./commercial-player-roster";
import { rateLimit } from "./db";

export class OwnerRosterAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 429,
  ) {
    super(message);
  }
}

async function rosterContext(
  access: "read" | "export" | "mutation",
  expectedOwner?: string,
) {
  const actor = await requireRole(["owner"]);
  if (
    (expectedOwner !== undefined || access === "mutation") &&
    (!z.string().uuid().safeParse(expectedOwner).success ||
      expectedOwner !== actor.user.id)
  )
    throw new OwnerRosterAccessError(
      "The signed-in Owner changed. Reload the roster from your Owner dashboard.",
      403,
    );
  if (
    process.env.DOCKED_BETA_STAGING === "true" ||
    process.env.DOCKED_COMMERCIAL_SERVICE !== "true"
  )
    throw new OwnerRosterAccessError(
      "The commercial player roster is unavailable in this environment.",
      403,
    );
  if (access === "mutation" && assertIsolatedPublicPreview(process.env))
    throw new OwnerRosterAccessError(
      "Roster changes are read-only in this acceptance environment.",
      403,
    );
  if (
    !(await rateLimit(
      `owner-rosters:${access}:${actor.user.id}`,
      access === "read" ? 60 : 10,
      60,
    ))
  )
    throw new OwnerRosterAccessError(
      "Too many roster requests. Wait briefly before trying again.",
      429,
    );
  const { ledger } = await commercialRuntime();
  const authorize = async (tx: Sql) => {
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
  };
  return {
    actor,
    store: new CommercialPlayerRosterStore(ledger.sql),
    authorize,
  };
}

export async function ownerRosters(
  input: Record<string, string | undefined>,
  options: { all?: boolean; expectedOwner?: string } = {},
) {
  const query = ownerRosterQuery.strict().parse(input);
  const { actor, store, authorize } = await rosterContext(
    options.all ? "export" : "read",
    options.expectedOwner,
  );
  return store.read(actor.user.id, authorize, query, {
    all: options.all === true,
  });
}

/** Reviewed facts are applied atomically. This is not a remote-feed importer. */
export async function ownerRosterDecisions(
  input: unknown,
  expectedOwner: string,
) {
  const { actor, store, authorize } = await rosterContext(
    "mutation",
    expectedOwner,
  );
  return store.apply(actor.user.id, rosterBatchCommand.parse(input), authorize);
}

/** Adding a player to packs is separate from recording their club/status. */
export async function ownerRosterActivation(
  input: unknown,
  expectedOwner: string,
) {
  const { actor, store, authorize } = await rosterContext(
    "mutation",
    expectedOwner,
  );
  return store.activate(
    actor.user.id,
    rosterActivationCommand.parse(input),
    authorize,
  );
}
