import "server-only";
import afl from "../../config/history/afl-2026.json";
import nrl from "../../config/history/nrl-2026.json";
import {
  historicalArchive,
  historicalPage,
  historyQuery,
} from "@/core/historical-fixtures";
import { requireIdentity } from "./auth";
import { db } from "./db";
import { setSportBetaContext } from "./sports-private-beta";
const archives = {
  afl: historicalArchive.parse(afl),
  nrl: historicalArchive.parse(nrl),
};
export async function readHistoricalFixtures(input: unknown) {
  const query = historyQuery.parse(input),
    who = await requireIdentity();
  const allowed = await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    await setSportBetaContext(tx, query.sport);
    return (
      (await tx`select sports_feed.private_beta_sport_capability() allowed`)[0]
        ?.allowed === true
    );
  });
  if (!allowed) throw Error("Sport access required");
  return historicalPage(archives[query.sport], query);
}
