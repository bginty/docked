import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import { commercialCard } from "../core/commercial-presentation";
import {
  assertCommercialApproval,
  commercialPack,
  commercialSports,
  type CommercialSport,
} from "../core/commercial-billing";
import { packOdds } from "../core/pack-odds";
import type { PackShopState } from "../core/pack-shop-state";
import {
  collectionQuery,
  collectionPageSize,
  type CollectionPage,
} from "../core/owned-collection";
import type { CommercialLedger } from "./commercial-ledger";
import { hasRequiredPackSupply } from "../core/commercial-pack-supply";
import { preservedCollectionCard } from "../core/preserved-collection";

/** Member ID comes only from the authenticated adapter. Read projections never
 * combine commercial amounts or instances with the test inventory. */
export class CommercialMemberView {
  constructor(
    private ledger: CommercialLedger,
    private member: string,
    private authorize: () => Promise<void>,
    private includePreserved = false,
    private marketEnabled = false,
  ) {}
  async summary() {
    await this.authorize();
    const [row] = await this.ledger
      .sql`select count(*) filter(where opened_at is null)::int unopened,count(*) filter(where opened_at is not null)::int opened from commercial_billing.packs where member_id=${this.member}`;
    return {
      member: this.member,
      environment: "commercial",
      wallet: await this.ledger.wallet(this.member),
      packs: [],
      unopened: row.unopened,
      openedPacks: row.opened,
      swaps: [],
      portfolio: null,
    };
  }
  async packs(offset = 0): Promise<
    PackShopState & {
      next: number | null;
      history: { id: string; at: string; label: string; change: number }[];
    }
  > {
    z.number().int().min(0).max(100000).parse(offset);
    await this.authorize();
    return this.ledger.sql.begin(
      "isolation level repeatable read read only",
      async (raw) => {
        const sql = raw as unknown as Sql;
        const [c] =
          await sql`select * from commercial_billing.control where id`;
        if (c?.environment !== this.ledger.environment)
          throw Error("Environment mismatch");
        let approved = false;
        try {
          assertCommercialApproval(
            c as Parameters<typeof assertCommercialApproval>[0],
            this.ledger.environment,
          );
          approved = c.issuance_enabled === true;
        } catch {}
        const pool = await sql<
          { sport: string; rarity: string; players: number }[]
        >`select sport,rarity,count(distinct player_id)::int players from commercial_billing.definitions where approved and issued<lifetime_cap group by sport,rarity`;
        const products: PackShopState["products"] = commercialSports.flatMap(
          (sport) =>
            (["STANDARD", "PREMIUM"] as const).flatMap((family) =>
              ([1, 3, 9] as const).map((size) => {
                const p = commercialPack(sport, family, size);
                const eligible = pool.filter(
                  (r) =>
                    r.sport === sport &&
                    p.weights[r.rarity as keyof typeof p.weights] > 0,
                );
                // The same rule is enforced again under issuance row locks.
                const available =
                  approved && hasRequiredPackSupply(p, eligible);
                return {
                  id: p.id,
                  name: p.name,
                  price: p.priceCredits,
                  tier: p.type,
                  cards: p.cards,
                  sport,
                  weights: p.weights,
                  odds: packOdds(p),
                  positions: [],
                  guaranteedSlots: p.guaranteedSlots,
                  duplicatePlayers: p.duplicatePlayers,
                  eligiblePlayers: eligible.reduce(
                    (n, r) => Math.max(n, r.players),
                    0,
                  ),
                  version: p.configurationHash,
                  available,
                  availabilityReason: available
                    ? null
                    : "This pack is not available for purchase. No credits will be taken.",
                  availabilityRetryable: true,
                };
              }),
            ),
        );
        const rows =
          await sql`select id,product,price,created_at,opened_at from commercial_billing.packs where member_id=${this.member} order by created_at desc,id desc limit 51 offset ${offset}`;
        const history =
          await sql`select j.id,j.created_at,j.reason,sum(l.amount)::text amount from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where l.account=${"member:" + this.member} and j.unit='CREDITS' group by j.id order by j.created_at desc,j.id desc limit 50`;
        const [balance] =
          await sql`select coalesce(sum(remaining),0)::text balance,exists(select 1 from commercial_billing.recovery_cases where member_id=${this.member} and state='OPEN') held from commercial_billing.lots where member_id=${this.member}`;
        return {
          member: this.member,
          environment: "commercial",
          economyEnabled: true,
          wallet: { spendable: balance.held ? 0 : Number(balance.balance) },
          products,
          packs: rows.slice(0, 50).map((r) => ({
            id: r.id,
            status: r.opened_at ? "OPENED" : "SEALED",
            product: r.product.id,
            type: r.product.type,
            sport: r.product.sport,
            purchasedAt: new Date(r.created_at).getTime(),
            paidCredits: Number(r.price),
            coupon: null,
            cardCount: r.product.cards,
            configuration: r.product.configurationHash,
            name: r.product.name,
            receipt: null,
          })),
          next: rows.length > 50 ? offset + 50 : null,
          history: history.map((r) => ({
            id: r.id,
            at: new Date(r.created_at).toISOString(),
            label: r.reason,
            change: Number(r.amount),
          })),
        };
      },
    );
  }
  async collection(input: unknown): Promise<CollectionPage> {
    const { cursor, ...q } = collectionQuery.parse(input);
    if (!commercialSports.includes(q.sport as CommercialSport))
      throw Error("Sport unavailable");
    await this.authorize();
    const scope = createHash("sha256")
      .update(this.member + JSON.stringify(q))
      .digest("hex");
    const page = cursor
      ? z
          .object({
            scope: z.literal(scope),
            offset: z.number().int().min(0).max(100000),
            revision: z.string().regex(/^[a-f0-9]{32}$/),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(cursor, "base64url").toString()))
      : { offset: 0, revision: null };
    return this.ledger.sql.begin(
      "isolation level repeatable read read only",
      async (raw) => {
        const sql = raw as unknown as Sql;
        const [control] =
          await sql`select * from commercial_billing.control where id`;
        if (control?.environment !== this.ledger.environment)
          throw Error("Environment mismatch");
        let transfers = false;
        try {
          assertCommercialApproval(
            control as Parameters<typeof assertCommercialApproval>[0],
            this.ledger.environment,
          );
          transfers = this.marketEnabled && control.transfers_enabled === true;
        } catch {}
        const commercial = sql`select c.id::text id,c.definition,c.serial,d.player_id,d.sport,d.rarity,d.lifetime_cap,d.snapshot,(select max(e.created_at) from commercial_billing.ownership_events e where e.card=c.id and e.to_member=c.owner_id) acquired_at,null::jsonb preserved,c.locked from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack where c.owner_id=${this.member} and d.sport=${q.sport} and p.opened_at is not null`;
        const source = this.includePreserved
          ? sql`${commercial} union all select p.id,null::uuid,p.serial,null::uuid,${q.sport}::text,p.rarity,null::integer,p.snapshot,p.acquired_at,p.preserved,true from commercial_billing.preserved_collection_rows(${this.member}::uuid,${q.sport}) p where not exists(select 1 from commercial_billing.cards c where c.id::text=p.id)`
          : commercial;
        const counts =
          await sql`with owned as (${source}) select rarity,count(*)::int n from owned group by rarity`;
        const [summary] =
          await sql`with owned as (${source}) select md5(coalesce(string_agg(to_jsonb(owned)::text,',' order by id),'')) revision,array_agg(distinct snapshot->>'team') teams,array_agg(distinct snapshot->>'position') positions from owned`;
        const filtered = sql`select * from (${source}) owned where (${q.rarity}='ALL' or rarity=${q.rarity}) and (${q.team}='' or snapshot->>'team'=${q.team}) and (${q.position}='' or snapshot->>'position'=${q.position}) and (${q.search}='' or strpos(lower((snapshot->>'name')||' '||(snapshot->>'team')||' '||serial::text),lower(${q.search}))>0)`;
        const [n] = await sql`select count(*)::int total from (${filtered}) f`;
        const order = {
          recent: "acquired_at desc,id desc",
          name: "lower(snapshot->>'name'),id",
          serial: "serial,id",
          rarity:
            "case rarity when 'ICON' then 6 when 'LEGENDARY' then 5 when 'ULTRA_RARE' then 4 when 'ELITE' then 3 when 'RARE' then 2 else 1 end desc,id",
        }[q.sort];
        const changed =
          page.revision !== null && page.revision !== summary.revision;
        const rows = changed
          ? []
          : await sql`select * from (${filtered}) f order by ${sql.unsafe(order)} limit ${collectionPageSize} offset ${page.offset}`;
        return {
          member: this.member,
          sport: q.sport,
          total: counts.reduce((n, r) => n + r.n, 0),
          filtered: n.total,
          counts: Object.fromEntries(counts.map((r) => [r.rarity, r.n])),
          teams: summary.teams ?? [],
          positions: summary.positions ?? [],
          revision: summary.revision,
          changed,
          cards: rows.map((r) => {
            const acquired = r.acquired_at
              ? new Date(r.acquired_at).toISOString()
              : null;
            if (r.preserved)
              return preservedCollectionCard(r.preserved, acquired);
            return {
              ...commercialCard(
                {
                  ...r,
                  serial: Number(r.serial),
                } as Parameters<typeof commercialCard>[0],
                transfers && !r.locked,
              ),
              inventory: "collectible",
              acquired_at: acquired,
            };
          }),
          next:
            !changed && page.offset + collectionPageSize < n.total
              ? Buffer.from(
                  JSON.stringify({
                    scope,
                    offset: page.offset + collectionPageSize,
                    revision: summary.revision,
                  }),
                ).toString("base64url")
              : null,
        };
      },
    );
  }
}
