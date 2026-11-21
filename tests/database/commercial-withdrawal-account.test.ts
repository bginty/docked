import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  exportWithdrawalAccount,
  finishAccountDeletion,
  withdrawalAccountDeletionStatus,
} from "../../src/server/commercial-withdrawal-account";

test(
  "withdrawal account export isolates members and closure preserves obligations until verified cleanup",
  { skip: !process.env.AUSTRALIAN_SALARY_TEST_DB },
  async () => {
    const d = await multiSportDatabase();
    let app: Sql | undefined;
    try {
      assert(d.native);
      const sql = d.native;
      await sql`create table if not exists auth.mfa_factors(id uuid primary key,user_id uuid not null,status text not null)`;
      const url = new URL(process.env.AUSTRALIAN_SALARY_TEST_DB!);
      url.pathname = "/" + (await sql`select current_database() name`)[0].name;
      app = postgres(url.href, { max: 1, onnotice: () => {} });
      await app`set role docked_app`;
      const owner = d.other;
      for (const member of [d.user, owner]) {
        await sql`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${member},'AU','NSW',true,'ISOLATED-ONLY')`;
        await sql`insert into commercial_billing.accounts(member_id) values(${member})`;
      }
      await sql`insert into private.roles(user_id,role) values(${owner},'owner')`;
      const identity = randomUUID();
      const destination = randomUUID();
      const withdrawal = randomUUID();
      const policy = "ISOLATED-CASH-POLICY";
      const secret = "SYNTHETIC-BANK-CIPHERTEXT-" + "x".repeat(96);
      const hash = createHash("sha256").update(secret).digest("hex");
      await sql`insert into commercial_billing.withdrawal_policies(version,policy) values(${policy},${sql.json({ version: policy })})`;
      await sql`insert into commercial_billing.withdrawal_identity_bindings(member_id,external_user_id,provider_environment,provider_applicant_id)
        values(${d.user},${"isolated:" + d.user},'acceptance','SYNTHETIC-APPLICANT')`;
      await sql`insert into commercial_billing.withdrawal_identities(id,member_id,revision,fingerprint,evidence)
        values(${identity},${d.user},1,${"a".repeat(64)},${sql.json({ provider: "sumsub", status: "approved", country: "AU", adult: true, providerApplicantId: "SYNTHETIC-APPLICANT", legalNameHash: "SECRET-IDENTITY-HASH", rawDocument: "MUST-NOT-EXPORT" })})`;
      await sql`insert into commercial_billing.withdrawal_identity_checks(identity_id,checked_at) values(${identity},clock_timestamp())`;
      await sql`insert into commercial_billing.withdrawal_destinations(id,member_id,identity_revision,ciphertext_hash,mask)
        values(${destination},${d.user},1,${hash},'****6789')`;
      await sql`insert into commercial_billing.withdrawal_destination_payloads(destination,ciphertext,ciphertext_hash)
        values(${destination},${secret},${hash})`;
      const receipt = "b".repeat(64),
        lot = randomUUID(),
        funding = randomUUID(),
        allocation = randomUUID();
      // Artificial credit lots and bank evidence only. The real reservation
      // constraints still require allocations and balanced journals atomically.
      await sql.begin(async (tx) => {
        await tx`insert into commercial_billing.receipts(key,member_id,account_binding,environment,product,state,encrypted_reference,credited)
          values(${receipt},${d.user},${"c".repeat(64)},'acceptance','{}','PURCHASED','ISOLATED-REFERENCE',true)`;
        await tx`insert into commercial_billing.lots(id,member_id,receipt,source,original,remaining)
          values(${lot},${d.user},${receipt},'sale:ISOLATED:0',1250,250)`;
        await tx`insert into commercial_billing.withdrawal_cash_funding(id,receipt,net_cash_cents,bank_reference,evidence_reference,settled_at,available_at,recorded_by)
          values(${funding},${receipt},100,'ISOLATED-FUNDING','ISOLATED-BANK-EVIDENCE',clock_timestamp(),clock_timestamp(),${owner})`;
        await tx`insert into commercial_billing.withdrawal_bank_references(reference,kind,related_id) values('ISOLATED-FUNDING','FUNDING',${funding})`;
        await tx`insert into commercial_billing.journals(id,unit,actor,reason) values('ISOLATED-CREDIT','CREDITS','fixture','Artificial credits for account lifecycle test')`;
        await tx`insert into commercial_billing.lines(journal,n,account,amount) values('ISOLATED-CREDIT',0,${"member:" + d.user},1250),('ISOLATED-CREDIT',1,'system:issued',-1250)`;
        await tx`insert into commercial_billing.withdrawals(id,member_id,credits,gross_aud_cents,fee_cents,aud_cents,policy_version,policy_snapshot,identity_id,identity_revision,destination,destination_snapshot)
          values(${withdrawal},${d.user},1000,100,0,100,${policy},${tx.json({ version: policy })},${identity},1,${destination},${tx.json({ id: destination, mask: "****6789", identityRevision: 1, ciphertextHash: hash })})`;
        await tx`insert into commercial_billing.withdrawal_allocations(id,withdrawal,lot,root_lot,receipt,funding,credits,cash_cents)
          values(${allocation},${withdrawal},${lot},${lot},${receipt},${funding},1000,100)`;
        await tx`insert into commercial_billing.journals(id,unit,actor,reason) values(${"withdrawal:" + withdrawal + ":reserve"},'CREDITS','fixture','Synthetic withdrawal reservation')`;
        await tx`insert into commercial_billing.lines(journal,n,account,amount) values
          (${"withdrawal:" + withdrawal + ":reserve"},0,${"member:" + d.user},-1000),
          (${"withdrawal:" + withdrawal + ":reserve"},1,${"withdrawal:" + withdrawal + ":reserved"},1000)`;
      });
      const actor = {
        member: d.user,
        sessionId: d.sessions[d.user],
        aal: "aal1",
      };
      const exported = await exportWithdrawalAccount(app, actor, {});
      assert.equal(exported?.identity?.status, "approved");
      assert.equal(exported?.withdrawals[0].id, withdrawal);
      assert.equal(exported?.withdrawals[0].bankMask, "****6789");
      assert.equal(exported?.withdrawals[0].audCents, 100);
      const encoded = JSON.stringify(exported);
      for (const forbidden of [
        secret,
        hash,
        "SYNTHETIC-APPLICANT",
        "SECRET-IDENTITY-HASH",
        "MUST-NOT-EXPORT",
        "legalNameHash",
        "ciphertext",
      ])
        assert.equal(encoded.includes(forbidden), false, forbidden);
      assert.equal(
        await exportWithdrawalAccount(
          app,
          { member: owner, sessionId: d.sessions[owner], aal: "aal2" },
          {},
        ),
        null,
      );
      await assert.rejects(
        app`select ciphertext from commercial_billing.withdrawal_destination_payloads`,
      );
      await assert.rejects(
        app.begin(async (raw) => {
          const tx = raw as unknown as Sql;
          await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: d.sessions[owner], aal: "aal2" })},true)`;
          await tx`select private.withdrawal_account_export(${d.user}::uuid,${d.sessions[owner]}::uuid,'aal2')`;
        }),
        /Own active account session required/,
      );
      await sql`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${d.sessions[d.user]}`;
      await assert.rejects(
        exportWithdrawalAccount(app, actor, {}),
        /Own active account session required/,
      );
      await sql`update auth.sessions set not_after=null where id=${d.sessions[d.user]}`;
      await assert.rejects(
        withdrawalAccountDeletionStatus(app, d.user, {}),
        /Recorded revoked account deletion required/,
      );

      await sql`select private.disable_account(${d.user})`;
      assert.equal(
        (
          await sql`select commercial_billing.withdrawal_account_closed(${d.user}) closed`
        )[0].closed,
        true,
      );
      assert.equal(
        (
          await sql`select count(*)::int n from auth.sessions where user_id=${d.user}`
        )[0].n,
        0,
      );
      const closure = await withdrawalAccountDeletionStatus(app, d.user, {});
      assert.equal(closure?.pending, true);
      assert.equal(closure?.financialReview, "queued");
      assert.equal(closure?.providerCleanup, "queued");
      assert.equal(closure?.localCleanup, "queued");
      const preservedBalance =
        await sql`select sum(remaining)::int balance from commercial_billing.lots where member_id=${d.user}`;
      // Simulate confirmed Auth soft-erasure; no external provider is contacted.
      await sql`update auth.users set deleted_at=clock_timestamp() where id=${d.user}`;
      assert.deepEqual(await finishAccountDeletion(app, d.user, {}), {
        pending: true,
      });
      assert.deepEqual(await finishAccountDeletion(app, d.user, {}), {
        pending: true,
      });
      assert.equal(
        (
          await sql`select count(*)::int n from public.profiles where id=${d.user}`
        )[0].n,
        0,
      );
      assert.equal(
        (
          await sql`select state from private.job_runs where dedupe_key=${"account-deletion:" + d.user}`
        )[0].state,
        "pending_review",
      );
      assert.equal(
        (
          await sql`select count(*)::int n from commercial_billing.withdrawal_provider_cleanup_intents where member_id=${d.user}`
        )[0].n,
        1,
      );
      assert.equal(
        (
          await sql`select count(*)::int n from commercial_billing.withdrawals where id=${withdrawal}`
        )[0].n,
        1,
      );
      assert.deepEqual(
        await sql`select sum(remaining)::int balance from commercial_billing.lots where member_id=${d.user}`,
        preservedBalance,
      );
      assert.equal(
        (
          await sql`select count(*)::int n from private.audit_events where action='account_erasure_completed' and subject=${d.user}`
        )[0].n,
        0,
      );

      const review = (action: string) =>
        app!.begin(async (raw) => {
          const tx = raw as unknown as Sql;
          await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: d.sessions[owner], aal: "aal2" })},true)`;
          await tx`select private.review_withdrawal_account_cleanup(${d.user}::uuid,'ISOLATED-RETENTION-ONLY',${action},'ISOLATED-EVIDENCE-NO-EXTERNAL-ACTION')`;
        });
      await assert.rejects(
        review("FINANCIAL_REVIEWED"),
        /approved retention evidence required/,
      );
      await sql`insert into commercial_billing.withdrawal_retention_policies(version,review_reference,provider_contract_reference,valid_until)
        values('ISOLATED-RETENTION-ONLY','ISOLATED-OWNER-APPROVAL','ISOLATED-PROVIDER-CONTRACT','2099-01-01')`;
      await assert.rejects(
        review("FINANCIAL_REVIEWED"),
        /Outstanding withdrawal or recovery obligation/,
      );
      await sql.begin(async (tx) => {
        const released = randomUUID();
        await tx`insert into commercial_billing.lots(id,member_id,receipt,source,original,remaining)
          values(${released},${d.user},${receipt},${"withdrawal-release:" + withdrawal},1000,1000)`;
        await tx`insert into commercial_billing.withdrawal_compensation_lots(lot,allocation,root_lot,reason)
          values(${released},${allocation},${lot},'CANCELLED')`;
        await tx`insert into commercial_billing.journals(id,unit,actor,reason) values(${"withdrawal:" + withdrawal + ":release"},'CREDITS','fixture','Synthetic cancellation compensation')`;
        await tx`insert into commercial_billing.lines(journal,n,account,amount) values
          (${"withdrawal:" + withdrawal + ":release"},0,${"withdrawal:" + withdrawal + ":reserved"},-1000),
          (${"withdrawal:" + withdrawal + ":release"},1,${"member:" + d.user},1000)`;
        await tx`update commercial_billing.withdrawals set status='CANCELLED',revision=revision+1 where id=${withdrawal}`;
      });
      await review("FINANCIAL_REVIEWED");
      await assert.rejects(
        review("LOCAL_PAYLOAD_PURGED"),
        /provider review pending/,
      );
      await review("PROVIDER_CLEANUP_CONFIRMED");
      await review("LOCAL_PAYLOAD_PURGED");
      assert.equal(
        (
          await sql`select ciphertext from commercial_billing.withdrawal_destination_payloads where destination=${destination}`
        )[0].ciphertext,
        null,
      );
      assert.equal(
        (
          await sql`select ciphertext_hash from commercial_billing.withdrawal_destinations where id=${destination}`
        )[0].ciphertext_hash,
        hash,
      );
      assert.equal(
        (await withdrawalAccountDeletionStatus(app, d.user, {}))?.pending,
        false,
      );
      assert.deepEqual(await finishAccountDeletion(app, d.user, {}), {
        pending: false,
      });
      assert.deepEqual(await finishAccountDeletion(app, d.user, {}), {
        pending: false,
      });
      assert.equal(
        (
          await sql`select count(*)::int n from private.audit_events where action='account_erasure_completed' and subject=${d.user}`
        )[0].n,
        1,
      );
      assert.equal(
        (
          await sql`select count(*)::int n from commercial_billing.withdrawals where id=${withdrawal}`
        )[0].n,
        1,
      );

      await sql`insert into commercial_billing.withdrawal_identity_checks(identity_id,checked_at,event_id)
        values(${identity},clock_timestamp(),'ISOLATED-LATE-PROVIDER-CHECK')`;
      assert.equal(
        (await withdrawalAccountDeletionStatus(app, d.user, {}))?.pending,
        true,
      );
      assert.equal(
        (
          await sql`select state from private.job_runs where dedupe_key=${"account-deletion:" + d.user}`
        )[0].state,
        "pending_review",
      );
      assert.equal(
        (
          await sql`select state from commercial_billing.withdrawal_provider_cleanup_intents where member_id=${d.user}`
        )[0].state,
        "queued",
      );

      // An account that never used withdrawals keeps the existing erasure path.
      await sql`select private.disable_account(${owner})`;
      assert.equal(await withdrawalAccountDeletionStatus(app, owner, {}), null);
      assert.deepEqual(await finishAccountDeletion(app, owner, {}), {
        pending: false,
      });
    } finally {
      await app?.end();
      await d.pg.close();
    }
  },
);
