import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  CommercialWithdrawalLedger,
  type CommercialWithdrawalAccess,
} from "../../src/server/commercial-withdrawal-ledger";
import { CommercialMarketLedger } from "../../src/server/commercial-market-ledger";
import {
  commercialCashPolicyVersion,
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
} from "../../src/core/commercial-billing";
import type {
  CommercialWithdrawalIdentityEvidence,
  CommercialWithdrawalPolicy,
} from "../../src/core/commercial-withdrawals";
import { rarityRule } from "../../src/core/card-rarity";
import { saleFeePolicy } from "../../src/core/credits-policy";

test(
  "Commercial cash withdrawal foundation: real PostgreSQL reservations, bank evidence, refunds and resolution",
  { skip: !process.env.AUSTRALIAN_SALARY_TEST_DB },
  async (t) => {
    const d = await multiSportDatabase();
    let sql: Sql | undefined;
    try {
      assert(d.native);
      const native = d.native;
      await native`create table if not exists auth.mfa_factors(id uuid primary key,user_id uuid not null,status text not null)`;
      const url = new URL(process.env.AUSTRALIAN_SALARY_TEST_DB!);
      url.pathname =
        "/" + (await native`select current_database() name`)[0].name;
      sql = postgres(url.href, { max: 16, onnotice: () => {} });
      const owner = randomUUID(),
        owner2 = randomUUID(),
        sessions: Record<string, string> = { ...d.sessions };
      const terms = "isolated-withdrawal-member-terms";
      for (const o of [owner, owner2]) {
        sessions[o] = randomUUID();
        await native`insert into auth.users(id,email_confirmed_at) values(${o},now())`;
        await native`insert into auth.sessions(id,user_id) values(${sessions[o]},${o})`;
        await native`insert into private.roles(user_id,role) values(${o},'owner')`;
        await native`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${o},'AU','NSW',true,${terms})`;
      }
      await native`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence) values('AU','NSW',${terms},'2020-01-01','2100-01-01','2100-01-01',true,18,'ISOLATED FIXTURE ONLY')`;
      for (const [n, member] of [d.user, d.other].entries()) {
        await native`update auth.users set phone=${"6140000000" + (n + 1)},phone_confirmed_at=now() where id=${member}`;
        await native`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${member},'AU','NSW',true,${terms})`;
        await native`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${member},'privacy',true,${terms},'isolated fixture')`;
      }
      const approvals = {
        ...Object.fromEntries(
          [
            "owner",
            "legal",
            "googlePlay",
            "privacy",
            "retention",
            "refundRecovery",
            "playerRights",
            "supplyReconciliation",
          ].map((key) => [key, "ISOLATED FIXTURE ONLY"]),
        ),
        validUntil: "2099-01-01T00:00:00Z",
        withdrawals: false,
        prizes: false,
        paidEntry: false,
        nba: false,
      };
      await native`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,transfers_enabled=true,policy_version=${commercialPolicyVersion},approvals=${native.json(approvals)}`;
      await native`update commercial_billing.products set approved=true`;
      for (let n = 0; n < 12; n++) {
        const player = randomUUID();
        for (const rarity of [
          "RARE",
          "ELITE",
          "ULTRA_RARE",
          "LEGENDARY",
          "ICON",
        ])
          await native`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},'nfl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'ISOLATED FIXTURE ONLY',${native.json({ name: "Synthetic " + n, team: "TEST", position: "QB", season: "ISOLATED", verifiedJerseyNumber: null, colour: "#123456", status: "active", synthetic: true })})`;
      }
      const keys = { active: "local", values: { local: randomBytes(32) } },
        ledger = new CommercialWithdrawalLedger(sql, "acceptance", keys),
        market = new CommercialMarketLedger(sql, "acceptance", keys);
      const actor =
        (member: string, staff = false, aal = staff ? "aal2" : "aal1") =>
        async (tx: Sql) => {
          await tx`set local role docked_commercial_app`;
          await tx`select set_config('request.jwt.claim.sub',${member},true),set_config('request.jwt.claims',${JSON.stringify({ sub: member, session_id: sessions[member], aal })},true)`;
          const [r] =
            await tx`select commercial_billing.withdrawal_actor_allowed(${member}::uuid,${sessions[member]}::uuid,${aal},${staff}) allowed`;
          assert.equal(
            r.allowed,
            true,
            "Current session and Owner MFA authorization denied",
          );
        };
      const access = (
        member: string,
        staff = false,
        enabled = true,
      ): CommercialWithdrawalAccess => ({
        requestsEnabled: enabled,
        paymentsEnabled: enabled,
        actor: actor(member, staff),
        member: async (tx, target) => {
          const [r] =
            await tx`select commercial_billing.withdrawal_member_allowed(${target}::uuid,${terms},${terms}) allowed`;
          assert.equal(r.allowed, true, "Current member eligibility denied");
        },
      });
      const memberCommand = (
        command: Record<string, unknown>,
        request = randomUUID(),
        member = d.user,
        enabled = true,
      ) =>
        ledger.memberCommand(
          member,
          { request, command },
          access(member, false, enabled),
        );
      const staffCommand = (
        command: Record<string, unknown>,
        request = randomUUID(),
        staff: string = owner,
        enabled = true,
      ) =>
        ledger.ownerCommand(
          staff,
          { request, command },
          access(staff, true, enabled),
        );
      const receipts: Record<
        string,
        { value: CommercialReceipt; token: string }
      > = {};
      for (const member of [d.user, d.other]) {
        const token = "isolated-withdrawal-" + member,
          product = commercialProducts[0];
        const value: CommercialReceipt = {
          key: createHash("sha256")
            .update("docked.fantasy\0" + token)
            .digest("hex"),
          account: "a".repeat(64),
          environment: "acceptance",
          product,
          state: "PURCHASED",
          paid: true,
          consumed: false,
          orderId: "GPA.ISOLATED." + member,
          grossCents: product.audCents,
          taxCents: null,
          refundedCents: 0,
          providerAt: new Date().toISOString(),
        };
        receipts[member] = { value, token };
        await ledger.accept(value, member, token, async () => {});
      }
      const offer = commercialPack("nfl", "STANDARD", 9);
      const buyPack = () =>
        ledger.buyPack(
          d.user,
          randomUUID(),
          {
            sport: "nfl",
            family: "STANDARD",
            size: 9,
            configurationHash: offer.configurationHash,
            confirmed: true,
          },
          async () => {},
        );
      const pack = await buyPack(),
        opened = await ledger.openPack(d.user, pack.id, async () => {});
      const marketCommand = (member: string, command: unknown) =>
        market.command(
          member,
          { request: randomUUID(), command },
          {
            tradingEnabled: true,
            actor: actor(member),
            party: async (tx, target) => {
              const [r] =
                await tx`select commercial_billing.market_party_allowed(${member}::uuid,${target}::uuid,${terms},${terms}) allowed`;
              assert.equal(r.allowed, true);
            },
          },
        );
      for (const card of opened.cards.slice(0, 4)) {
        const listing = await marketCommand(d.user, {
          kind: "list",
          card: card.id,
          price: 1000,
          preference: "sell",
        });
        const review = await marketCommand(d.other, {
          kind: "review-buy",
          listing: listing.listing,
        });
        await marketCommand(d.other, {
          kind: "buy",
          listing: listing.listing,
          review: review.review,
          expectedPrice: review.price,
          policy: saleFeePolicy,
          confirmed: true,
        });
      }
      const policy: CommercialWithdrawalPolicy = {
        version: "ISOLATED-CASH-POLICY-v1",
        environment: "acceptance",
        currency: "AUD",
        eligibleSource: "settled-sale-proceeds-only",
        rate: { credits: 1, audCents: 1 },
        minimumCredits: 100,
        maximumCredits: 2000,
        dailyMaximumCredits: 10000,
        feeCents: 10,
        identityMaxAgeMs: 3600000,
        approvals: {
          owner: "ISOLATED OWNER",
          legalAssessment: "ISOLATED OWNER ADVICE",
          playAssessment: "ISOLATED OWNER ADVICE",
          payoutBank: "ISOLATED BANK",
          privacy: "ISOLATED PRIVACY",
          refundRecovery: "ISOLATED RECOVERY",
          validUntil: "2099-01-01T00:00:00Z",
        },
      };
      const evidence = (
        member: string,
      ): CommercialWithdrawalIdentityEvidence => ({
        provider: "sumsub",
        providerEnvironment: "acceptance",
        providerApplicantId: "synthetic-applicant-" + member,
        providerReviewId: "synthetic-review-1",
        providerReviewedAt: new Date().toISOString(),
        checkedAt: new Date().toISOString(),
        status: "approved",
        country: "AU",
        adult: true,
        evidenceReference: "ISOLATED PROVIDER EVIDENCE",
        legalNameHash: createHash("sha256")
          .update("synthetic keyed test " + member)
          .digest("hex"),
      });
      const identities: Record<string, CommercialWithdrawalIdentityEvidence> =
          {},
        destinations: Record<string, string> = {};
      for (const member of [d.user, d.other]) {
        if (member === d.other) {
          // An authenticated provider enrollment from yesterday, with the signed
          // provider result completing after the short hosted-link expiry.
          await native`insert into commercial_billing.withdrawal_identity_bindings(member_id,external_user_id,provider_environment) values(${member},${`docked:acceptance:${member}`},'acceptance')`;
          await native`insert into commercial_billing.withdrawal_identity_sessions(member_id,external_user_id,expires_at,created_at) values(${member},${`docked:acceptance:${member}`},clock_timestamp()-interval '23 hours',clock_timestamp()-interval '1 day')`;
        } else
          await ledger.bindIdentitySession(
            member,
            {
              externalUserId: `docked:acceptance:${member}`,
              expiresAt: new Date(Date.now() + 600000).toISOString(),
            },
            actor(member),
          );
        identities[member] = evidence(member);
        await ledger.recordIdentity(member, identities[member], actor(member));
        destinations[member] = randomUUID();
        await ledger.recordDestination(
          member,
          {
            id: destinations[member],
            identityRevision: 1,
            ciphertext:
              "synthetic-encrypted-secret:" +
              randomBytes(64).toString("base64"),
            mask: "****1234",
          },
          actor(member),
        );
      }
      const request = (credits: number, member = d.user) => ({
        kind: "request",
        credits,
        destination: destinations[member],
        identityRevision: 1,
        policyVersion: policy.version,
      });
      const verify = () =>
        staffCommand({
          kind: "verify-destination",
          destination: destinations[d.user],
          identityRevision: 1,
          verified: true,
          evidenceReference: "ISOLATED BANK OWNERSHIP CHECK",
          reason: "Synthetic bank ownership evidence independently verified",
        });
      const approve = (r: any) =>
        staffCommand({
          kind: "review",
          id: r.id,
          expectedRevision: r.revision,
          decision: "approve",
          reason: "Verified synthetic beneficiary and reconciled source cash",
        });
      const claim = (r: any, staff = owner) =>
        staffCommand(
          { kind: "claim", id: r.id, expectedRevision: r.revision },
          randomUUID(),
          staff,
        );
      const reopen = async () => {
        await native`update commercial_billing.withdrawal_control set requests_enabled=true,payments_enabled=true`;
      };

      await t.test(
        "independent OFF controls, current sessions, no new approval invented",
        async () => {
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).enabled,
            false,
          );
          await assert.rejects(
            memberCommand(request(700)),
            /currently unavailable/,
          );
          await native`insert into commercial_billing.withdrawal_policies(version,policy) values(${policy.version},${native.json(policy)})`;
          await native`update commercial_billing.withdrawal_control set policy_version=${policy.version},requests_enabled=true,payments_enabled=true`;
          await assert.rejects(memberCommand(request(700)), /Cash-capable/);
          await native`update commercial_billing.control set policy_version=${commercialCashPolicyVersion},approvals=${native.json({ ...approvals, withdrawals: true, withdrawalPolicyVersion: policy.version, ownerDecision: "ISOLATED OWNER DECISION", legalAssessment: "ISOLATED ADVICE BASIS", playAssessment: "ISOLATED ADVICE BASIS", withdrawalAssessmentBasis: "owner-reviewed-advice" })}`;
          await assert.rejects(
            memberCommand(request(700), randomUUID(), d.user, false),
            /currently unavailable/,
          );
          await assert.rejects(
            ledger.ownerView(owner, {
              ...access(owner, true),
              actor: actor(owner, true, "aal1"),
            }),
            /Owner MFA/,
          );
          const factor = randomUUID();
          await native`insert into auth.mfa_factors(id,user_id,status) values(${factor},${d.user},'verified')`;
          await assert.rejects(
            ledger.memberView(d.user, access(d.user)),
            /Owner MFA/,
          );
          await ledger.memberView(d.user, {
            ...access(d.user),
            actor: actor(d.user, false, "aal2"),
          });
          await native`delete from auth.mfa_factors where id=${factor}`;
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).money.eligible,
            0,
            "Store receivable is not bank backing",
          );
          const backing = {
            kind: "record-funding",
            receipt: receipts[d.other].value.key,
            netCashCents: 2500,
            bankReference: "ISOLATED-BANK-DEPOSIT-1",
            evidenceReference: "ISOLATED BANK STATEMENT 1",
            settledAt: new Date(Date.now() - 60000).toISOString(),
            availableAt: new Date(Date.now() - 60000).toISOString(),
          };
          await staffCommand(backing);
          await assert.rejects(
            staffCommand({ ...backing, receipt: receipts[d.user].value.key }),
            /unique|duplicate/i,
            "One bank credit cannot be counted twice",
          );
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).money.eligible,
            2500,
          );
          assert.equal(
            (await ledger.memberView(d.other, access(d.other))).money.eligible,
            0,
          );
          await assert.rejects(
            memberCommand(request(100, d.other), randomUUID(), d.other),
            /Purchased or promotional credits cannot be withdrawn/,
          );
          const view = await ledger.ownerView(owner, access(owner, true));
          assert.equal(view.destinations.length, 2);
          assert.equal(
            JSON.stringify(view).includes("synthetic-encrypted-secret"),
            false,
          );
          assert.equal(JSON.stringify(view).includes("legalNameHash"), false);
        },
      );

      await t.test(
        "cash SQL guards reject incomplete scope without changing v1 issuance",
        async () => {
          const [current] =
            await native`select approvals from commercial_billing.control`;
          for (const changed of [
            { withdrawals: false },
            { withdrawals: "true" },
            { legalAssessment: "   " },
            { ownerDecision: "" },
            { prizes: true },
            { paidEntry: true },
            { nba: true },
            { withdrawalAssessmentBasis: "invented-approval" },
            { validUntil: "infinity" },
          ]) {
            await assert.rejects(
              native.begin(async (raw) => {
                const tx = raw as unknown as Sql;
                await tx`update commercial_billing.control set approvals=${tx.json({ ...current.approvals, ...changed })}`;
                // Trigger must reject the scope before checking this deliberately
                // non-mintable historical pack. This bypasses TypeScript guards.
                await tx`insert into commercial_billing.cards(definition,serial,owner_id,pack,slot) select definition,serial,owner_id,pack,slot from commercial_billing.cards where id=${opened.cards[0].id}`;
              }),
              /Commercial approvals required/,
            );
          }
          assert.equal(
            (
              await native`select count(*)::int n from commercial_billing.cards`
            )[0].n,
            9,
          );
        },
      );

      await t.test(
        "fresh KYC checks keep stable revisions; replay is bound to the applicant",
        async () => {
          const first = identities[d.user];
          const checked = await ledger.refreshIdentity(
            d.user,
            {
              eventId: "synthetic-webhook-1",
              expectedApplicantId: first.providerApplicantId,
            },
            async () => ({
              ...first,
              checkedAt: new Date().toISOString(),
              evidenceReference: "ISOLATED REFRESH EVIDENCE",
            }),
            actor(d.user),
          );
          assert.equal(checked.revision, 1);
          let fetched = false;
          await ledger.refreshIdentity(
            d.user,
            { eventId: "synthetic-webhook-1" },
            async () => {
              fetched = true;
              return first;
            },
            actor(d.user),
          );
          assert.equal(fetched, false);
          await assert.rejects(
            ledger.refreshIdentity(
              d.user,
              { expectedApplicantId: "another-applicant" },
              async () => first,
              actor(d.user),
            ),
            /not bound/,
          );
          await assert.rejects(
            ledger.recordIdentity(
              d.user,
              { ...first, providerEnvironment: "production" },
              actor(d.user),
            ),
            /environment/,
          );
        },
      );

      await t.test(
        "idempotent reservation, source-linked release and competing cash reservation",
        async () => {
          const requestId = randomUUID();
          const repeated = await Promise.all(
            Array.from({ length: 20 }, () =>
              memberCommand(request(700), requestId),
            ),
          );
          assert(repeated.every((r) => r.id === repeated[0].id));
          const reserved = repeated[0];
          assert.equal(reserved.audCents, 690);
          assert.equal(
            (
              await native`select count(*)::int n from commercial_billing.journals where id=${`withdrawal:${reserved.id}:reserve`}`
            )[0].n,
            1,
          );
          await assert.rejects(
            memberCommand(request(800), requestId),
            /different withdrawal details/,
          );
          const origins =
            await native`select l.id,l.remaining from commercial_billing.lots l join commercial_billing.withdrawal_allocations a on a.lot=l.id where a.withdrawal=${reserved.id}`;
          const cancelled = await memberCommand({
            kind: "cancel",
            id: reserved.id,
            expectedRevision: reserved.revision,
          });
          assert.equal(cancelled.status, "CANCELLED");
          for (const origin of origins)
            assert.equal(
              (
                await native`select remaining from commercial_billing.lots where id=${origin.id}`
              )[0].remaining,
              origin.remaining,
              "Guarded original lot cannot be topped up again",
            );
          assert.equal(
            Number(
              (
                await native`select sum(l.remaining) amount from commercial_billing.lots l join commercial_billing.withdrawal_compensation_lots c on c.lot=l.id join commercial_billing.withdrawal_allocations a on a.id=c.allocation where a.withdrawal=${reserved.id}`
              )[0].amount,
            ),
            700,
          );
          await assert.rejects(
            native`update commercial_billing.lots set remaining=remaining+1 where id=${origins[0].id}`,
            /immutable/,
          );
          const race = await Promise.allSettled([
            memberCommand(request(1500)),
            memberCommand(request(1500)),
          ]);
          assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
          const winner = race.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<Record<string, any>>;
          await memberCommand({
            kind: "cancel",
            id: winner.value.id,
            expectedRevision: winner.value.revision,
          });
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).money.eligible,
            2500,
          );
        },
      );

      let paid: any;
      await t.test(
        "bank ownership, single claimant, emergency stop and confirmed send/reconcile",
        async () => {
          let r = await memberCommand(request(600));
          await assert.rejects(approve(r), /bank account ownership/);
          await verify();
          const reviewReveal = await ledger.revealDestination(
            owner,
            destinations[d.user],
            "Review synthetic bank ownership evidence",
            access(owner, true),
          );
          assert(
            reviewReveal.ciphertext.startsWith("synthetic-encrypted-secret:"),
          );
          r = await approve(r);
          const race = await Promise.allSettled([claim(r), claim(r, owner2)]);
          assert.equal(race.filter((v) => v.status === "fulfilled").length, 1);
          r = (
            race.find(
              (v) => v.status === "fulfilled",
            ) as PromiseFulfilledResult<any>
          ).value;
          const claimant = r.claimedBy as string,
            other = claimant === owner ? owner2 : owner;
          await assert.rejects(
            ledger.revealPayment(
              other,
              r.id,
              "Attempt to reveal another claimant destination",
              access(other, true),
            ),
            /current payment claimant/,
          );
          assert.equal(
            (
              await ledger.revealPayment(
                claimant,
                r.id,
                "Prepare the synthetic manual EFT instruction",
                access(claimant, true),
              )
            ).withdrawal.audCents,
            590,
          );
          await staffCommand({
            kind: "stop",
            reason: "Isolated emergency stop proves no new payment starts",
          });
          await assert.rejects(
            memberCommand(request(100)),
            /currently unavailable/,
          );
          await assert.rejects(
            memberCommand({
              kind: "cancel",
              id: r.id,
              expectedRevision: r.revision,
            }),
            /processing has started/,
          );
          r = await staffCommand({
            kind: "exception",
            id: r.id,
            expectedRevision: r.revision,
            reason: "Bank status uncertain; reserved funds must remain locked",
          });
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).money.pending,
            600,
          );
          await assert.rejects(
            staffCommand(
              {
                kind: "record-sent",
                id: r.id,
                expectedRevision: r.revision,
                bankReference: "ISOLATED-EFT-1",
                evidenceReference: "ISOLATED BANK TRANSFER CONFIRMATION",
                confirmed: true,
              },
              randomUUID(),
              other,
              false,
            ),
            /original claimant/,
          );
          r = await staffCommand(
            {
              kind: "record-sent",
              id: r.id,
              expectedRevision: r.revision,
              bankReference: "ISOLATED-EFT-1",
              evidenceReference: "ISOLATED BANK TRANSFER CONFIRMATION",
              confirmed: true,
            },
            randomUUID(),
            claimant,
            false,
          );
          paid = await staffCommand(
            {
              kind: "reconcile",
              id: r.id,
              expectedRevision: r.revision,
              evidenceReference: "ISOLATED SETTLED BANK STATEMENT",
            },
            randomUUID(),
            owner,
            false,
          );
          assert.equal(paid.status, "RECONCILED");
          assert.equal(
            (await ledger.memberView(d.user, access(d.user))).money.pending,
            0,
          );
          await reopen();
        },
      );

      await t.test(
        "unique bank reference rolls back atomically; bank return and confirmed-unpaid release compensate once",
        async () => {
          let r = await claim(await approve(await memberCommand(request(200))));
          const claimant = r.claimedBy as string;
          await assert.rejects(
            staffCommand(
              {
                kind: "record-sent",
                id: r.id,
                expectedRevision: r.revision,
                bankReference: "ISOLATED-EFT-1",
                evidenceReference: "ISOLATED DUPLICATE BANK REFERENCE",
                confirmed: true,
              },
              randomUUID(),
              claimant,
            ),
            /unique|duplicate/i,
          );
          assert.equal(
            (
              await native`select count(*)::int n from commercial_billing.journals where id=${`withdrawal:${r.id}:redeem`}`
            )[0].n,
            0,
          );
          r = await staffCommand(
            {
              kind: "record-sent",
              id: r.id,
              expectedRevision: r.revision,
              bankReference: "ISOLATED-EFT-2",
              evidenceReference: "ISOLATED SECOND BANK PAYMENT",
              confirmed: true,
            },
            randomUUID(),
            claimant,
          );
          const before = (await ledger.wallet(d.user)).balance;
          const returned = await staffCommand({
            kind: "returned",
            id: r.id,
            expectedRevision: r.revision,
            bankReference: "ISOLATED-BANK-RETURN-2",
            evidenceReference: "ISOLATED RETURN BANK STATEMENT",
            reason:
              "The bank confirmed the full synthetic net payment returned",
          });
          assert.equal(returned.status, "RETURNED");
          assert.equal((await ledger.wallet(d.user)).balance, before + 200);
          await assert.rejects(
            staffCommand({
              kind: "returned",
              id: r.id,
              expectedRevision: returned.revision,
              bankReference: "ISOLATED-BANK-RETURN-3",
              evidenceReference: "ISOLATED REPEAT RETURN",
              reason: "A repeated return must never mint additional credits",
            }),
            /Only a sent/,
          );
          r = await claim(await approve(await memberCommand(request(200))));
          await assert.rejects(
            staffCommand({
              kind: "release-unpaid",
              id: r.id,
              expectedRevision: r.revision,
              evidenceReference: "ISOLATED BANK NO PAYMENT",
              reason: "Uncertain payments cannot be silently released",
            }),
            /documented payment exception/,
          );
          r = await staffCommand({
            kind: "exception",
            id: r.id,
            expectedRevision: r.revision,
            reason: "Synthetic bank request timed out with unknown outcome",
          });
          r = await staffCommand({
            kind: "release-unpaid",
            id: r.id,
            expectedRevision: r.revision,
            evidenceReference: "ISOLATED BANK CONFIRMED UNPAID",
            reason: "Independent bank check confirmed no payment was made",
          });
          assert.equal(r.status, "RELEASED");
        },
      );

      await t.test(
        "real pack spend races the same credits without overspend",
        async () => {
          while (
            (await ledger.wallet(d.user)).balance >=
            offer.priceCredits * 2
          )
            await buyPack();
          const balance = (await ledger.wallet(d.user)).balance;
          assert(balance >= offer.priceCredits && balance <= 2000);
          const raced = await Promise.allSettled([
            memberCommand(request(balance)),
            buyPack(),
          ]);
          assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
          if (raced[0].status === "fulfilled")
            await memberCommand({
              kind: "cancel",
              id: raced[0].value.id,
              expectedRevision: raced[0].value.revision,
            });
          assert((await ledger.wallet(d.user)).balance >= 0);
        },
      );

      await t.test(
        "identity/session revocation blocks new payment, while staff may release an existing obligation",
        async () => {
          const amount = Math.min(
            100,
            (await ledger.memberView(d.user, access(d.user))).money.eligible,
          );
          assert.equal(amount, 100);
          let r = await approve(await memberCommand(request(amount)));
          await ledger.refreshIdentity(
            d.user,
            { eventId: "synthetic-rejected-identity" },
            async () => ({
              ...identities[d.user],
              checkedAt: new Date().toISOString(),
              status: "rejected",
              providerReviewId: "synthetic-rejected-review",
            }),
            actor(d.user),
          );
          await assert.rejects(claim(r), /Identity verification changed/);
          await native`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${sessions[d.user]}`;
          await assert.rejects(
            memberCommand({
              kind: "cancel",
              id: r.id,
              expectedRevision: r.revision,
            }),
            /session/,
          );
          r = await staffCommand({
            kind: "review",
            id: r.id,
            expectedRevision: r.revision,
            decision: "reject",
            reason:
              "Current identity revoked; existing reservation safely restored",
          });
          assert.equal(r.status, "REJECTED");
          await native`update auth.sessions set not_after=null where id=${sessions[d.user]}`;
        },
      );

      await t.test(
        "post-payout source refund retains exposure and blocks ordinary spending without mutating history",
        async () => {
          // Re-spent resale proceeds can return to their original purchaser.
          // This creates the exact same-member receipt/account lock ordering
          // that a concurrent refund and compensating cancellation must obey.
          const listing = await marketCommand(d.other, {
            kind: "list",
            card: opened.cards[0].id,
            price: 300,
            preference: "sell",
          });
          const review = await marketCommand(d.user, {
            kind: "review-buy",
            listing: listing.listing,
          });
          await marketCommand(d.user, {
            kind: "buy",
            listing: listing.listing,
            review: review.review,
            expectedPrice: review.price,
            policy: saleFeePolicy,
            confirmed: true,
          });
          await staffCommand({
            kind: "verify-destination",
            destination: destinations[d.other],
            identityRevision: 1,
            verified: true,
            evidenceReference: "ISOLATED SECOND BENEFICIARY",
            reason:
              "Independently verified second synthetic beneficiary bank ownership",
          });
          const beforeRefund = await approve(
            await memberCommand(request(100, d.other), randomUUID(), d.other),
          );
          const cancellation = await memberCommand(
            request(100, d.other),
            randomUUID(),
            d.other,
          );
          const { value, token } = receipts[d.other];
          const concurrent = await Promise.all([
            memberCommand(
              {
                kind: "cancel",
                id: cancellation.id,
                expectedRevision: cancellation.revision,
              },
              randomUUID(),
              d.other,
            ),
            ledger.accept(
              {
                ...value,
                state: "REVIEW",
                paid: true,
                refundedCents: 100,
                providerAt: new Date(Date.now() + 1000).toISOString(),
              },
              d.other,
              token,
              async () => {},
              false,
            ),
          ]);
          assert.equal(concurrent[0].status, "CANCELLED");
          await assert.rejects(
            claim(beforeRefund),
            /source funds require review/,
          );
          await staffCommand({
            kind: "review",
            id: beforeRefund.id,
            expectedRevision: beforeRefund.revision,
            decision: "reject",
            reason:
              "Source refund arrived before claim; restore held credits for recovery",
          });
          const wallet = await ledger.wallet(d.user);
          assert.equal(wallet.reviewRequired, true);
          assert.equal(wallet.spendable, 0);
          await assert.rejects(buyPack(), /Account review/);
          const [liveLot] =
            await native`select id from commercial_billing.lots where member_id=${d.user} and remaining>0 limit 1`;
          assert(liveLot);
          await assert.rejects(
            native`update commercial_billing.lots set remaining=remaining-1 where id=${liveLot.id}`,
            /source exposure/,
          );
          const view = await ledger.ownerView(owner, access(owner, true));
          assert(view.exposures.some((e) => e.withdrawal === paid.id));
          const exact = await ledger.ownerView(owner, access(owner, true), {
            request: paid.id,
          });
          assert.deepEqual(
            exact.requests.map((r) => r.id),
            [paid.id],
          );
          assert(exact.exposures.every((e) => e.withdrawal === paid.id));
          assert.equal(exact.destinations.length, 1);
          assert.equal(exact.totalRequests, view.totalRequests);
          assert.equal(exact.openRequests, view.openRequests);
          assert.equal(exact.hasMore, false);
          assert.equal(
            (
              await ledger.ownerView(owner, access(owner, true), {
                request: randomUUID(),
              })
            ).requests.length,
            0,
          );
          assert.equal(
            (
              await native`select status from commercial_billing.withdrawals where id=${paid.id}`
            )[0].status,
            "RECONCILED",
          );
          await assert.rejects(
            native`update commercial_billing.withdrawal_allocations set credits=credits+1 where withdrawal=${paid.id}`,
            /immutable/i,
          );
          await assert.rejects(
            native`update commercial_billing.withdrawals set destination_snapshot='{}',revision=revision+1 where id=${paid.id}`,
            /immutable/i,
          );
          await assert.rejects(
            native`delete from commercial_billing.withdrawal_events`,
            /immutable/i,
          );
          const [grants] =
            await native`select has_table_privilege('authenticated','commercial_billing.withdrawal_destination_payloads','select') bank_read,has_table_privilege('docked_commercial_app','commercial_billing.withdrawal_control','update') can_enable,has_function_privilege('authenticated','commercial_billing.withdrawal_actor_allowed(uuid,uuid,text,boolean)','execute') can_authorize`;
          assert.deepEqual(grants, {
            bank_read: false,
            can_enable: false,
            can_authorize: false,
          });
          assert.equal(
            (
              await native`select count(*)::int n from(select journal from commercial_billing.lines group by journal having sum(amount)<>0)x`
            )[0].n,
            0,
          );
          const [memberBalance] =
            await native`select coalesce(sum(l.amount),0)::text amount from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and l.account=${"member:" + d.user}`;
          assert.equal(Number(memberBalance.amount), wallet.balance);
          for (const exposure of view.exposures)
            await staffCommand({
              kind: "resolve-exposure",
              allocation: exposure.allocation,
              evidenceReference: "ISOLATED REVIEW OF CURRENT PARTIAL REFUND",
              reason:
                "Synthetic operator accepted this exact partial-loss exposure",
            });
          assert.equal((await ledger.wallet(d.user)).reviewRequired, false);
          await ledger.accept(
            {
              ...value,
              state: "REVOKED",
              paid: false,
              refundedCents: value.grossCents!,
              providerAt: new Date(Date.now() + 2000).toISOString(),
            },
            d.other,
            token,
            async () => {},
            false,
          );
          assert.equal(
            (await ledger.wallet(d.user)).reviewRequired,
            true,
            "A larger later loss must reopen the prior resolved exposure",
          );
          assert(
            (await ledger.ownerView(owner, access(owner, true))).exposures.some(
              (e) => e.withdrawal === paid.id,
            ),
          );
        },
      );
    } finally {
      await sql?.end();
      await d.pg.close();
    }
  },
);
