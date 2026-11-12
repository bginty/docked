/** Existing Preview only. Preserves all Production and pre-existing Preview records. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { commercialPolicyVersion } from "../src/core/commercial-billing";
import { rarityRule } from "../src/core/card-rarity";
const root = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const dir = "private-data/restored-public-preview";
const stateFile = dir + "/billing.private.json";
const out = "docs/qa/v30-customer-billing-20261102";
mkdirSync(out, { recursive: true });
const fixture = JSON.parse(readFileSync(dir + "/fixture.private.json", "utf8"));
const c = JSON.parse(
  readFileSync(root + "/private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(fixture.projectRef, c.projectRef);
assert.equal(new URL(c.databaseUrl).username, "postgres." + c.projectRef);
const sql = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function run() {
  try {
    const a = fixture.accounts.find(
      (v: { kind: string }) => v.kind === "member",
    );
    assert.match(
      a.email,
      /^docked-preview-public-member-[a-f0-9]+@example\.invalid$/,
    );
    const [member] =
      await sql`select u.id,u.email_confirmed_at,u.deleted_at,p.disabled_at,p.accepted_version from auth.users u join public.profiles p on p.id=u.id where u.email=${a.email}`;
    assert(
      member?.email_confirmed_at && !member.deleted_at && !member.disabled_at,
      "Existing confirmed ordinary QA member required",
    );
    const [counts] =
      await sql`select (select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from auth.users) users`;
    if (process.argv[2] === "inspect") {
      console.log(
        JSON.stringify({
          isolatedProject: c.projectRef,
          confirmedMember: true,
          counts,
          prepared: existsSync(stateFile),
        }),
      );
    } else if (process.argv[2] === "prepare") {
      assert(
        !existsSync(stateFile),
        "Existing acceptance must be recovered, never overwritten",
      );
      assert.deepEqual(
        [counts.receipts, counts.cards, counts.definitions],
        [0, 0, 0],
      );
      const until = new Date(Date.now() + 2 * 3600000).toISOString();
      const approvals = Object.fromEntries(
        [
          "owner",
          "legal",
          "googlePlay",
          "privacy",
          "retention",
          "refundRecovery",
          "playerRights",
          "supplyReconciliation",
        ].map((k) => [
          k,
          "ISOLATED TEST FIXTURE ONLY - no commercial approval asserted",
        ]),
      );
      Object.assign(approvals, {
        validUntil: until,
        withdrawals: false,
        prizes: false,
        paidEntry: false,
        nba: false,
      });
      const before = (
        await sql`select row_to_json(c) value from commercial_billing.control c where id`
      )[0].value;
      const definitions: string[] = [];
      await sql.begin(async (tx) => {
        await tx`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,transfers_enabled=false,policy_version=${commercialPolicyVersion},approvals=${tx.json(approvals)}`;
        await tx`update commercial_billing.products set approved=true`;
        for (const sport of ["nfl", "afl", "nrl"])
          for (let i = 0; i < 12; i++) {
            const player = randomUUID();
            for (const rarity of [
              "RARE",
              "ELITE",
              "ULTRA_RARE",
              "LEGENDARY",
              "ICON",
            ] as const) {
              const [d] =
                await tx`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},${sport},${rarity},${rarityRule(rarity).lifetimeCap!},true,'isolated-v30-synthetic-fixture',${tx.json({ name: `TEST ${sport.toUpperCase()} Player ${i + 1}`, synthetic: true, testInventory: true, team: "ISOLATED TEST", position: sport === "nfl" ? "QB" : sport === "afl" ? "MID" : "HLF", season: "ISOLATED TEST", verifiedJerseyNumber: null, colour: "#16345A", status: "active" })}) returning id`;
              definitions.push(d.id);
            }
          }
      });
      writeFileSync(
        stateFile,
        JSON.stringify(
          {
            projectRef: c.projectRef,
            member: member.id,
            email: a.email,
            until,
            before,
            definitions,
            closed: false,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      writeFileSync(
        out + "/prepared.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            project: c.projectRef,
            normalConfirmedQaMember: true,
            syntheticDefinitions: definitions.length,
            productionWrites: 0,
            livePaymentActivation: false,
            until,
          },
          null,
          2,
        ),
      );
      console.log(
        "Existing isolated Preview prepared; no Production writes, no receipt or card issued.",
      );
    } else if (process.argv[2] === "resume") {
      assert(existsSync(stateFile), "Recorded isolated acceptance required");
      const state = JSON.parse(readFileSync(stateFile, "utf8"));
      assert.equal(state.projectRef, c.projectRef);
      assert.equal(state.member, member.id);
      assert.equal(state.email, a.email);
      assert.equal(
        state.closed,
        true,
        "Only explicitly closed acceptance may resume",
      );
      assert.equal(state.definitions.length, 180);
      assert.equal(state.before.sales_enabled, false);
      assert.equal(state.before.issuance_enabled, false);
      assert.equal(state.before.transfers_enabled, false);
      const until = new Date(Date.now() + 2 * 3600000).toISOString();
      const approvals = Object.fromEntries(
        [
          "owner",
          "legal",
          "googlePlay",
          "privacy",
          "retention",
          "refundRecovery",
          "playerRights",
          "supplyReconciliation",
        ].map((k) => [
          k,
          "ISOLATED TEST FIXTURE ONLY - no commercial approval asserted",
        ]),
      );
      Object.assign(approvals, {
        validUntil: until,
        withdrawals: false,
        prizes: false,
        paidEntry: false,
        nba: false,
      });
      await sql.begin(async (tx) => {
        const [control] =
          await tx`select * from commercial_billing.control where id for update`;
        assert.equal(control.environment, "acceptance");
        assert.equal(control.sales_enabled, false);
        assert.equal(control.issuance_enabled, false);
        assert.equal(control.transfers_enabled, false);
        const [definitions] =
          await tx`select count(*)::int count from commercial_billing.definitions where id in ${tx(state.definitions)} and rights_reference='isolated-v30-synthetic-fixture'`;
        assert.equal(definitions.count, 180);
        // Renew only the bounded isolated configuration. Never reseed identities,
        // definitions, wallets, receipts, inventory or historical test events.
        await tx`update commercial_billing.control set sales_enabled=true,issuance_enabled=true,transfers_enabled=false,policy_version=${commercialPolicyVersion},approvals=${tx.json(approvals)} where id`;
      });
      const resumedAt = new Date().toISOString();
      writeFileSync(
        stateFile,
        JSON.stringify({ ...state, until, closed: false, resumedAt }, null, 2),
        { mode: 0o600 },
      );
      writeFileSync(
        out + "/acceptance-resumed.json",
        JSON.stringify(
          {
            at: resumedAt,
            until,
            project: c.projectRef,
            retainedCounts: counts,
            productionWrites: 0,
            livePaymentActivation: false,
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          resumed: true,
          until,
          retainedCounts: counts,
          productionWrites: 0,
        }),
      );
    } else if (process.argv[2] === "close") {
      assert(
        existsSync(stateFile),
        "Recorded acceptance configuration required",
      );
      const state = JSON.parse(readFileSync(stateFile, "utf8"));
      assert.equal(state.projectRef, c.projectRef);
      assert.equal(state.member, member.id);
      const before = state.before;
      assert.equal(before.sales_enabled, false);
      assert.equal(before.issuance_enabled, false);
      assert.equal(before.transfers_enabled, false);
      await sql.begin(async (tx) => {
        const [control] =
          await tx`select * from commercial_billing.control where id for update`;
        assert.equal(control.environment, "acceptance");
        // Close access, retaining every receipt, ledger, definition and issued card.
        // Repeated closure is safe and never refunds or rewrites financial state.
        await tx`update commercial_billing.control set sales_enabled=false,issuance_enabled=false,transfers_enabled=false,policy_version=${before.policy_version},approvals=${tx.json(before.approvals)} where id`;
        const [closed] =
          await tx`select sales_enabled,issuance_enabled,transfers_enabled from commercial_billing.control where id`;
        assert.deepEqual(closed, {
          sales_enabled: false,
          issuance_enabled: false,
          transfers_enabled: false,
        });
      });
      const closedAt = new Date().toISOString();
      writeFileSync(
        stateFile,
        JSON.stringify({ ...state, closed: true, closedAt }, null, 2),
        { mode: 0o600 },
      );
      writeFileSync(
        out + "/acceptance-closed.json",
        JSON.stringify(
          {
            at: closedAt,
            project: c.projectRef,
            sales: false,
            issuance: false,
            transfers: false,
            retainedCounts: counts,
            productionWrites: 0,
          },
          null,
          2,
        ),
      );
      console.log(
        "Isolated acceptance closed; all test audit and inventory records retained.",
      );
    } else throw Error("inspect, prepare, resume or close required");
  } finally {
    await sql.end();
  }
}
void run().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Isolated preparation failed; no credential output",
  );
  process.exitCode = 1;
});
