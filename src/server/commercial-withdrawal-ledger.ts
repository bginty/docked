import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { z } from "zod";
import { integer } from "../core/commercial-billing";
import {
  assertCashCommercialPolicy,
  assertWithdrawalAmount,
  assertWithdrawalPolicy,
  commercialWithdrawalDestinationSchema,
  commercialWithdrawalIdentitySchema,
  commercialWithdrawalMemberEnvelope,
  commercialWithdrawalOwnerEnvelope,
  CommercialWithdrawalRejected,
  withdrawalAudCents,
  withdrawalCreditQuantum,
  type CommercialWithdrawalIdentityEvidence,
  type CommercialWithdrawalPolicy,
} from "../core/commercial-withdrawals";
import { digest } from "../core/scoring-engine";
import { CommercialLedger } from "./commercial-ledger";

export type CommercialWithdrawalAccess = {
  requestsEnabled: boolean;
  paymentsEnabled: boolean;
  /** Verified current session, with live Owner + MFA check on staff entry points.
   * Set claims on this exact transaction before returning. */
  actor(tx: Sql): Promise<void>;
  /** Live account, Australian/age/phone/consent eligibility. Staff use the
   * dedicated target helper; social relationships do not confer authority. */
  member(tx: Sql, member: string): Promise<void>;
};
type Authorize = (tx: Sql) => Promise<void>;
type Row = Record<string, any>;
type Allocation = {
  lot: string;
  rootLot: string;
  receipt: string;
  funding: string;
  credits: number;
  cashCents: number;
};
const uuid = z.uuid();
const iso = (value: unknown) =>
  value ? new Date(value as string).toISOString() : null;
const message = (value: unknown) =>
  value instanceof Error ? value.message : "Withdrawals are unavailable.";
const json = (tx: Sql, value: unknown) => tx.json(value as never);

/** Manual EFT only. No method sends money, accepts client KYC approvals, turns
 * on a control or treats a gross store receipt as cash in Docked's bank. */
export class CommercialWithdrawalLedger extends CommercialLedger {
  private async event(
    tx: Sql,
    actor: string,
    action: string,
    details: Record<string, unknown>,
    withdrawal: string | null = null,
  ) {
    await tx`insert into commercial_billing.withdrawal_events(withdrawal,actor,action,details) values(${withdrawal},${actor},${action},${json(tx, details)})`;
  }

  private async posting(
    tx: Sql,
    id: string,
    unit: "CREDITS" | "AUD_CENTS",
    actor: string,
    reason: string,
    entries: [string, number][],
  ) {
    if (
      entries.some(([, amount]) => !Number.isSafeInteger(amount)) ||
      entries.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== 0n
    )
      throw Error("Unbalanced withdrawal journal");
    await tx`insert into commercial_billing.journals(id,unit,actor,reason) values(${id},${unit},${actor},${reason})`;
    for (const [n, [account, amount]] of entries
      .filter(([, amount]) => amount !== 0)
      .entries())
      await tx`insert into commercial_billing.lines(journal,n,account,amount) values(${id},${n},${account},${amount})`;
  }

  private async lock(tx: Sql, actor: string, authorize: Authorize) {
    uuid.parse(actor);
    await tx`select pg_advisory_xact_lock(71820342)`;
    await authorize(tx);
    await this.control(tx);
  }

  private async settings(tx: Sql) {
    const [control] =
      await tx`select * from commercial_billing.lock_withdrawal_control()`;
    if (!control)
      throw new CommercialWithdrawalRejected(
        "Withdrawal configuration is unavailable.",
      );
    const [p] =
      await tx`select policy from commercial_billing.withdrawal_policies where version=${control.policy_version ?? ""}`;
    return { control, policy: p?.policy ?? null };
  }

  private async activation(
    tx: Sql,
    scope: "requests" | "payments",
    access: CommercialWithdrawalAccess,
  ) {
    const { control, policy: raw } = await this.settings(tx);
    if (
      !(scope === "requests"
        ? access.requestsEnabled && control.requests_enabled
        : access.paymentsEnabled && control.payments_enabled)
    )
      throw new CommercialWithdrawalRejected(
        scope === "requests"
          ? "New withdrawal requests are currently unavailable."
          : "New bank payments are currently stopped.",
      );
    const billing = await this.control(tx);
    assertCashCommercialPolicy(
      billing as Parameters<typeof assertCashCommercialPolicy>[0],
      this.environment,
    );
    const policy = assertWithdrawalPolicy(raw, this.environment);
    if (billing.approvals.withdrawalPolicyVersion !== policy.version)
      throw new CommercialWithdrawalRejected(
        "Withdrawal policy does not match the approved commercial scope.",
      );
    return policy;
  }

  private async openAccount(tx: Sql, member: string) {
    const [installed] =
      await tx`select to_regprocedure('commercial_billing.withdrawal_account_closed(uuid)') is not null present`;
    if (!installed.present)
      throw new CommercialWithdrawalRejected(
        "Withdrawal account lifecycle is unavailable.",
      );
    const [closed] =
      await tx`select commercial_billing.withdrawal_account_closed(${member}::uuid) closed`;
    if (closed.closed)
      throw new CommercialWithdrawalRejected(
        "Account closure is pending; new withdrawal setup is unavailable.",
      );
  }

  private async currentIdentity(tx: Sql, member: string) {
    const [row] =
      await tx`select i.*, (select max(checked_at) from commercial_billing.withdrawal_identity_checks c where c.identity_id=i.id) checked_at from commercial_billing.withdrawal_identities i where i.member_id=${member} order by revision desc limit 1`;
    return row as Row | undefined;
  }

  private async eligibleIdentity(
    tx: Sql,
    member: string,
    policy: CommercialWithdrawalPolicy,
    expectedRevision?: number,
  ) {
    const row = await this.currentIdentity(tx, member);
    if (
      !row ||
      (expectedRevision !== undefined && row.revision !== expectedRevision)
    )
      throw new CommercialWithdrawalRejected(
        "Identity verification changed; review your current details.",
      );
    const e = commercialWithdrawalIdentitySchema.parse(row.evidence);
    if (
      e.status !== "approved" ||
      !e.adult ||
      e.country !== "AU" ||
      e.providerEnvironment !==
        (this.environment === "commercial" ? "production" : "acceptance") ||
      !row.checked_at ||
      Date.now() - new Date(row.checked_at).getTime() > policy.identityMaxAgeMs
    )
      throw new CommercialWithdrawalRejected(
        "Current verified adult Australian identity is required.",
      );
    return row;
  }

  private async writeIdentity(
    tx: Sql,
    member: string,
    input: unknown,
    eventId?: string,
  ) {
    const evidence = commercialWithdrawalIdentitySchema.parse(input);
    if (
      evidence.providerEnvironment !==
      (this.environment === "commercial" ? "production" : "acceptance")
    )
      throw new CommercialWithdrawalRejected(
        "Identity provider environment mismatch.",
      );
    const checked = Date.parse(evidence.checkedAt);
    if (checked > Date.now() + 60_000 || checked < Date.now() - 60_000)
      throw new CommercialWithdrawalRejected(
        "A fresh provider result is required.",
      );
    const [binding] =
      await tx`select * from commercial_billing.withdrawal_identity_bindings where member_id=${member}`;
    if (
      !binding ||
      (binding.provider_applicant_id &&
        binding.provider_applicant_id !== evidence.providerApplicantId)
    )
      throw new CommercialWithdrawalRejected(
        "Provider applicant does not match the member's identity binding.",
      );
    if (!binding.provider_applicant_id) {
      await this.openAccount(tx, member);
      // Link expiry limits opening the provider session. A review of an already
      // authorised enrollment can legitimately finish hours or days later.
      if (
        !(
          await tx`select id from commercial_billing.withdrawal_identity_sessions where member_id=${member} limit 1`
        ).length
      )
        throw new CommercialWithdrawalRejected(
          "Authenticated identity enrollment is required.",
        );
      await tx`update commercial_billing.withdrawal_identity_bindings set provider_applicant_id=${evidence.providerApplicantId} where member_id=${member}`;
    }
    // A fresh check must not invalidate the destination just because its check
    // timestamp changed. A changed provider decision/review/name must do so.
    const {
      checkedAt: _checkedAt,
      evidenceReference: _reference,
      ...substantive
    } = evidence;
    const fingerprint = digest(substantive),
      old = await this.currentIdentity(tx, member);
    let identity = old;
    if (!old || old.fingerprint !== fingerprint) {
      [identity] =
        await tx`insert into commercial_billing.withdrawal_identities(member_id,revision,fingerprint,evidence) values(${member},${(old?.revision ?? 0) + 1},${fingerprint},${json(tx, evidence)}) returning *`;
      await this.event(tx, member, "identity-provider-result", {
        identity: identity!.id,
        revision: identity!.revision,
        status: evidence.status,
      });
    }
    await tx`insert into commercial_billing.withdrawal_identity_checks(identity_id,checked_at,event_id) values(${identity!.id},${evidence.checkedAt},${eventId ?? null})`;
    return {
      revision: identity!.revision as number,
      status: evidence.status,
      id: identity!.id as string,
    };
  }

  async bindIdentitySession(
    member: string,
    input: { externalUserId: string; expiresAt: string },
    authorize: Authorize,
  ) {
    uuid.parse(member);
    const external = `docked:${this.environment}:${member}`;
    if (
      input.externalUserId !== external ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      Date.parse(input.expiresAt) <= Date.now() ||
      Date.parse(input.expiresAt) > Date.now() + 3_600_000
    )
      throw new CommercialWithdrawalRejected(
        "Invalid hosted identity session binding.",
      );
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      await this.control(tx);
      await this.accounts(tx, [member]);
      await this.openAccount(tx, member);
      await tx`insert into commercial_billing.withdrawal_identity_bindings(member_id,external_user_id,provider_environment) values(${member},${external},${this.environment === "commercial" ? "production" : "acceptance"}) on conflict do nothing`;
      const [binding] =
        await tx`select * from commercial_billing.withdrawal_identity_bindings where member_id=${member}`;
      if (
        binding.external_user_id !== external ||
        binding.provider_environment !==
          (this.environment === "commercial" ? "production" : "acceptance")
      )
        throw new CommercialWithdrawalRejected("Identity binding mismatch.");
      const [session] =
        await tx`insert into commercial_billing.withdrawal_identity_sessions(member_id,external_user_id,expires_at) values(${member},${external},${input.expiresAt}) returning id`;
      await this.event(tx, member, "identity-session-bound", {
        session: session.id,
        expiresAt: input.expiresAt,
      });
      return {
        id: session.id as string,
        externalUserId: external,
        providerApplicantId: binding.provider_applicant_id as string | null,
      };
    });
  }

  /** Only a trusted provider adapter may call this, never a browser payload. */
  async recordIdentity(
    member: string,
    evidence: CommercialWithdrawalIdentityEvidence,
    authorize: Authorize,
  ) {
    uuid.parse(member);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      await this.control(tx);
      await this.accounts(tx, [member]);
      return this.writeIdentity(tx, member, evidence);
    });
  }

  /** Serialize fresh provider fetch AND persistence per member, so delayed
   * webhook deliveries cannot overwrite a newer provider decision. */
  async refreshIdentity(
    member: string,
    options: { eventId?: string; expectedApplicantId?: string },
    fetchEvidence: (binding: {
      externalUserId: string;
      providerApplicantId: string | null;
    }) => Promise<CommercialWithdrawalIdentityEvidence>,
    authorize: Authorize,
  ) {
    uuid.parse(member);
    if (options.eventId) z.string().min(1).max(240).parse(options.eventId);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      await this.control(tx);
      await this.accounts(tx, [member]);
      const [binding] =
        await tx`select * from commercial_billing.withdrawal_identity_bindings where member_id=${member}`;
      if (
        !binding ||
        (options.expectedApplicantId &&
          binding.provider_applicant_id &&
          options.expectedApplicantId !== binding.provider_applicant_id)
      )
        throw new CommercialWithdrawalRejected(
          "Provider callback is not bound to this member.",
        );
      const eventId = options.eventId
        ? `${this.environment}:${digest({ member, eventId: options.eventId })}`
        : undefined;
      if (
        eventId &&
        (
          await tx`select id from commercial_billing.withdrawal_identity_checks where event_id=${eventId}`
        ).length
      ) {
        const current = await this.currentIdentity(tx, member);
        return {
          id: current!.id as string,
          revision: current!.revision as number,
          status: current!.evidence
            .status as CommercialWithdrawalIdentityEvidence["status"],
        };
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const evidence = await Promise.race([
          fetchEvidence({
            externalUserId: binding.external_user_id,
            providerApplicantId: binding.provider_applicant_id,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new CommercialWithdrawalRejected(
                    "Identity provider timed out; no verification was changed.",
                  ),
                ),
              8_000,
            );
          }),
        ]);
        if (
          options.expectedApplicantId &&
          evidence.providerApplicantId !== options.expectedApplicantId
        )
          throw new CommercialWithdrawalRejected(
            "Provider callback applicant mismatch.",
          );
        return await this.writeIdentity(tx, member, evidence, eventId);
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async recordDestination(
    member: string,
    input: unknown,
    authorize: Authorize,
  ) {
    uuid.parse(member);
    const d = commercialWithdrawalDestinationSchema.parse(input);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await authorize(tx);
      await this.control(tx);
      await this.accounts(tx, [member]);
      await this.openAccount(tx, member);
      const identity = await this.currentIdentity(tx, member);
      if (
        !identity ||
        identity.revision !== d.identityRevision ||
        identity.evidence.status !== "approved"
      )
        throw new CommercialWithdrawalRejected(
          "Verified current identity is required before adding a bank account.",
        );
      const hash = createHash("sha256").update(d.ciphertext).digest("hex");
      const [prior] =
        await tx`select * from commercial_billing.withdrawal_destinations where id=${d.id}`;
      if (prior) {
        if (
          prior.member_id !== member ||
          prior.identity_revision !== d.identityRevision ||
          prior.ciphertext_hash !== hash ||
          prior.mask !== d.mask
        )
          throw new CommercialWithdrawalRejected(
            "Destination reference was already used for different details.",
          );
      } else {
        await tx`insert into commercial_billing.withdrawal_destinations(id,member_id,identity_revision,ciphertext_hash,mask) values(${d.id},${member},${d.identityRevision},${hash},${d.mask})`;
        await tx`insert into commercial_billing.withdrawal_destination_payloads(destination,ciphertext,ciphertext_hash) values(${d.id},${d.ciphertext},${hash})`;
        await this.event(tx, member, "destination-added", {
          destination: d.id,
          identityRevision: d.identityRevision,
          mask: d.mask,
        });
      }
      return {
        id: d.id,
        mask: d.mask,
        identityRevision: d.identityRevision,
        verified: false,
      };
    });
  }

  private async latestBeneficiary(tx: Sql, destination: string) {
    const [v] =
      await tx`select * from commercial_billing.withdrawal_beneficiary_verifications where destination=${destination} order by created_at desc,id desc limit 1`;
    return v as Row | undefined;
  }

  private async lockReceipts(tx: Sql, member: string, withdrawal?: string) {
    const keys = withdrawal
      ? await tx`select distinct receipt from commercial_billing.withdrawal_allocations where withdrawal=${withdrawal} order by receipt`
      : await tx`select distinct receipt from commercial_billing.lots where member_id=${member} and remaining>0 order by receipt`;
    // Existing receipt acceptance/refund locks receipt before account. Preserve
    // that order, then lock the member before consuming any lot.
    for (const r of keys)
      await tx`select key from commercial_billing.receipts where key=${r.receipt} for update`;
    await this.accounts(tx, [member]);
    return keys.map((r) => r.receipt as string);
  }

  private async allocate(
    tx: Sql,
    member: string,
    policy: CommercialWithdrawalPolicy,
    wanted?: number,
    lockedReceipts?: string[],
  ) {
    const lots =
      await tx`select l.*,root.id root_lot from commercial_billing.lots l
      left join commercial_billing.withdrawal_compensation_lots c on c.lot=l.id
      join commercial_billing.lots root on root.id=coalesce(c.root_lot,l.id) and root.receipt=l.receipt
      join commercial_billing.listings s on split_part(root.source,':',2)=s.id::text
       and root.source~'^sale:[a-f0-9-]{36}:[0-9]+$' and s.seller=l.member_id and s.state='SOLD'
      join commercial_billing.receipts r on r.key=l.receipt
      where l.member_id=${member} and l.remaining>0 and r.state='PURCHASED' and r.credited and r.refunded_cents=0
       and r.environment=${this.environment}
       and not exists(select 1 from commercial_billing.recovery_cases rc where rc.receipt=r.key and rc.state='OPEN')
      order by l.created_at,l.id ${tx.unsafe(lockedReceipts ? "for update of l" : "")}`;
    const funds =
      await tx`select f.*, f.net_cash_cents-coalesce((select sum(a.cash_cents) from commercial_billing.withdrawal_allocations a join commercial_billing.withdrawals w on w.id=a.withdrawal where a.funding=f.id and w.status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT','RECONCILED')),0) available from commercial_billing.withdrawal_cash_funding f where f.available_at<=clock_timestamp() and not exists(select 1 from commercial_billing.withdrawal_funding_revocations v where v.funding=f.id) order by f.available_at,f.id`;
    const quantum = withdrawalCreditQuantum(policy),
      unitCents = withdrawalAudCents(quantum, policy);
    let remaining = wanted === undefined ? Number.MAX_SAFE_INTEGER : wanted;
    const allocations: Allocation[] = [];
    for (const lot of lots) {
      if (lockedReceipts && !lockedReceipts.includes(lot.receipt)) continue;
      let available = integer(lot.remaining);
      for (const fund of funds) {
        if (fund.receipt !== lot.receipt) continue;
        const units = Math.min(
          Math.floor(available / quantum),
          Math.floor(integer(fund.available) / unitCents),
          Math.floor(remaining / quantum),
        );
        if (!units) continue;
        const credits = units * quantum,
          cashCents = withdrawalAudCents(credits, policy);
        allocations.push({
          lot: lot.id,
          rootLot: lot.root_lot,
          receipt: lot.receipt,
          funding: fund.id,
          credits,
          cashCents,
        });
        available -= credits;
        remaining -= credits;
        fund.available = integer(fund.available) - cashCents;
        if (!remaining) break;
      }
      if (!remaining) break;
    }
    if (wanted !== undefined && remaining)
      throw new CommercialWithdrawalRejected(
        "Insufficient settled, cash-backed sale proceeds. Purchased or promotional credits cannot be withdrawn.",
      );
    return allocations;
  }

  private async checkSources(tx: Sql, row: Row) {
    const [bad] =
      await tx`select a.id from commercial_billing.withdrawal_allocations a
      join commercial_billing.receipts r on r.key=a.receipt
      join commercial_billing.withdrawal_cash_funding f on f.id=a.funding
      where a.withdrawal=${row.id} and (r.state<>'PURCHASED' or r.refunded_cents>0 or not r.credited or r.environment<>${this.environment}
       or exists(select 1 from commercial_billing.recovery_cases c where c.receipt=r.key and c.state='OPEN')
       or exists(select 1 from commercial_billing.withdrawal_funding_revocations v where v.funding=f.id)
       or f.available_at>clock_timestamp()
       or f.net_cash_cents<(select coalesce(sum(x.cash_cents),0) from commercial_billing.withdrawal_allocations x join commercial_billing.withdrawals w on w.id=x.withdrawal where x.funding=f.id and w.status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT','RECONCILED'))) limit 1`;
    if (bad)
      throw new CommercialWithdrawalRejected(
        "Withdrawal source funds require review before payment.",
      );
    const [totals] =
      await tx`select coalesce(sum(credits),0)::text credits,coalesce(sum(cash_cents),0)::text cents from commercial_billing.withdrawal_allocations where withdrawal=${row.id}`;
    if (
      integer(totals.credits) !== integer(row.credits) ||
      integer(totals.cents) !== integer(row.gross_aud_cents)
    )
      throw Error("Withdrawal allocation mismatch");
    await this.noHold(tx, row.member_id);
  }

  private present(row: Row) {
    return {
      id: row.id as string,
      memberId: row.member_id as string,
      status: row.status as string,
      revision: row.revision as number,
      credits: integer(row.credits),
      grossAudCents: integer(row.gross_aud_cents),
      feeCents: integer(row.fee_cents),
      audCents: integer(row.aud_cents),
      policyVersion: row.policy_version as string,
      identityRevision: row.identity_revision as number,
      destination: row.destination as string,
      destinationMask: row.destination_snapshot.mask as string,
      claimedBy: row.claimed_by as string | null,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      claimedAt: iso(row.claimed_at),
      sentAt: iso(row.sent_at),
      reconciledAt: iso(row.reconciled_at),
      returnedAt: iso(row.returned_at),
    };
  }

  private async replay(
    tx: Sql,
    actor: string,
    request: string,
    command: unknown,
  ) {
    const [r] =
      await tx`select * from commercial_billing.withdrawal_commands where actor=${actor} and request=${request}`;
    if (r && r.command_digest !== digest(command))
      throw new CommercialWithdrawalRejected(
        "Request reference already used for different withdrawal details.",
      );
    return r?.result as Record<string, any> | undefined;
  }

  private async saveCommand(
    tx: Sql,
    actor: string,
    request: string,
    command: unknown,
    result: unknown,
  ) {
    await tx`insert into commercial_billing.withdrawal_commands(actor,request,command_digest,result) values(${actor},${request},${digest(command)},${json(tx, result)})`;
  }

  async memberCommand(
    member: string,
    input: unknown,
    access: CommercialWithdrawalAccess,
  ) {
    const { request, command } =
      commercialWithdrawalMemberEnvelope.parse(input);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await this.lock(tx, member, access.actor);
      const replay = await this.replay(tx, member, request, command);
      if (replay) return replay;
      let row: Row;
      if (command.kind === "request") {
        const policy = await this.activation(tx, "requests", access);
        if (policy.version !== command.policyVersion)
          throw new CommercialWithdrawalRejected(
            "Withdrawal terms changed; review the current policy.",
          );
        await access.member(tx, member);
        const receipts = await this.lockReceipts(tx, member);
        await this.openAccount(tx, member);
        await this.noHold(tx, member);
        const identity = await this.eligibleIdentity(
          tx,
          member,
          policy,
          command.identityRevision,
        );
        const [d] =
          await tx`select d.*,p.ciphertext from commercial_billing.withdrawal_destinations d join commercial_billing.withdrawal_destination_payloads p on p.destination=d.id where d.id=${command.destination} and d.member_id=${member}`;
        if (!d || !d.ciphertext || d.identity_revision !== identity.revision)
          throw new CommercialWithdrawalRejected(
            "Bank destination does not match this verified member.",
          );
        const gross = assertWithdrawalAmount(command.credits, policy);
        const [daily] =
          await tx`select coalesce(sum(credits),0)::text credits from commercial_billing.withdrawals where member_id=${member} and created_at>clock_timestamp()-interval '24 hours' and status not in('CANCELLED','REJECTED','RELEASED')`;
        if (
          integer(daily.credits) + command.credits >
          policy.dailyMaximumCredits
        )
          throw new CommercialWithdrawalRejected(
            "Rolling 24-hour withdrawal limit reached.",
          );
        const allocations = await this.allocate(
          tx,
          member,
          policy,
          command.credits,
          receipts,
        );
        [row] =
          await tx`insert into commercial_billing.withdrawals(member_id,credits,gross_aud_cents,fee_cents,aud_cents,policy_version,policy_snapshot,identity_id,identity_revision,destination,destination_snapshot)
          values(${member},${command.credits},${gross},${policy.feeCents},${gross - policy.feeCents},${policy.version},${json(tx, policy)},${identity.id},${identity.revision},${d.id},${json(tx, { id: d.id, mask: d.mask, identityRevision: d.identity_revision, ciphertextHash: d.ciphertext_hash })}) returning *`;
        for (const a of allocations) {
          const changed =
            await tx`update commercial_billing.lots set remaining=remaining-${a.credits} where id=${a.lot} and remaining>=${a.credits} returning id`;
          if (changed.length !== 1)
            throw Error("Withdrawal source balance changed");
          await tx`insert into commercial_billing.withdrawal_allocations(withdrawal,lot,root_lot,receipt,funding,credits,cash_cents) values(${row.id},${a.lot},${a.rootLot},${a.receipt},${a.funding},${a.credits},${a.cashCents})`;
        }
        await this.posting(
          tx,
          `withdrawal:${row.id}:reserve`,
          "CREDITS",
          member,
          "Reserve cash-backed sale proceeds for manual EFT",
          [
            [`member:${member}`, -command.credits],
            [`withdrawal:${row.id}:reserved`, command.credits],
          ],
        );
        await this.event(
          tx,
          member,
          "requested",
          {
            credits: command.credits,
            grossAudCents: gross,
            feeCents: policy.feeCents,
            policy: policy.version,
          },
          row.id,
        );
      } else {
        [row] =
          await tx`select * from commercial_billing.withdrawals where id=${command.id} and member_id=${member} for update`;
        if (!row || row.revision !== command.expectedRevision)
          throw new CommercialWithdrawalRejected(
            "Withdrawal changed; refresh its current status.",
          );
        if (!["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(row.status))
          throw new CommercialWithdrawalRejected(
            "Payment processing has started; cancellation requires bank-status review.",
          );
        await this.lockReceipts(tx, member, row.id);
        row = await this.release(
          tx,
          row,
          member,
          "CANCELLED",
          "Member cancelled before payment processing",
        );
      }
      const result = this.present(row);
      await this.saveCommand(tx, member, request, command, result);
      return result;
    });
  }

  private async release(
    tx: Sql,
    row: Row,
    actor: string,
    status: "CANCELLED" | "REJECTED" | "RELEASED" | "RETURNED",
    reason: string,
    evidenceReference?: string,
    bankReference?: string,
  ) {
    if (status === "RETURNED")
      await tx`insert into commercial_billing.withdrawal_bank_references(reference,kind,related_id) values(${bankReference!},'RETURNED',${row.id})`;
    const allocations =
      await tx`select * from commercial_billing.withdrawal_allocations where withdrawal=${row.id} order by id`;
    for (const a of allocations) {
      const lot = randomUUID();
      await tx`insert into commercial_billing.lots(id,member_id,receipt,source,original,remaining) values(${lot},${row.member_id},${a.receipt},${`withdrawal-release:${row.id}:${a.id}`},${a.credits},${a.credits})`;
      await tx`insert into commercial_billing.withdrawal_compensation_lots(lot,allocation,root_lot,reason) values(${lot},${a.id},${a.root_lot},${status})`;
    }
    await this.posting(
      tx,
      `withdrawal:${row.id}:${status.toLowerCase()}`,
      "CREDITS",
      actor,
      "Restore original source-linked credits; original lots remain immutable",
      [
        [
          status === "RETURNED"
            ? "system:withdrawal-redeemed"
            : `withdrawal:${row.id}:reserved`,
          -integer(row.credits),
        ],
        [`member:${row.member_id}`, integer(row.credits)],
      ],
    );
    if (status === "RETURNED")
      await this.posting(
        tx,
        `withdrawal:${row.id}:bank-return`,
        "AUD_CENTS",
        actor,
        "Confirmed bank return; reverse payout and allocated fee",
        [
          ["system:withdrawal-paid", -integer(row.aud_cents)],
          ["system:withdrawal-fees", -integer(row.fee_cents)],
          ["system:withdrawal-backing", integer(row.gross_aud_cents)],
        ],
      );
    const [updated] =
      await tx`update commercial_billing.withdrawals set status=${status},revision=revision+1,updated_at=clock_timestamp(),return_reference=${bankReference ?? null},returned_at=${status === "RETURNED" ? new Date() : null} where id=${row.id} returning *`;
    await this.event(
      tx,
      actor,
      status.toLowerCase(),
      {
        reason,
        evidenceReference: evidenceReference ?? null,
        bankReference: bankReference ?? null,
      },
      row.id,
    );
    return updated;
  }

  async ownerCommand(
    owner: string,
    input: unknown,
    access: CommercialWithdrawalAccess,
  ) {
    const { request, command } = commercialWithdrawalOwnerEnvelope.parse(input);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await this.lock(tx, owner, access.actor);
      const replay = await this.replay(tx, owner, request, command);
      if (replay) return replay;
      let result: Record<string, any>;
      if (command.kind === "stop") {
        await tx`select commercial_billing.stop_withdrawals(${owner}::uuid,${command.reason})`;
        result = { requestsEnabled: false, paymentsEnabled: false };
      } else if (command.kind === "verify-destination") {
        const [d] =
          await tx`select d.*,p.ciphertext from commercial_billing.withdrawal_destinations d join commercial_billing.withdrawal_destination_payloads p on p.destination=d.id where d.id=${command.destination}`;
        if (!d)
          throw new CommercialWithdrawalRejected("Destination unavailable.");
        const identity = await this.currentIdentity(tx, d.member_id);
        if (
          command.verified &&
          (!d.ciphertext ||
            !identity ||
            identity.revision !== d.identity_revision ||
            identity.revision !== command.identityRevision ||
            identity.evidence.status !== "approved")
        )
          throw new CommercialWithdrawalRejected(
            "Bank ownership review requires the member's current verified identity.",
          );
        if (command.identityRevision !== d.identity_revision)
          throw new CommercialWithdrawalRejected(
            "Destination identity revision changed.",
          );
        const [v] =
          await tx`insert into commercial_billing.withdrawal_beneficiary_verifications(destination,identity_revision,verified,reviewer,evidence_reference,reason) values(${d.id},${d.identity_revision},${command.verified},${owner},${command.evidenceReference},${command.reason}) returning id`;
        await this.event(tx, owner, "beneficiary-reviewed", {
          destination: d.id,
          verification: v.id,
          verified: command.verified,
          evidenceReference: command.evidenceReference,
          reason: command.reason,
        });
        result = {
          destination: d.id,
          verification: v.id,
          verified: command.verified,
        };
      } else if (command.kind === "record-funding") {
        if (
          Date.parse(command.settledAt) > Date.now() ||
          Date.parse(command.availableAt) < Date.parse(command.settledAt)
        )
          throw new CommercialWithdrawalRejected(
            "Bank funding requires an actual past settlement and valid availability date.",
          );
        const [receipt] =
          await tx`select * from commercial_billing.receipts where key=${command.receipt} for update`;
        if (
          !receipt ||
          receipt.environment !== this.environment ||
          receipt.state !== "PURCHASED" ||
          integer(receipt.refunded_cents) !== 0 ||
          !receipt.credited
        )
          throw new CommercialWithdrawalRejected(
            "Receipt is not eligible for reconciled cash backing.",
          );
        const [funding] =
          await tx`insert into commercial_billing.withdrawal_cash_funding(receipt,net_cash_cents,bank_reference,evidence_reference,settled_at,available_at,recorded_by) values(${command.receipt},${command.netCashCents},${command.bankReference},${command.evidenceReference},${command.settledAt},${command.availableAt},${owner}) returning id`;
        await tx`insert into commercial_billing.withdrawal_bank_references(reference,kind,related_id) values(${command.bankReference},'FUNDING',${funding.id})`;
        await this.posting(
          tx,
          `withdrawal-funding:${funding.id}`,
          "AUD_CENTS",
          owner,
          "Documented net bank settlement allocated to withdrawal backing",
          [
            ["system:withdrawal-backing", command.netCashCents],
            ["system:withdrawal-backing-evidence", -command.netCashCents],
          ],
        );
        await this.event(tx, owner, "cash-backing-recorded", {
          funding: funding.id,
          receipt: command.receipt,
          netCashCents: command.netCashCents,
          evidenceReference: command.evidenceReference,
        });
        result = { funding: funding.id, netCashCents: command.netCashCents };
      } else if (command.kind === "revoke-funding") {
        const [funding] =
          await tx`select * from commercial_billing.withdrawal_cash_funding where id=${command.funding}`;
        if (!funding)
          throw new CommercialWithdrawalRejected("Funding record unavailable.");
        await tx`insert into commercial_billing.withdrawal_funding_revocations(funding,reviewer,evidence_reference,reason) values(${command.funding},${owner},${command.evidenceReference},${command.reason})`;
        await this.posting(
          tx,
          `withdrawal-funding:${command.funding}:revoke`,
          "AUD_CENTS",
          owner,
          "Reverse backing evidence without rewriting payments already recorded",
          [
            ["system:withdrawal-backing", -integer(funding.net_cash_cents)],
            [
              "system:withdrawal-backing-evidence",
              integer(funding.net_cash_cents),
            ],
          ],
        );
        await this.event(tx, owner, "cash-backing-revoked", {
          funding: command.funding,
          evidenceReference: command.evidenceReference,
          reason: command.reason,
        });
        result = { funding: command.funding, revoked: true };
      } else if (command.kind === "resolve-exposure") {
        const [allocation] =
          await tx`select a.*,commercial_billing.withdrawal_source_version(a.id) source_version from commercial_billing.withdrawal_allocations a join commercial_billing.receipts r on r.key=a.receipt where a.id=${command.allocation} and (r.state<>'PURCHASED' or r.refunded_cents>0 or exists(select 1 from commercial_billing.recovery_cases c where c.receipt=r.key and c.state='OPEN') or exists(select 1 from commercial_billing.withdrawal_funding_revocations v where v.funding=a.funding))`;
        if (!allocation)
          throw new CommercialWithdrawalRejected(
            "Source exposure unavailable.",
          );
        await tx`insert into commercial_billing.withdrawal_exposure_resolutions(allocation,source_version,reviewer,evidence_reference,reason) values(${command.allocation},${allocation.source_version},${owner},${command.evidenceReference},${command.reason})`;
        await this.event(
          tx,
          owner,
          "source-exposure-resolved",
          {
            allocation: command.allocation,
            sourceVersion: allocation.source_version,
            evidenceReference: command.evidenceReference,
            reason: command.reason,
          },
          allocation.withdrawal,
        );
        result = { allocation: command.allocation, resolved: true };
      } else {
        const [hint] =
          await tx`select * from commercial_billing.withdrawals where id=${command.id}`;
        if (!hint)
          throw new CommercialWithdrawalRejected("Withdrawal unavailable.");
        // Releases insert replacement lots with receipt foreign keys. Lock
        // source receipts before the member for every transition, including
        // cancellation/return, to avoid reversing refund worker lock order.
        await this.lockReceipts(tx, hint.member_id, hint.id);
        let [row] =
          await tx`select * from commercial_billing.withdrawals where id=${command.id} for update`;
        if (row.revision !== command.expectedRevision)
          throw new CommercialWithdrawalRejected(
            "Withdrawal changed; refresh its current status.",
          );
        if (command.kind === "review") {
          if (!["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(row.status))
            throw new CommercialWithdrawalRejected(
              "Withdrawal is no longer awaiting review.",
            );
          if (command.decision === "reject")
            row = await this.release(
              tx,
              row,
              owner,
              "REJECTED",
              command.reason,
            );
          else {
            if (
              row.status === "APPROVED" ||
              (row.status === "UNDER_REVIEW" && command.decision === "start")
            )
              throw new CommercialWithdrawalRejected(
                "Review stage already completed.",
              );
            let verification: string | null = null;
            if (command.decision === "approve") {
              const policy = await this.activation(tx, "payments", access);
              if (row.policy_version !== policy.version)
                throw new CommercialWithdrawalRejected(
                  "Reserved withdrawal uses an earlier policy; reject it for a fresh review.",
                );
              await access.member(tx, row.member_id);
              await this.openAccount(tx, row.member_id);
              await this.eligibleIdentity(
                tx,
                row.member_id,
                policy,
                row.identity_revision,
              );
              const beneficiary = await this.latestBeneficiary(
                tx,
                row.destination,
              );
              if (
                !beneficiary?.verified ||
                beneficiary.identity_revision !== row.identity_revision
              )
                throw new CommercialWithdrawalRejected(
                  "Documented bank account ownership verification is required.",
                );
              await this.checkSources(tx, row);
              verification = beneficiary.id;
            }
            [row] =
              await tx`update commercial_billing.withdrawals set status=${command.decision === "approve" ? "APPROVED" : "UNDER_REVIEW"},beneficiary_verification=${verification},revision=revision+1,updated_at=clock_timestamp() where id=${row.id} returning *`;
            await this.event(
              tx,
              owner,
              command.decision === "approve" ? "approved" : "review-started",
              { reason: command.reason, beneficiaryVerification: verification },
              row.id,
            );
          }
        } else if (command.kind === "claim") {
          if (row.status !== "APPROVED")
            throw new CommercialWithdrawalRejected(
              "Withdrawal is not approved for payment.",
            );
          const policy = await this.activation(tx, "payments", access);
          if (row.policy_version !== policy.version)
            throw new CommercialWithdrawalRejected(
              "Withdrawal policy changed before payment.",
            );
          await access.member(tx, row.member_id);
          await this.openAccount(tx, row.member_id);
          await this.eligibleIdentity(
            tx,
            row.member_id,
            policy,
            row.identity_revision,
          );
          const beneficiary = await this.latestBeneficiary(tx, row.destination);
          if (
            !beneficiary?.verified ||
            beneficiary.id !== row.beneficiary_verification ||
            beneficiary.identity_revision !== row.identity_revision
          )
            throw new CommercialWithdrawalRejected(
              "Bank account verification changed before payment.",
            );
          await this.checkSources(tx, row);
          [row] =
            await tx`update commercial_billing.withdrawals set status='PAYMENT_IN_PROGRESS',claimed_by=${owner},claimed_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=${row.id} returning *`;
          await this.event(
            tx,
            owner,
            "payment-claimed",
            { beneficiaryVerification: beneficiary.id },
            row.id,
          );
        } else if (command.kind === "exception") {
          if (row.status !== "PAYMENT_IN_PROGRESS")
            throw new CommercialWithdrawalRejected(
              "Only a claimed payment can enter bank-status exception.",
            );
          [row] =
            await tx`update commercial_billing.withdrawals set status='EXCEPTION',revision=revision+1,updated_at=clock_timestamp() where id=${row.id} returning *`;
          await this.event(
            tx,
            owner,
            "payment-exception",
            { reason: command.reason },
            row.id,
          );
        } else if (command.kind === "record-sent") {
          if (
            !["PAYMENT_IN_PROGRESS", "EXCEPTION"].includes(row.status) ||
            row.claimed_by !== owner
          )
            throw new CommercialWithdrawalRejected(
              "Only the original claimant may record this manual bank payment.",
            );
          await tx`insert into commercial_billing.withdrawal_bank_references(reference,kind,related_id) values(${command.bankReference},'SENT',${row.id})`;
          await this.posting(
            tx,
            `withdrawal:${row.id}:redeem`,
            "CREDITS",
            owner,
            "Confirmed manual EFT consumes reserved credits",
            [
              [`withdrawal:${row.id}:reserved`, -integer(row.credits)],
              ["system:withdrawal-redeemed", integer(row.credits)],
            ],
          );
          await this.posting(
            tx,
            `withdrawal:${row.id}:sent`,
            "AUD_CENTS",
            owner,
            "Record confirmed manual EFT and published withdrawal fee",
            [
              ["system:withdrawal-backing", -integer(row.gross_aud_cents)],
              ["system:withdrawal-paid", integer(row.aud_cents)],
              ["system:withdrawal-fees", integer(row.fee_cents)],
            ],
          );
          [row] =
            await tx`update commercial_billing.withdrawals set status='SENT',bank_reference=${command.bankReference},sent_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=${row.id} returning *`;
          await this.event(
            tx,
            owner,
            "payment-recorded-sent",
            {
              bankReference: command.bankReference,
              evidenceReference: command.evidenceReference,
            },
            row.id,
          );
        } else if (command.kind === "reconcile") {
          if (row.status !== "SENT")
            throw new CommercialWithdrawalRejected(
              "Only a sent payment can be reconciled to its bank statement.",
            );
          [row] =
            await tx`update commercial_billing.withdrawals set status='RECONCILED',reconciled_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=${row.id} returning *`;
          await this.event(
            tx,
            owner,
            "bank-payment-reconciled",
            { evidenceReference: command.evidenceReference },
            row.id,
          );
        } else if (command.kind === "release-unpaid") {
          if (row.status !== "EXCEPTION")
            throw new CommercialWithdrawalRejected(
              "Confirmed-unpaid release requires a documented payment exception.",
            );
          row = await this.release(
            tx,
            row,
            owner,
            "RELEASED",
            command.reason,
            command.evidenceReference,
          );
        } else if (command.kind === "returned") {
          if (!["SENT", "RECONCILED"].includes(row.status))
            throw new CommercialWithdrawalRejected(
              "Only a sent bank payment can be returned.",
            );
          row = await this.release(
            tx,
            row,
            owner,
            "RETURNED",
            command.reason,
            command.evidenceReference,
            command.bankReference,
          );
        }
        result = this.present(row);
      }
      await this.saveCommand(tx, owner, request, command, result);
      return result;
    });
  }

  async revealDestination(
    owner: string,
    destination: string,
    reason: string,
    access: CommercialWithdrawalAccess,
  ) {
    uuid.parse(destination);
    z.string().trim().min(12).max(600).parse(reason);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await this.lock(tx, owner, access.actor);
      const [d] =
        await tx`select d.*,p.ciphertext from commercial_billing.withdrawal_destinations d join commercial_billing.withdrawal_destination_payloads p on p.destination=d.id where d.id=${destination}`;
      if (!d?.ciphertext)
        throw new CommercialWithdrawalRejected("Bank payload is unavailable.");
      await this.event(tx, owner, "bank-destination-revealed-for-review", {
        destination,
        reason,
      });
      return {
        ciphertext: d.ciphertext as string,
        snapshot: {
          id: d.id as string,
          memberId: d.member_id as string,
          identityRevision: d.identity_revision as number,
          mask: d.mask as string,
          ciphertextHash: d.ciphertext_hash as string,
        },
      };
    });
  }

  async revealPayment(
    owner: string,
    withdrawal: string,
    reason: string,
    access: CommercialWithdrawalAccess,
  ) {
    uuid.parse(withdrawal);
    z.string().trim().min(12).max(600).parse(reason);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await this.lock(tx, owner, access.actor);
      const [w] =
        await tx`select w.*,p.ciphertext,p.ciphertext_hash from commercial_billing.withdrawals w join commercial_billing.withdrawal_destination_payloads p on p.destination=w.destination where w.id=${withdrawal}`;
      if (
        !w?.ciphertext ||
        w.claimed_by !== owner ||
        !["PAYMENT_IN_PROGRESS", "EXCEPTION"].includes(w.status) ||
        w.destination_snapshot.ciphertextHash !== w.ciphertext_hash
      )
        throw new CommercialWithdrawalRejected(
          "Only the current payment claimant may reveal this frozen bank destination.",
        );
      await this.event(
        tx,
        owner,
        "bank-destination-revealed-for-payment",
        { reason },
        withdrawal,
      );
      return {
        ciphertext: w.ciphertext as string,
        snapshot: w.destination_snapshot as {
          id: string;
          mask: string;
          identityRevision: number;
          ciphertextHash: string;
        },
        withdrawal: this.present(w),
      };
    });
  }

  private publicPolicy(policy: CommercialWithdrawalPolicy | null) {
    if (!policy) return null;
    return {
      version: policy.version,
      currency: policy.currency,
      eligibleSource: policy.eligibleSource,
      rate: policy.rate,
      minimumCredits: policy.minimumCredits,
      maximumCredits: policy.maximumCredits,
      dailyMaximumCredits: policy.dailyMaximumCredits,
      feeCents: policy.feeCents,
    };
  }

  async memberView(member: string, access: CommercialWithdrawalAccess) {
    uuid.parse(member);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await access.actor(tx);
      await this.control(tx);
      let enabled = false,
        reason: string | null = null,
        policy: CommercialWithdrawalPolicy | null = null;
      try {
        policy = await this.activation(tx, "requests", access);
        enabled = true;
      } catch (error) {
        reason = message(error);
      }
      const identity = await this.currentIdentity(tx, member);
      const destinations =
        await tx`select d.id,d.mask,d.identity_revision,(select v.verified from commercial_billing.withdrawal_beneficiary_verifications v where v.destination=d.id order by v.created_at desc,v.id desc limit 1) verified from commercial_billing.withdrawal_destinations d where d.member_id=${member} order by d.created_at desc limit 30`;
      const requests =
        await tx`select * from commercial_billing.withdrawals where member_id=${member} order by created_at desc,id desc limit 100`;
      const [balance] =
        await tx`select coalesce(sum(remaining),0)::text amount from commercial_billing.lots where member_id=${member}`;
      const [pending] =
        await tx`select coalesce(sum(credits),0)::text amount from commercial_billing.withdrawals where member_id=${member} and status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION')`;
      let eligible = 0;
      if (policy) {
        const allocations = await this.allocate(tx, member, policy);
        eligible = allocations.reduce((sum, a) => sum + a.credits, 0);
      }
      const [held] =
        await tx`select commercial_billing.withdrawal_member_held(${member}::uuid) or exists(select 1 from commercial_billing.recovery_cases where member_id=${member} and state='OPEN') held`;
      if (held.held) {
        eligible = 0;
        reason = "Account funds require financial review.";
        enabled = false;
      }
      return {
        enabled,
        reason,
        policy: this.publicPolicy(policy),
        money: {
          balance: integer(balance.amount),
          available: held.held ? 0 : integer(balance.amount),
          eligible,
          pending: integer(pending.amount),
        },
        identity: identity
          ? {
              revision: identity.revision as number,
              status: identity.evidence.status as string,
              checkedAt: iso(identity.checked_at),
            }
          : null,
        destinations: destinations.map((d) => ({
          id: d.id as string,
          mask: d.mask as string,
          identityRevision: d.identity_revision as number,
          verified: d.verified === true,
        })),
        requests: requests.map((r) => this.present(r)),
      };
    });
  }

  async ownerView(
    owner: string,
    access: CommercialWithdrawalAccess,
    options: { request?: string } = {},
  ) {
    uuid.parse(owner);
    const filter =
      options.request === undefined ? null : uuid.parse(options.request);
    return this.sql.begin(async (raw) => {
      const tx = raw as unknown as Sql;
      await access.actor(tx);
      await this.control(tx);
      const { control, policy } = await this.settings(tx);
      let requestsEnabled = false,
        paymentsEnabled = false,
        reason: string | null = null;
      try {
        await this.activation(tx, "requests", access);
        requestsEnabled = true;
      } catch (error) {
        reason = message(error);
      }
      try {
        await this.activation(tx, "payments", access);
        paymentsEnabled = true;
      } catch (error) {
        reason ??= message(error);
      }
      const requests =
        await tx`select * from commercial_billing.withdrawals where (${filter}::uuid is null or id=${filter}::uuid) order by (status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT')) desc,case when status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT') then created_at end asc,created_at desc,id desc limit 200`;
      const [counts] =
        await tx`select count(*)::text total,count(*) filter(where status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT'))::text open from commercial_billing.withdrawals`;
      const destinations =
        await tx`select d.id,d.member_id,d.mask,d.identity_revision,i.revision current_identity_revision,i.evidence->>'status' current_identity_status,v.verified,v.evidence_reference
        from commercial_billing.withdrawal_destinations d
        left join lateral(select revision,evidence from commercial_billing.withdrawal_identities where member_id=d.member_id order by revision desc limit 1)i on true
        left join lateral(select verified,evidence_reference from commercial_billing.withdrawal_beneficiary_verifications where destination=d.id order by created_at desc,id desc limit 1)v on true
        where (${filter}::uuid is null or d.id=(select destination from commercial_billing.withdrawals where id=${filter}::uuid))
        order by d.created_at desc,d.id limit 200`;
      const exposures =
        await tx`select a.id,a.withdrawal,w.member_id,a.receipt,a.credits,a.cash_cents,r.state,r.refunded_cents from commercial_billing.withdrawal_allocations a join commercial_billing.withdrawals w on w.id=a.withdrawal join commercial_billing.receipts r on r.key=a.receipt where (${filter}::uuid is null or w.id=${filter}::uuid) and (r.state<>'PURCHASED' or r.refunded_cents>0 or exists(select 1 from commercial_billing.recovery_cases c where c.receipt=r.key and c.state='OPEN') or exists(select 1 from commercial_billing.withdrawal_funding_revocations v where v.funding=a.funding)) and not exists(select 1 from commercial_billing.withdrawal_exposure_resolutions x where x.allocation=a.id and x.source_version=commercial_billing.withdrawal_source_version(a.id)) order by a.created_at limit 200`;
      return {
        requestsEnabled,
        paymentsEnabled,
        reason,
        configuredPolicyVersion: control.policy_version as string | null,
        policy: policy ? this.publicPolicy(policy) : null,
        totalRequests: integer(counts.total),
        openRequests: integer(counts.open),
        hasMore: filter === null && integer(counts.total) > requests.length,
        requests: requests.map((r) => this.present(r)),
        destinations: destinations.map((d) => ({
          id: d.id as string,
          memberId: d.member_id as string,
          mask: d.mask as string,
          identityRevision: d.identity_revision as number,
          currentIdentityRevision: d.current_identity_revision as number | null,
          currentIdentityStatus: d.current_identity_status as string | null,
          verified: d.verified === true,
          evidenceReference: d.evidence_reference as string | null,
        })),
        exposures: exposures.map((e) => ({
          allocation: e.id as string,
          withdrawal: e.withdrawal as string,
          memberId: e.member_id as string,
          receipt: e.receipt as string,
          credits: integer(e.credits),
          cashCents: integer(e.cash_cents),
          sourceState: e.state as string,
        })),
      };
    });
  }
}

export type CommercialWithdrawalMemberView = Awaited<
  ReturnType<CommercialWithdrawalLedger["memberView"]>
>;
export type CommercialWithdrawalOwnerView = Awaited<
  ReturnType<CommercialWithdrawalLedger["ownerView"]>
>;
