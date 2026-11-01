import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import {
  assertCommercialApproval,
  commercialPack,
  commercialProducts,
  integer,
  type BillingEnvironment,
  type CommercialReceipt,
  type CommercialSport,
} from "../core/commercial-billing";
import { drawPackRarity } from "../core/card-economy";
import { rarityRule } from "../core/card-rarity";
import { sellerQuote } from "../core/credits-policy";
import { digest } from "../core/scoring-engine";
import { commercialCardSnapshot } from "../core/commercial-presentation";
type Authorize = (tx: Sql, member: string) => Promise<void>;
type Funding = { lot: string; receipt: string; amount: number }[];
const uuid = z.string().uuid();
/** Private commercial repository. Same authenticated Docked member IDs, separate
 * accounting provenance; no reads/writes or conversion of credits_sandbox. */
export class CommercialLedger {
  constructor(
    readonly sql: Sql,
    readonly environment: BillingEnvironment,
    private keys: { active: string; values: Record<string, Buffer> },
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,32}$/.test(keys.active) ||
      keys.values[keys.active]?.length !== 32
    )
      throw Error("Billing encryption configuration required");
  }
  private encrypt(token: string, key: string) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.keys.values[this.keys.active], iv);
    c.setAAD(Buffer.from(`${this.environment}:${key}`));
    const data = Buffer.concat([c.update(token, "utf8"), c.final()]);
    return (
      this.keys.active +
      "." +
      Buffer.concat([iv, c.getAuthTag(), data]).toString("base64")
    );
  }
  private decrypt(value: string, key: string) {
    const [id, b64] = value.split(".");
    const k = this.keys.values[id];
    if (k?.length !== 32) throw Error("Receipt encryption key unavailable");
    const b = Buffer.from(b64, "base64"),
      c = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
    c.setAAD(Buffer.from(`${this.environment}:${key}`));
    c.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(
      "utf8",
    );
  }
  private async control(
    tx: Sql,
    scope?: "sales_enabled" | "issuance_enabled" | "transfers_enabled",
  ) {
    const [c] = await tx`select * from commercial_billing.lock_control()`;
    if (!c || c.environment !== this.environment)
      throw Error("Billing environment mismatch");
    if (scope) {
      assertCommercialApproval(
        c as Parameters<typeof assertCommercialApproval>[0],
        this.environment,
      );
      if (c[scope] !== true) throw Error("Commercial feature disabled");
    }
    return c;
  }
  private async accounts(tx: Sql, members: string[]) {
    for (const member of [...new Set(members)].sort()) {
      uuid.parse(member);
      await tx`insert into commercial_billing.accounts(member_id) values(${member}) on conflict do nothing`;
      await tx`select member_id from commercial_billing.accounts where member_id=${member} for update`;
    }
  }
  private async journal(
    tx: Sql,
    id: string,
    unit: "CREDITS" | "AUD_CENTS",
    actor: string,
    reason: string,
    receipt: string | null,
    lines: [string, number][],
  ) {
    if (
      lines.some(([, v]) => !Number.isSafeInteger(v)) ||
      lines.reduce((n, [, v]) => n + BigInt(v), 0n) !== 0n
    )
      throw Error("Unbalanced accounting operation");
    const inserted =
      await tx`insert into commercial_billing.journals(id,unit,actor,reason,receipt) values(${id},${unit},${actor},${reason},${receipt}) on conflict do nothing returning id`;
    if (!inserted.length) throw Error("Accounting operation already exists");
    let n = 0;
    for (const [account, amount] of lines)
      if (amount)
        await tx`insert into commercial_billing.lines values(${id},${n++},${account},${amount})`;
  }
  private async audit(
    tx: Sql,
    actor: string,
    action: string,
    reference: string,
    details: Record<string, unknown>,
  ) {
    await tx`insert into commercial_billing.audit(actor,action,reference,details) values(${actor},${action},${reference},${tx.json(details as never)})`;
  }
  private async noHold(tx: Sql, member: string) {
    const r =
      await tx`select id from commercial_billing.recovery_cases where member_id=${member} and state='OPEN' limit 1`;
    if (r.length)
      throw Error("Account review required before spending or purchasing");
  }
  async checkout(member: string, authorize: Authorize) {
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await this.control(tx, "sales_enabled");
      await authorize(tx, member);
      await this.noHold(tx, member);
      const products =
        await tx`select id,credits,aud_cents,version from commercial_billing.products where approved order by id`;
      return products
        .filter((p) =>
          commercialProducts.some(
            (c) =>
              c.id === p.id &&
              c.credits === integer(p.credits) &&
              c.audCents === integer(p.aud_cents) &&
              c.version === p.version,
          ),
        )
        .map((p) => ({
          id: p.id,
          credits: integer(p.credits),
          audCents: integer(p.aud_cents),
        }));
    });
  }
  async accept(
    r: CommercialReceipt,
    member: string,
    token: string,
    authorize: Authorize,
    newCheckout = true,
  ) {
    uuid.parse(member);
    if (
      r.environment !== this.environment ||
      !r.account ||
      r.key !==
        createHash("sha256")
          .update("docked.fantasy\0" + token)
          .digest("hex")
    )
      throw Error("Receipt environment or reference mismatch");
    const product = commercialProducts.find((p) => p.id === r.product.id);
    if (!product || digest(product) !== digest(r.product))
      throw Error("Unapproved credit allocation");
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await this.control(tx);
      await tx`select pg_advisory_xact_lock(hashtextextended(${r.key},512))`;
      const [old] =
        await tx`select * from commercial_billing.receipts where key=${r.key} for update`;
      if (
        old &&
        (old.member_id !== member ||
          old.account_binding !== r.account ||
          old.environment !== r.environment ||
          digest(old.product) !== digest(r.product))
      )
        throw Error("Receipt already bound to another account or product");
      await this.accounts(tx, [member]);
      await authorize(tx, member);
      if (!old) {
        if (!newCheckout)
          throw Error("Unbound notification cannot credit an account");
        await this.control(tx, "sales_enabled");
        await this.noHold(tx, member);
        const [p] =
          await tx`select * from commercial_billing.lock_product(${product.id})`;
        if (
          !p?.approved ||
          integer(p.credits) !== product.credits ||
          integer(p.aud_cents) !== product.audCents ||
          p.version !== product.version
        )
          throw Error("Product activation pending");
      }
      // Refund/revocation is terminal. Pending cannot replace a completed purchase.
      let state = r.state;
      if (
        old &&
        (["CANCELLED", "REVOKED"].includes(old.state) ||
          (old.state !== "PENDING" && state === "PENDING"))
      )
        state = old.state;
      if (old?.state === "REVIEW" && state === "PURCHASED") state = "REVIEW";
      const stale = Boolean(
        old?.provider_at &&
        r.providerAt &&
        new Date(r.providerAt) < new Date(old.provider_at),
      );
      const gross =
        old?.gross_cents != null ? integer(old.gross_cents) : r.grossCents;
      if (
        old?.gross_cents != null &&
        r.grossCents != null &&
        integer(old.gross_cents) !== r.grossCents
      )
        throw Error("Order amount changed; financial review required");
      const refunded = Math.max(
        integer(old?.refunded_cents ?? 0),
        r.refundedCents,
      );
      if (stale && refunded <= integer(old?.refunded_cents ?? 0))
        state = old.state;
      await tx`insert into commercial_billing.receipts(key,member_id,account_binding,environment,product,state,order_id,encrypted_reference,gross_cents,tax_cents,refunded_cents,provider_at)
        values(${r.key},${member},${r.account},${r.environment},${tx.json(r.product)},${state},${r.orderId},${this.encrypt(token, r.key)},${gross},${r.taxCents},${refunded},${r.providerAt})
        on conflict(key) do update set state=excluded.state,order_id=coalesce(commercial_billing.receipts.order_id,excluded.order_id),gross_cents=coalesce(commercial_billing.receipts.gross_cents,excluded.gross_cents),tax_cents=coalesce(commercial_billing.receipts.tax_cents,excluded.tax_cents),refunded_cents=excluded.refunded_cents,provider_at=greatest(commercial_billing.receipts.provider_at,excluded.provider_at),updated_at=clock_timestamp()`;
      const newObservation =
        await tx`insert into commercial_billing.receipt_events(receipt,state,fingerprint) values(${r.key},${r.state},${digest(r)}) on conflict do nothing returning id`;
      const charged =
        old?.money_recorded || (r.paid && gross !== null && gross > 0);
      if (charged && !old?.money_recorded) {
        await this.journal(
          tx,
          `${r.key}:charge`,
          "AUD_CENTS",
          "google-verifier",
          "Gross customer charge; provider settlement and fees unconfirmed",
          r.key,
          [
            ["provider:google:receivable", gross!],
            ["liability:unallocated-digital-value", -gross!],
          ],
        );
        await tx`update commercial_billing.receipts set money_recorded=true where key=${r.key}`;
      }
      if (state === "PURCHASED" && !old?.credited) {
        if (gross !== product.audCents || refunded)
          throw Error("Exact approved price and unrefunded order required");
        await tx`insert into commercial_billing.lots(member_id,receipt,source,original,remaining) values(${member},${r.key},${r.key},${product.credits},${product.credits})`;
        await this.journal(
          tx,
          `${r.key}:credit`,
          "CREDITS",
          "google-verifier",
          "Verified Google consumable credit fulfilment",
          r.key,
          [
            [`member:${member}`, product.credits],
            ["system:issued", -product.credits],
          ],
        );
        await tx`update commercial_billing.receipts set credited=true where key=${r.key}`;
      }
      const refundDelta = refunded - integer(old?.refunded_cents ?? 0);
      if (refundDelta && charged)
        await this.journal(
          tx,
          `${r.key}:refund:${refunded}`,
          "AUD_CENTS",
          "google-verifier",
          "Verified provider refund; not a new customer payment",
          r.key,
          [
            ["provider:google:receivable", -refundDelta],
            ["liability:refund-recovery", refundDelta],
          ],
        );
      if (["REVOKED", "CANCELLED", "REVIEW"].includes(state)) {
        const [lot] =
          await tx`select * from commercial_billing.lots where source=${r.key} for update`;
        let exposure = lot
          ? integer(lot.original) -
            integer(lot.remaining) -
            integer(lot.refund_removed)
          : 0;
        if (
          lot &&
          state === "REVOKED" &&
          refunded === gross &&
          integer(lot.remaining) > 0
        ) {
          const remaining = integer(lot.remaining);
          await this.journal(
            tx,
            `${r.key}:reverse-unspent`,
            "CREDITS",
            "google-verifier",
            "Reverse only unspent credits from the refunded purchase",
            r.key,
            [
              [`member:${member}`, -remaining],
              ["system:issued", remaining],
            ],
          );
          await tx`update commercial_billing.lots set remaining=0,refund_removed=refund_removed+${remaining} where id=${lot.id}`;
        }
        if (
          state === "REVIEW" ||
          (lot && (exposure > 0 || state === "CANCELLED"))
        ) {
          if (state === "REVIEW")
            exposure = lot
              ? integer(lot.original) - integer(lot.refund_removed)
              : 0;
          await tx`insert into commercial_billing.recovery_cases(id,receipt,member_id,exposure_credits,reason)
            values(${r.key},${r.key},${member},${exposure},${state === "REVIEW" ? (r.reviewReason === "account-unavailable" ? "Account unavailable; provider refund/remedy review required" : "Provider amount/partial-refund review") : "Refunded funding already used; no automatic debt or card confiscation"}) on conflict(receipt) do update set exposure_credits=excluded.exposure_credits,reason=excluded.reason,revision=commercial_billing.recovery_cases.revision+1 where commercial_billing.recovery_cases.state='OPEN' and (commercial_billing.recovery_cases.exposure_credits is distinct from excluded.exposure_credits or commercial_billing.recovery_cases.reason is distinct from excluded.reason)`;
        }
        if (state === "REVOKED" && exposure === 0) {
          // A prior partial-refund review remains an explicit support decision,
          // but its exposure and revision must reflect the completed reversal.
          await tx`update commercial_billing.recovery_cases set exposure_credits=0,reason='Completed refund; no spent-credit exposure; review release',revision=revision+1 where receipt=${r.key} and state='OPEN' and (exposure_credits<>0 or reason<>'Completed refund; no spent-credit exposure; review release')`;
        }
        await tx`update commercial_billing.jobs set state='done',lease=null,lease_until=null,completed_at=clock_timestamp() where id=${`consume:${r.key}`} and state<>'done'`;
      } else if (state === "PURCHASED")
        await tx`insert into commercial_billing.jobs(id,receipt,kind) values(${`consume:${r.key}`},${r.key},'consume') on conflict do nothing`;
      if (newObservation.length)
        await this.audit(tx, member, "provider-observation", r.key, {
          state,
          environment: r.environment,
          credited: Boolean(old?.credited || state === "PURCHASED"),
        });
      return { state, receipt: r.key };
    });
  }
  async reference(key: string) {
    const [r] = await this
      .sql`select key,member_id,account_binding,encrypted_reference,state,product,credited from commercial_billing.receipts where key=${key} and environment=${this.environment}`;
    return r
      ? {
          key: String(r.key),
          member_id: String(r.member_id),
          account_binding: String(r.account_binding),
          state: String(r.state),
          credited: r.credited === true,
          token: this.decrypt(r.encrypted_reference, key),
        }
      : null;
  }
  async wallet(member: string) {
    uuid.parse(member);
    const [r] = await this
      .sql`select coalesce(sum(remaining),0)::text available,exists(select 1 from commercial_billing.recovery_cases where member_id=${member} and state='OPEN') held from commercial_billing.lots where member_id=${member}`;
    const balance = integer(r.available);
    return {
      balance,
      spendable: r.held ? 0 : balance,
      held: r.held ? balance : 0,
      reviewRequired: r.held === true,
      withdrawable: 0,
      environment: this.environment,
    };
  }
  private async spend(
    tx: Sql,
    member: string,
    amount: number,
  ): Promise<Funding> {
    await this.noHold(tx, member);
    const lots =
      await tx`select * from commercial_billing.lots where member_id=${member} and remaining>0 order by created_at,id for update`;
    if (lots.reduce((s, l) => s + integer(l.remaining), 0) < amount)
      throw Error("Insufficient Docked Credits");
    let remaining = amount;
    const parts: Funding = [];
    for (const l of lots) {
      if (!remaining) break;
      const n = Math.min(remaining, integer(l.remaining));
      await tx`update commercial_billing.lots set remaining=remaining-${n} where id=${l.id}`;
      parts.push({ lot: l.id, receipt: l.receipt, amount: n });
      remaining -= n;
    }
    return parts;
  }
  async buyPack(
    member: string,
    request: string,
    input: {
      sport: CommercialSport;
      family: "STANDARD" | "PREMIUM";
      size: 1 | 3 | 9;
      configurationHash: string;
      confirmed: true;
    },
    authorize: Authorize,
  ) {
    uuid.parse(member);
    uuid.parse(request);
    if (input.confirmed !== true)
      throw Error("Explicit pack confirmation required");
    const p = commercialPack(input.sport, input.family, input.size);
    if (p.configurationHash !== input.configurationHash)
      throw Error("Pack quote changed; review again");
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const c = await this.control(tx, "issuance_enabled");
      await this.accounts(tx, [member]);
      await authorize(tx, member);
      const [prior] =
        await tx`select * from commercial_billing.packs where member_id=${member} and request=${request}`;
      if (prior) {
        if (prior.product.configurationHash !== p.configurationHash)
          throw Error("Purchase retry conflicts with original product");
        return { id: prior.id, price: integer(prior.price), cards: p.cards };
      }
      await this.noHold(tx, member);
      // Global deterministic definition lock order prevents oversold lifetime supply.
      const pool =
        await tx`select * from commercial_billing.definitions where sport=${p.sport} and approved order by id for update`;
      for (const d of pool) {
        const snapshot = commercialCardSnapshot.parse(d.snapshot);
        if (this.environment === "commercial" && snapshot.synthetic)
          throw Error("Synthetic cards cannot be commercial inventory");
        if (integer(d.lifetime_cap) !== rarityRule(d.rarity).lifetimeCap)
          throw Error("Approved lifetime supply mismatch");
      }
      const chosen: (typeof pool)[number][] = [];
      const players = new Set<string>();
      const evidence = [];
      for (let slot = 0; slot < p.cards; slot++) {
        const rarity = drawPackRarity(p, slot),
          eligible = pool.filter(
            (d) =>
              d.rarity === rarity &&
              integer(d.issued) < integer(d.lifetime_cap) &&
              !players.has(d.player_id),
          );
        if (!eligible.length)
          throw Error("Pack supply unavailable; no charge or substitution");
        const d = eligible[randomInt(eligible.length)];
        players.add(d.player_id);
        chosen.push(d);
        evidence.push({
          rarity,
          poolHash: digest(eligible.map((x) => x.id)),
          eligiblePlayers: eligible.length,
        });
      }
      const funding = await this.spend(tx, member, p.priceCredits),
        id = randomUUID();
      await tx`insert into commercial_billing.packs(id,member_id,request,product,price,funding,draw_evidence,policy_version) values(${id},${member},${request},${tx.json(p)},${p.priceCredits},${tx.json(funding)},${tx.json(evidence)},${c.policy_version})`;
      await this.journal(
        tx,
        `pack:${id}`,
        "CREDITS",
        member,
        "Confirmed pack purchase",
        null,
        [
          [`member:${member}`, -p.priceCredits],
          ["system:pack-consumed", p.priceCredits],
        ],
      );
      for (const [slot, d] of chosen.entries()) {
        const card = randomUUID();
        await tx`insert into commercial_billing.cards(id,definition,serial,owner_id,pack,slot) values(${card},${d.id},${integer(d.issued) + 1},${member},${id},${slot})`;
        await tx`insert into commercial_billing.ownership_events(card,to_member,reference) values(${card},${member},${`pack:${id}`})`;
      }
      await this.audit(tx, member, "pack-purchased", id, {
        product: p.id,
        cards: p.cards,
        price: p.priceCredits,
      });
      return { id, price: p.priceCredits, cards: p.cards };
    });
  }
  async openPack(member: string, id: string, authorize: Authorize) {
    uuid.parse(member);
    uuid.parse(id);
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await this.control(tx);
      await this.accounts(tx, [member]);
      await authorize(tx, member);
      const [pack] =
        await tx`select * from commercial_billing.packs where id=${id} and member_id=${member} for update`;
      if (!pack) throw Error("Pack not found");
      if (!pack.opened_at) {
        await this.noHold(tx, member);
        const [opened] =
          await tx`update commercial_billing.packs set opened_at=clock_timestamp() where id=${id} returning opened_at`;
        pack.opened_at = opened.opened_at;
        await this.audit(tx, member, "pack-opened", id, {
          cards: pack.product.cards,
        });
      }
      // Existing opened receipts stay readable after a hold or subsequent transfer.
      return {
        pack: id,
        openedAt: new Date(pack.opened_at).toISOString(),
        product: pack.product,
        cards:
          await tx`select c.id,c.definition,c.serial,d.player_id,d.sport,d.rarity,d.lifetime_cap,d.snapshot from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where c.pack=${id} order by c.slot`,
      };
    });
  }
  async list(
    member: string,
    card: string,
    price: number,
    authorize: Authorize,
  ) {
    uuid.parse(member);
    uuid.parse(card);
    sellerQuote(price);
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`select pg_advisory_xact_lock(71820342)`;
      await this.control(tx, "transfers_enabled");
      await this.accounts(tx, [member]);
      await authorize(tx, member);
      await this.noHold(tx, member);
      const [c] =
        await tx`select c.* from commercial_billing.cards c join commercial_billing.packs p on p.id=c.pack where c.id=${card} and c.owner_id=${member} and not c.locked and p.opened_at is not null for update of c`;
      if (!c) throw Error("Owned, opened, unlocked card required");
      const [listing] =
        await tx`insert into commercial_billing.listings(card,seller,price) values(${card},${member},${price}) returning id`;
      return listing;
    });
  }
  async buyListing(
    member: string,
    id: string,
    price: number,
    revision: number,
    authorize: Authorize,
  ) {
    uuid.parse(member);
    uuid.parse(id);
    sellerQuote(price);
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`select pg_advisory_xact_lock(71820342)`;
      await this.control(tx, "transfers_enabled");
      const [hint] =
        await tx`select seller from commercial_billing.listings where id=${id}`;
      if (!hint || hint.seller === member) throw Error("Listing unavailable");
      await this.accounts(tx, [member, hint.seller]);
      await authorize(tx, member);
      await this.noHold(tx, member);
      await this.noHold(tx, hint.seller);
      const [l] =
        await tx`select * from commercial_billing.listings where id=${id} for update`;
      if (l.state === "SOLD" && l.buyer === member)
        return {
          id,
          price: integer(l.price),
          fee: integer(l.fee),
          net: integer(l.net),
        };
      if (
        l.state !== "OPEN" ||
        integer(l.price) !== price ||
        l.revision !== revision
      )
        throw Error("Listing changed; review again");
      const [card] =
        await tx`select * from commercial_billing.cards where id=${l.card} and owner_id=${l.seller} and not locked for update`;
      if (!card) throw Error("Card unavailable");
      const quote = sellerQuote(price),
        funding = await this.spend(tx, member, price);
      let fee = quote.fee;
      for (const [n, part] of funding.entries()) {
        const removed = Math.min(fee, part.amount);
        fee -= removed;
        const amount = part.amount - removed;
        if (amount)
          await tx`insert into commercial_billing.lots(member_id,receipt,source,original,remaining) values(${l.seller},${part.receipt},${`sale:${id}:${n}`},${amount},${amount})`;
      }
      await this.journal(
        tx,
        `sale:${id}`,
        "CREDITS",
        member,
        "Credit-only card sale; seller fee policy preserved",
        null,
        [
          [`member:${member}`, -price],
          [`member:${l.seller}`, quote.net],
          ["system:sale-fees", quote.fee],
        ],
      );
      await tx`update commercial_billing.cards set owner_id=${member} where id=${l.card}`;
      await tx`insert into commercial_billing.ownership_events(card,from_member,to_member,reference) values(${l.card},${l.seller},${member},${`sale:${id}`})`;
      await tx`update commercial_billing.listings set state='SOLD',buyer=${member},fee=${quote.fee},net=${quote.net},sold_at=clock_timestamp(),funding=${tx.json(funding)} where id=${id}`;
      await this.audit(tx, member, "card-sale", id, {
        ...quote,
        seller: l.seller,
      });
      return { id, ...quote };
    });
  }
  async resolveRecovery(
    id: string,
    revision: number,
    reason: string,
    reviewer: string,
    authorizeReviewer: (tx: Sql) => Promise<void>,
  ) {
    if (
      !/^[a-f0-9]{64}$/.test(id) ||
      !Number.isInteger(revision) ||
      reason.trim().length < 12 ||
      reason.length > 600
    )
      throw Error("Recovery review details required");
    uuid.parse(reviewer);
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await this.control(tx);
      await authorizeReviewer(tx);
      const [hint] =
        await tx`select member_id from commercial_billing.recovery_cases where id=${id}`;
      if (!hint || hint.member_id === reviewer)
        throw Error("Independent reviewer required");
      await this.accounts(tx, [hint.member_id]);
      const [c] =
        await tx`select * from commercial_billing.recovery_cases where id=${id} for update`;
      if (c.revision !== revision || c.state !== "OPEN")
        throw Error("Review changed; reload case");
      const [receipt] =
        await tx`select state from commercial_billing.receipts where key=${c.receipt}`;
      if (receipt.state !== "REVOKED")
        throw Error(
          "Resolve provider/partial refund evidence before releasing a hold",
        );
      await tx`insert into commercial_billing.support_events(case_id,reviewer,expected_revision,reason,action) values(${id},${reviewer},${revision},${reason},'WAIVE_RECOVERY')`;
      await tx`update commercial_billing.recovery_cases set state='WAIVED',revision=revision+1 where id=${id}`;
      await this.audit(tx, reviewer, "recovery-waived", id, {
        revision,
        financialMutation: false,
      });
      return { state: "WAIVED" };
    });
  }
  async financialReport() {
    const [money] = await this
      .sql`select count(*) filter(where money_recorded)::int purchases,coalesce(sum(gross_cents) filter(where money_recorded),0)::text gross_cents,coalesce(sum(refunded_cents) filter(where money_recorded),0)::text refund_cents,count(*) filter(where state='REVIEW')::int review from commercial_billing.receipts`;
    const [credits] = await this
      .sql`select coalesce(sum(remaining),0)::text outstanding from commercial_billing.lots`;
    const [cases] = await this
      .sql`select count(*)::int open_cases,coalesce(sum(exposure_credits),0)::text exposure_credits from commercial_billing.recovery_cases where state='OPEN'`;
    return {
      environment: this.environment,
      ...money,
      outstandingCredits: integer(credits.outstanding),
      ...cases,
      providerPayoutReconciled: false,
      providerFees: null,
      recognizedRevenue: null,
    };
  }
}
