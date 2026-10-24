import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import { setSportBetaContext } from "./sports-private-beta";
import production from "../../config/hosted-production.json";
import type { CollectionRecord } from "@/core/profile-overview";

export async function memberCollectionRecord(
  input: unknown,
): Promise<CollectionRecord> {
  const sport = z.enum(["nfl", "afl", "nrl"]).parse(input);
  const who = await requireIdentity();
  if (process.env.DOCKED_BETA_STAGING !== "true") throw Error("Access denied");
  if (!(await rateLimit(`profile-record:${who.user.id}`, 90, 60)))
    throw Error("Rate limit");
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select set_config('docked.fantasy_production',${production.supabaseProjectRef!},true),set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
    if (sport !== "nfl") await setSportBetaContext(tx, sport);
    const [row] =
      await tx`select fantasy.member_collection_record(${sport}) result`;
    return row.result as CollectionRecord;
  });
}
