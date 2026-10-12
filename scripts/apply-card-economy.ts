// Additive operator migration in the existing nonwithdrawable test wallet only.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { initialCardEconomy } from "../src/core/card-economy";
import { nflEconomyCatalogue } from "../src/core/economy-catalogue";
import { rarityConfiguration } from "../src/core/card-rarity";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet";
import { digest } from "../src/core/scoring-engine";
async function main() {
  const mode = process.argv[2];
  assert.ok(["--inspect", "--prepare", "--activate", "--pause"].includes(mode));
  const sql = ownerDatabase(),
    file = "20261012101915_lifetime_card_economy.sql";
  const source = readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  mkdirSync("private-data/economy-v2", { recursive: true });
  mkdirSync("docs/qa/economy-v2", { recursive: true });
  try {
    const report = await sql.begin(async (tx) => {
      const [row] =
        await tx`select revision,document from credits_sandbox.state where id for update`;
      assertMemberTestEconomy(row.document);
      const before = structuredClone(row.document),
        state = structuredClone(before);
      const [inventory] =
        await tx`select (select count(*) from beta_fantasy.cards) beta_cards,(select count(*) from beta_fantasy.editions) legacy_editions,(select count(*) from sports_feed.nfl_players) mapped_players`;
      const protectedFingerprint = digest(before);
      const report: any = {
        at: new Date().toISOString(),
        projectRef,
        mode,
        migration: file,
        inventory,
        existingOrders: Object.keys(before.commerce.orders).length,
        existingEntitlements: Object.values(before.entitlements).map(
          (e: any) => e.status,
        ),
        existingCards: Object.keys(before.cards).length,
        existingEvents: before.events.length,
        protectedFingerprint,
        additionalHumanGrants: 0,
        realMoney: false,
      };
      if (mode === "--inspect") return report;
      assert.equal(
        JSON.parse(readFileSync("docs/qa/economy-v2/postgres.json", "utf8"))
          .passed,
        true,
      );
      const old =
        await tx`select statements from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
      if (old.length)
        assert.equal(
          digest(old[0].statements[0].replaceAll("\r\n", "\n")),
          digest(source),
        );
      else {
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},'lifetime_card_economy',${[source]})`;
      }
      if (!state.economy) {
        assert.equal(mode, "--prepare");
        writeFileSync(
          "private-data/economy-v2/pre-migration-state.json",
          JSON.stringify(before),
        );
        const players =
          await tx`select player_id id,provider_id from sports_feed.nfl_players`;
        const [roster] =
          await tx`select r.id,r.body,r.body_hash,c.checked_at from sports_feed.postgame_cache c join sports_feed.raw_revisions r on r.id=c.raw_id where r.body->>'dataset'='rosters' and r.expires_at>clock_timestamp() order by c.checked_at desc limit 1`;
        assert.ok(roster?.body?.rows);
        const catalogue = nflEconomyCatalogue(
          players as any,
          roster.body.rows,
          new Date(roster.checked_at).toISOString(),
          roster.id,
        );
        assert.ok(
          Date.now() - new Date(roster.checked_at).getTime() < 72 * 3600000,
          "Fresh roster required",
        );
        state.economy = initialCardEconomy(catalogue, Date.now());
        state.economy.enabled = false;
        const permit = JSON.parse(
          readFileSync("config/nfl-postgame-permit.json", "utf8"),
        );
        // The reviewed permit is a hard expiry, never extended implicitly by a build.
        const expiry = Date.parse(
          permit.expiresAt ?? permit.expires_at ?? permit.reviewExpiresAt,
        );
        assert.ok(
          Number.isFinite(expiry) && expiry > Date.now(),
          "Inspect exact permit expiry field",
        );
        for (const p of Object.values(state.economy.products) as any[])
          p.expiresAt = expiry;
        await tx`insert into credits_sandbox.rarity_configuration values(${rarityConfiguration.version},${tx.json(rarityConfiguration)}) on conflict do nothing`;
        for (const p of catalogue)
          await tx`insert into credits_sandbox.permanent_players values(${p.id},${p.sport},${p.provider},${p.providerId},${p.assetKind},${tx.json(p)})`;
        for (const p of Object.values(state.economy.products))
          await tx`insert into credits_sandbox.pack_configuration values(${(p as any).version},${tx.json(p as any)})`;
        report.catalogue = {
          players: catalogue.length,
          active: catalogue.filter((p) => p.status === "active").length,
          positions: Object.fromEntries(
            ["QB", "RB", "WR", "TE", "K"].map((pos) => [
              pos,
              catalogue.filter(
                (p) => p.position === pos && p.status === "active",
              ).length,
            ]),
          ),
          rawRevision: roster.id,
          hash: roster.body_hash,
          checkedAt: roster.checked_at,
        };
      }
      if (mode === "--activate") state.economy.enabled = true;
      if (mode === "--pause") state.economy.enabled = false;
      const unchanged = structuredClone(state);
      delete unchanged.economy;
      const oldProtected = structuredClone(before);
      delete oldProtected.economy;
      assert.equal(
        digest(unchanged),
        digest(oldProtected),
        "Existing balances, cards, receipts, requests and histories preserved",
      );
      if (digest(state) !== digest(before)) {
        const revision = Number(row.revision) + 1;
        await tx`insert into credits_sandbox.history(revision,actor,request,document) values(${revision},'owner-authorised-economy-migration',${"economy-v2-" + mode + "-" + revision},${tx.json(state)})`;
        await tx`update credits_sandbox.state set revision=${revision},document=${tx.json(state)} where id`;
        await tx`insert into beta_private.audit_events(actor,action,subject,details) values('owner-authorised-operator','economy_configuration',${mode},${tx.json({ before: digest(before), after: digest(state), reason: "NFL nine-card isolated test economy specification; no human grant or historical conversion" })})`;
      }
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          (
            await tx`select has_table_privilege(${role},'credits_sandbox.card_instances','select') allowed`
          )[0].allowed,
          false,
        );
      report.enabled = state.economy.enabled;
      report.protectedRecordsUnchanged = true;
      report.passed = true;
      return report;
    });
    writeFileSync(
      "docs/qa/economy-v2/" + mode.slice(2) + ".json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
