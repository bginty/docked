import { randomUUID } from "node:crypto";
import { digest } from "../core/scoring-engine";
import { feedChanges, feedGame } from "../core/nfl-testing-feed";
import { NflTestingClient, FeedFailure } from "./nfl-testing-client";

export interface FeedDb {
  query<T = Record<string, any>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  transaction<T>(fn: (db: FeedDb) => Promise<T>): Promise<T>;
}
export class NflTestingStore {
  constructor(public db: FeedDb) {}
  async lease() {
    const token = randomUUID();
    const { rows } = await this.db.query(
      "update nfl_test_feed.consumer set lease=$1,lease_until=now()+interval '2 minutes' where id=1 and (lease is null or lease_until<now()) returning id",
      [token],
    );
    if (!rows.length) throw new FeedFailure("FEED_BUSY");
    return token;
  }
  async assertLease(tx: FeedDb, token: string) {
    if (
      !(
        await tx.query(
          "update nfl_test_feed.consumer set lease_until=now()+interval '2 minutes' where id=1 and lease=$1 and lease_until>now() returning id",
          [token],
        )
      ).rows.length
    )
      throw new FeedFailure("FEED_LEASE_EXPIRED");
  }
  async page(
    token: string,
    generation: string,
    pageInput: unknown,
    expectedCursor: string | null,
    beforeCheckpoint?: () => void,
  ) {
    const page = feedChanges.parse(pageInput);
    return this.db.transaction(async (tx) => {
      await this.assertLease(tx, token);
      const old = (
        await tx.query(
          "select * from nfl_test_feed.generations where id=$1 for update",
          [generation],
        )
      ).rows[0];
      if (
        !old ||
        old.dataset !== page.dataset_id ||
        old.cursor !== expectedCursor
      )
        throw new FeedFailure("FEED_CHECKPOINT_CONFLICT");
      let seq = expectedCursor
        ? Number(expectedCursor.slice(expectedCursor.lastIndexOf(":") + 1))
        : 0;
      for (const e of page.data) {
        if (
          e.seq <= seq ||
          e.game_id !== e.payload.game_id ||
          e.player_id !== e.payload.player_id ||
          e.revision !== e.payload.revision
        )
          throw new FeedFailure("FEED_EVENT_IDENTITY");
        seq = e.seq;
        const prior = (
          await tx.query(
            "select revision,payload,removed from nfl_test_feed.records where generation=$1 and game=$2 and player=$3",
            [generation, e.game_id, e.player_id],
          )
        ).rows[0];
        if (
          prior &&
          Number(prior.revision) === e.revision &&
          digest(prior.payload) !==
            digest({ ...e.payload, removed: e.operation === "remove" })
        )
          throw new FeedFailure("FEED_CONFLICTING_REVISION");
        const { rows } = await tx.query(
          `insert into nfl_test_feed.records values($1,$2,$3,$4,$5,$6)
          on conflict(generation,game,player) do update set revision=excluded.revision,removed=excluded.removed,payload=excluded.payload
          where nfl_test_feed.records.revision<excluded.revision returning player`,
          [
            generation,
            e.game_id,
            e.player_id,
            e.revision,
            e.operation === "remove",
            JSON.stringify({ ...e.payload, removed: e.operation === "remove" }),
          ],
        );
        if (rows.length)
          await tx.query(
            "insert into nfl_test_feed.outbox(generation,game,source_hash) values($1,$2,$3) on conflict do nothing",
            [generation, e.game_id, digest(e)],
          );
      }
      if (
        page.next_cursor !== `${page.dataset_id}:${seq}` ||
        (page.has_more && !page.data.length)
      )
        throw new FeedFailure("FEED_INVALID_CURSOR");
      beforeCheckpoint?.();
      await tx.query(
        "update nfl_test_feed.generations set cursor=$2 where id=$1",
        [generation, page.next_cursor],
      );
    });
  }
  async map(
    dataset: string,
    canonical: string,
    docked: string,
    position: string,
    evidence: Record<string, unknown>,
    reviewer: string,
  ) {
    if (
      !reviewer.trim() ||
      !evidence.identitySource ||
      !evidence.verifiedIdentity ||
      !evidence.verifiedAt ||
      !["QB", "RB", "WR", "TE"].includes(position)
    )
      throw Error("Reviewed stable identity evidence required");
    await this.db.transaction(async (tx) => {
      const old = (
        await tx.query(
          "select * from nfl_test_feed.mappings where dataset=$1 and canonical=$2",
          [dataset, canonical],
        )
      ).rows[0];
      if (old) {
        if (old.docked !== docked || old.position !== position)
          throw Error("Conflicting identity quarantined");
        return;
      }
      await tx.query(
        "insert into nfl_test_feed.mappings(dataset,canonical,docked,position,evidence,reviewed_by) values($1,$2,$3,$4,$5,$6)",
        [
          dataset,
          canonical,
          docked,
          position,
          JSON.stringify(evidence),
          reviewer,
        ],
      );
      await tx.query(
        "insert into nfl_test_feed.audit(action,detail) values('identity-reviewed',$1)",
        [JSON.stringify({ dataset, canonical, docked, reviewer, evidence })],
      );
      await tx.query(
        "update nfl_test_feed.outbox set status='pending',reason=null where generation in(select id from nfl_test_feed.generations where dataset=$1) and status='unmapped'",
        [dataset],
      );
    });
  }
  async sync(client: NflTestingClient, resync = false) {
    const token = await this.lease();
    try {
      const active = (
        await this.db.query(
          "select g.* from nfl_test_feed.consumer c join nfl_test_feed.generations g on g.id=c.active where c.id=1",
        )
      ).rows[0];
      const pending = (
        await this.db.query(
          "select g.* from nfl_test_feed.consumer c join nfl_test_feed.generations g on g.id=c.pending where c.id=1",
        )
      ).rows[0];
      const resume = resync ? null : (active ?? pending);
      let cursor = resume?.cursor ?? null;
      const first = await client.get("/v1/stat-changes", {
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });
      if (active && !resync && active.dataset !== first.dataset_id)
        throw new FeedFailure("FEED_RESYNC_REQUIRED");
      const generation = resume?.id ?? randomUUID();
      if (!resume)
        await this.db.transaction(async (tx) => {
          await this.assertLease(tx, token);
          await tx.query(
            "insert into nfl_test_feed.generations(id,dataset)values($1,$2)",
            [generation, first.dataset_id],
          );
          await tx.query(
            "update nfl_test_feed.consumer set pending=$1 where id=1",
            [generation],
          );
        });
      let page = first;
      for (let n = 0; n < 10000; n++) {
        await this.page(token, generation, page, cursor);
        cursor = String(page.next_cursor);
        if (!page.has_more) break;
        if (n === 9999) throw new FeedFailure("FEED_PAGE_LIMIT");
        page = await client.get("/v1/stat-changes", { limit: "200", cursor });
      }
      for (const kind of ["games", "players"] as const) {
        let after: string | null = null;
        const seen = new Set<string>();
        do {
          const list = await client.get(`/v1/${kind}`, {
            limit: "200",
            ...(after ? { after } : {}),
          });
          if (list.dataset_id !== first.dataset_id || !Array.isArray(list.data))
            throw new FeedFailure("FEED_RESYNC_REQUIRED");
          await this.db.transaction(async (tx) => {
            await this.assertLease(tx, token);
            for (const item of list.data as Record<string, unknown>[]) {
              const data = kind === "games" ? feedGame.parse(item) : item;
              if (typeof data.id !== "string")
                throw new FeedFailure("FEED_INVALID_IDENTITY");
              const old = (
                await tx.query(
                  `select payload from nfl_test_feed.${kind} where generation=$1 and ${kind === "games" ? "game" : "player"}=$2`,
                  [generation, data.id],
                )
              ).rows[0];
              await tx.query(
                `insert into nfl_test_feed.${kind} values($1,$2,$3) on conflict(generation,${kind === "games" ? "game" : "player"}) do update set payload=excluded.payload`,
                [generation, data.id, JSON.stringify(data)],
              );
              if (
                kind === "games" &&
                (!old || digest(old.payload) !== digest(data))
              )
                await tx.query(
                  "insert into nfl_test_feed.outbox(generation,game,source_hash)values($1,$2,$3) on conflict do nothing",
                  [generation, data.id, digest(data)],
                );
            }
          });
          after = list.next_after as string | null;
          if (after && (typeof after !== "string" || seen.has(after)))
            throw new FeedFailure("FEED_PAGINATION_LOOP");
          if (after) seen.add(after);
        } while (after);
      }
      await this.db.transaction(async (tx) => {
        await this.assertLease(tx, token);
        // Publish a replacement generation only after all changes AND metadata
        // are complete. Old generations remain available for audit/recovery.
        await tx.query(
          "update nfl_test_feed.consumer set active=$1,pending=null,last_success=now(),last_error=null where id=1",
          [generation],
        );
        if (resync)
          await tx.query(
            "insert into nfl_test_feed.audit(action,detail) values('generation-replaced',$1)",
            [
              JSON.stringify({
                from: active?.id,
                to: generation,
                mappingsRequireDatasetReview: true,
              }),
            ],
          );
      });
      return generation;
    } catch (error) {
      await this.db.query(
        "update nfl_test_feed.consumer set last_error=$1 where id=1 and lease=$2",
        [
          error instanceof FeedFailure ? error.code : "FEED_IMPORT_FAILED",
          token,
        ],
      );
      throw error;
    } finally {
      await this.db.query(
        "update nfl_test_feed.consumer set lease=null,lease_until=null where id=1 and lease=$1",
        [token],
      );
    }
  }
}
