import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import { setSportBetaContext } from "./sports-private-beta";
import { playerJerseysQuery } from "./player-jerseys-query";
import { testCard, type TestCardSource } from "@/core/member-test-wallet";
import {
  collectionQuery,
  collectionPageSize,
  type CollectionCard,
  type CollectionPage,
} from "@/core/owned-collection";
import { nflSearchTeams } from "@/core/card-presentation";
import production from "../../config/hosted-production.json";

const cursorSchema = z
  .object({
    offset: z.number().int().min(0).max(100000),
    revision: z.string().regex(/^[a-f0-9]{32}$/),
    scope: z.string().length(64),
  })
  .strict();
export type RawCard = {
  id: string;
  inventory: CollectionCard["inventory"];
  acquired_at: string | null;
  card: CollectionCard;
  commerce: TestCardSource["commerce"]["cards"][string];
  instance: NonNullable<TestCardSource["economy"]>["instances"][string];
  player: NonNullable<TestCardSource["economy"]>["players"][string];
};
export async function ownedCollection(input: unknown): Promise<CollectionPage> {
  const { cursor, ...query } = collectionQuery.parse(input);
  const who = await requireIdentity();
  if (process.env.DOCKED_BETA_STAGING !== "true") throw Error("Access denied");
  if (!(await rateLimit(`collection:${who.user.id}`, 120, 60)))
    throw Error("Collection rate limit");
  const scope = createHash("sha256")
    .update(who.user.id + JSON.stringify(query))
    .digest("hex");
  let page: { offset: number; revision?: string } = { offset: 0 };
  if (cursor) {
    try {
      const decoded = cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString()),
      );
      if (decoded.scope !== scope) throw Error("Cursor scope");
      page = decoded;
    } catch {
      throw Error("Invalid collection cursor");
    }
  }
  return await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select set_config('docked.fantasy_production',${production.supabaseProjectRef!},true),set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
    if (query.sport !== "nfl") await setSportBetaContext(tx, query.sport);
    const filters = {
      ...query,
      ...page,
      search_teams: query.sport === "nfl" ? nflSearchTeams(query.search) : [],
    };
    const [row] =
      await tx`select fantasy.owned_collection_page(${tx.json(filters)}) result`;
    const { rows, ...summary } = row.result as Omit<
      CollectionPage,
      "cards" | "member" | "sport" | "next"
    > & { rows: RawCard[] };
    const cards: CollectionCard[] = rows.map((raw) => {
      const card =
        raw.card || raw.inventory === "collectible"
          ? raw.card
          : testCard(
              {
                commerce: { cards: { [raw.id]: raw.commerce } },
                cards: { [raw.id]: true },
                ...(raw.instance && raw.player
                  ? {
                      economy: {
                        instances: { [raw.id]: raw.instance },
                        players: { [raw.instance.playerId]: raw.player },
                      },
                    }
                  : {}),
              },
              raw.id,
            );
      return {
        ...card,
        inventory: raw.inventory,
        acquired_at: raw.acquired_at,
      };
    });
    if (query.sport === "nfl" && cards.length) {
      const observations = await tx.unsafe(playerJerseysQuery, [
        [...new Set(cards.map((c) => c.canonical_player_id ?? c.player_id))],
      ]);
      const numbers = new Map(observations.map((r) => [r.id, r]));
      for (const card of cards) {
        const r = numbers.get(card.canonical_player_id ?? card.player_id);
        card.verifiedJerseyNumber =
          r?.team === card.team ? r.verified_jersey_number : null;
      }
    }
    const offset = page.offset + collectionPageSize;
    return {
      ...summary,
      member: who.user.id,
      sport: query.sport,
      cards,
      next:
        !summary.changed && offset < summary.filtered
          ? Buffer.from(
              JSON.stringify({ offset, revision: summary.revision, scope }),
            ).toString("base64url")
          : null,
    };
  });
}
