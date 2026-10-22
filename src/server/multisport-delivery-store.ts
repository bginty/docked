import type { Sql } from "postgres";
import { digest } from "../core/scoring-engine";
import {
  validateDelivery,
  cursorSequence,
  type FeedSport,
} from "../core/multisport-delivery";
/** Operator-only. Atomic raw projection/checkpoint/outbox; no public write route. */
export class MultisportDeliveryStore {
  constructor(
    private sql: Sql,
    private binding: {
      source: string;
      dataset: string;
      allowSynthetic: boolean;
    },
  ) {}
  async apply(sport: FeedSport, input: unknown, at = new Date().toISOString()) {
    const page = validateDelivery(
        input,
        sport,
        this.binding.dataset,
        this.binding.allowSynthetic,
      ),
      hash = digest(page),
      source = this.binding.source;
    if (!source || source.length > 160 || !Number.isFinite(Date.parse(at)))
      throw Error("Invalid delivery binding");
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`delivery:${source}:${sport}`},0))`;
      const [prior] =
        await tx`select * from sports_feed.delivery_checkpoints where source=${source} and sport=${sport}`;
      if (prior && prior.dataset !== page.dataset_id)
        throw Error("Dataset replaced; reviewed resynchronisation required");
      const [receipt] =
        await tx`select digest from sports_feed.delivery_receipts where source=${source} and sport=${sport} and digest=${hash}`;
      if (receipt) return { replay: true, digest: hash, cursor: prior.cursor };
      const seq = cursorSequence(page.next_cursor, page.dataset_id, sport);
      if (prior && seq < Number(prior.sequence))
        throw Error("Stale delivery checkpoint");
      for (const c of page.data) {
        if (prior && c.seq <= Number(prior.sequence))
          throw Error("Overlapping delivery requires an exact receipt replay");
        const kind =
          c.kind === "removal"
            ? "player_game"
            : c.kind === "fixture_state"
              ? "fixture"
              : c.kind;
        const h = digest(c.payload),
          [old] =
            await tx`select * from sports_feed.delivery_records where source=${source} and sport=${sport} and kind=${kind} and entity=${c.entity}`;
        if (old && Number(old.revision) > c.revision) continue;
        if (old && Number(old.revision) === c.revision) {
          if (old.payload_hash !== h) throw Error("Conflicting equal revision");
          continue;
        }
        const body =
          kind === "fixture" && old
            ? { ...old.payload, ...c.payload }
            : c.payload;
        await tx`insert into sports_feed.delivery_records values(${source},${sport},${kind},${c.entity},${c.revision},${tx.json(body)},${h}) on conflict(source,sport,kind,entity) do update set revision=excluded.revision,payload=excluded.payload,payload_hash=excluded.payload_hash`;
        if (kind === "fixture" || kind === "player_game")
          await tx`insert into sports_feed.delivery_recalculations(source,sport,entity,revision) values(${source},${sport},${c.entity},${c.revision}) on conflict do nothing`;
      }
      await tx`insert into sports_feed.delivery_checkpoints values(${source},${sport},${page.dataset_id},${seq},${page.next_cursor},${at}) on conflict(source,sport) do update set sequence=excluded.sequence,cursor=excluded.cursor,last_success=excluded.last_success`;
      await tx`insert into sports_feed.delivery_receipts(source,sport,digest,cursor) values(${source},${sport},${hash},${page.next_cursor})`;
      return { replay: false, digest: hash, cursor: page.next_cursor };
    });
  }
}
