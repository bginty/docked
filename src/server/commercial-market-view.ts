import type { Sql } from "postgres";
import { z } from "zod";
import { createHash } from "node:crypto";
import { commercialCard } from "../core/commercial-presentation";
import {
  assertCommercialApproval,
  commercialSports,
  integer,
} from "../core/commercial-billing";
import { sellerQuote, saleFeePolicy } from "../core/credits-policy";
import { marketQuery, type MarketplaceView } from "../core/marketplace";
import type { CommercialLedger } from "./commercial-ledger";

/** Bounded commercial-only projection. No synthetic aggregate/wallet conversion,
 * unlisted third-party inventory, account identifiers or refund details exposed. */
export class CommercialMarketView {
  constructor(
    private ledger: CommercialLedger,
    private member: string,
    private authorize: (tx: Sql) => Promise<void>,
    private versions: { terms: string; privacy: string },
    private tradingGate = false,
  ) {}
  async read(input: unknown): Promise<MarketplaceView> {
    const q = marketQuery.parse(input);
    if (
      !commercialSports.includes(
        q.sport as (typeof commercialSports)[number],
      ) ||
      q.tab === "swaps"
    )
      throw Error("Marketplace sport or feature unavailable");
    const scope = createHash("sha256")
      .update(this.member + JSON.stringify({ ...q, cursor: "" }))
      .digest("hex");
    const page = q.cursor
      ? z
          .object({
            scope: z.literal(scope),
            offset: z.number().int().min(0).max(100000),
            revision: z.string().regex(/^[a-f0-9]{32}$/),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(q.cursor, "base64url").toString()))
      : { offset: 0, revision: null };
    return this.ledger.sql.begin(
      "isolation level repeatable read read only",
      async (raw) => {
        const sql = raw as unknown as Sql;
        await this.authorize(sql);
        const [control] =
          await sql`select * from commercial_billing.control where id`;
        if (control?.environment !== this.ledger.environment)
          throw Error("Marketplace environment mismatch");
        let trading = false;
        try {
          assertCommercialApproval(
            control as Parameters<typeof assertCommercialApproval>[0],
            this.ledger.environment,
          );
          trading = this.tradingGate && control.transfers_enabled === true;
        } catch {}
        const base = sql`select l.id,l.card,l.seller,l.buyer,l.price,l.revision,l.state,l.fee,l.net,l.sold_at,
    c.definition,c.serial,c.owner_id,c.locked,d.player_id,d.sport,d.rarity,d.lifetime_cap,d.snapshot,
    coalesce((select min(a.created_at) from commercial_billing.audit a where a.action='market-request' and a.details->'result'->>'listing'=l.id::text and a.details->>'kind'='list'),p.created_at) created_at,
    (select max(a.created_at) from commercial_billing.audit a where a.action='market-request' and a.details->'result'->>'listing'=l.id::text and a.details->>'kind'='cancel-listing') cancelled_at,
    (select a.details->'result'->'receipt' from commercial_billing.audit a where a.action='market-request' and a.details->'result'->>'listing'=l.id::text and a.details->>'kind'='buy' order by a.id limit 1) receipt
    from commercial_billing.listings l join commercial_billing.cards c on c.id=l.card join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack
    where d.sport=${q.sport} and p.opened_at is not null and (
     (${q.tab}='activity' and ((l.state='SOLD' and (l.seller=${this.member} or l.buyer=${this.member})) or (l.state='CANCELLED' and l.seller=${this.member})))
     or (${q.tab}='listings' and l.seller=${this.member} and l.state='OPEN')
     or (${q.tab}='browse' and l.state='OPEN' and not c.locked and c.owner_id=l.seller and commercial_billing.market_party_allowed(${this.member}::uuid,l.seller,${this.versions.terms},${this.versions.privacy})))`;
        const filtered = sql`select * from (${base}) r where
    (${q.listing}='' or id::text=${q.listing}) and (${q.sale}='' or id::text=${q.sale})
    and (${q.q}='' or strpos(lower(snapshot->>'name'),lower(${q.q}))>0)
    and (${q.team}='' or snapshot->>'team'=${q.team}) and (${q.position}='' or snapshot->>'position'=${q.position})
    and (${q.rarity}='' or rarity=${q.rarity}) and price between ${q.min} and ${q.max}
    and (${q.tab}<>'browse' or ${q.own}='include' or (${q.own}='only' and seller=${this.member}) or (${q.own}='exclude' and seller<>${this.member}))
    and ${q.round === ""} and (${q.playable}='' or false)
    and (${q.available}='' or (snapshot->>'status'='active' and coalesce((snapshot->>'observedAt')::numeric,0) between extract(epoch from clock_timestamp()-interval '72 hours')*1000 and extract(epoch from clock_timestamp())*1000))
    and (${q.tab}<>'activity' or ${q.activityType}='all' or (${q.activityType}='purchase' and buyer=${this.member}) or (${q.activityType}='sale' and seller=${this.member} and state='SOLD') or (${q.activityType}='cancellation' and state='CANCELLED'))`;
        const [summary] =
          await sql`select count(*)::int total,md5(coalesce(string_agg(id::text||':'||revision||':'||state||':'||price,',' order by id),'')) revision from (${filtered}) f`;
        if (page.revision !== null && page.revision !== summary.revision)
          throw Error("Marketplace changed; refresh the first page");
        const order =
          q.tab === "activity"
            ? "coalesce(sold_at,cancelled_at,created_at) desc,id"
            : {
                newest: "created_at desc,id",
                "price-asc": "price,id",
                "price-desc": "price desc,id",
                rarity:
                  "case rarity when 'ICON' then 6 when 'LEGENDARY' then 5 when 'ULTRA_RARE' then 4 when 'ELITE' then 3 else 2 end desc,id",
              }[q.sort];
        const records =
          await sql`select * from (${filtered}) f order by ${sql.unsafe(order)} limit ${q.limit + 1} offset ${page.offset}`;
        const [facets] =
          await sql`select coalesce(jsonb_agg(distinct snapshot->>'team'),'[]') teams,coalesce(jsonb_agg(distinct snapshot->>'position'),'[]') positions from (${base}) f`;
        const [balance] =
          await sql`select coalesce(sum(remaining),0)::text amount,exists(select 1 from commercial_billing.recovery_cases where member_id=${this.member} and state='OPEN') held from commercial_billing.lots where member_id=${this.member}`;
        const amount = integer(balance.amount);
        const decorate = (r: any): MarketplaceView["rows"][number]["card"] => ({
          ...commercialCard(
            { ...r, id: r.card ?? r.id, serial: integer(r.serial) },
            trading && !r.locked,
          ),
          salary: null,
          salaryRules: null,
          ownerReservations: [],
          fresh: false,
          eligible: false,
          fixture: null,
          transferReason: r.locked
            ? "This card is temporarily held."
            : r.owner_id !== this.member &&
                r.state === "OPEN" &&
                r.owner_id !== r.seller
              ? "Ownership changed; refresh the listing."
              : "",
          availability:
            "Permanent collectible. Current player availability is checked separately.",
          gameplay:
            "Practice competitions only. Scored competitions and prizes are disabled.",
        });
        const rows: MarketplaceView["rows"] = records
          .slice(0, q.limit)
          .map((r) => ({
            id: r.id,
            card: decorate(r),
            revision: r.revision,
            own: r.seller === this.member,
            seller: "Docked member",
            price: integer(r.price),
            preference: "sell",
            status: r.state,
            version: r.revision,
            createdAt: new Date(r.created_at).getTime(),
            cancelledAt: r.cancelled_at
              ? new Date(r.cancelled_at).getTime()
              : null,
            quote: sellerQuote(integer(r.price)),
            receipt:
              r.seller === this.member || r.buyer === this.member
                ? r.receipt
                : null,
            direction: r.seller === this.member ? "Sale" : "Purchase",
          }));
        const inventory: MarketplaceView["inventory"] = [];
        if (q.sell) {
          const [r] =
            await sql`select c.id,c.definition,c.serial,c.owner_id,c.locked,d.player_id,d.sport,d.rarity,d.lifetime_cap,d.snapshot,(select id from commercial_billing.listings where card=c.id and state='OPEN') listing_id from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack where c.id::text=${q.sell} and c.owner_id=${this.member} and d.sport=${q.sport} and p.opened_at is not null`;
          if (r)
            inventory.push({
              ...decorate(r),
              listingId: r.listing_id ?? null,
              listed: !!r.listing_id,
            });
        }
        const next =
          records.length > q.limit
            ? Buffer.from(
                JSON.stringify({
                  scope,
                  offset: page.offset + q.limit,
                  revision: summary.revision,
                }),
              ).toString("base64url")
            : null;
        const activity: MarketplaceView["activity"] =
          q.tab === "activity"
            ? rows.map((r) => ({
                id: "listing:" + r.id,
                kind:
                  r.status === "CANCELLED"
                    ? "cancellation"
                    : r.own
                      ? "sale"
                      : "purchase",
                status: r.status,
                at: r.receipt?.at ?? r.cancelledAt,
                description:
                  r.card.name + " · " + r.card.tier + " · #" + r.card.serial,
                reference: r.receipt?.reference ?? r.id,
                listing: r.id,
                card: r.card,
                ...(r.receipt
                  ? {
                      price: r.receipt.price,
                      fee: r.receipt.fee,
                      net: r.receipt.net,
                    }
                  : {}),
              }))
            : [];
        return {
          member: this.member,
          tradingEnabled: trading,
          offersEnabled: false,
          activity,
          activityTotal: q.tab === "activity" ? summary.total : 0,
          activityNext: q.tab === "activity" ? next : null,
          serverTime: Date.now(),
          query: q,
          wallet: {
            available: amount,
            pending: 0,
            reserved: 0,
            withdrawable: 0,
            total: amount,
            heldAvailable: balance.held ? amount : 0,
            spendable: balance.held ? 0 : amount,
            label: "Docked Credits · no cash withdrawal",
            withdrawableIsSubset: true,
            restricted: amount,
          },
          policy: saleFeePolicy,
          rows: q.tab === "activity" ? [] : rows,
          total: summary.total,
          next: q.tab === "activity" ? null : next,
          inventoryTotal: inventory.length,
          inventory,
          positions: facets.positions,
          teams: facets.teams,
          rounds: [],
        };
      },
    );
  }
}
