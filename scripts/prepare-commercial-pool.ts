/** Production inspection is READ ONLY. Writes a dormant candidate file locally;
 * no hosted import, product approval, inventory, wallet or feature activation. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  dormantCommercialPool,
  reconcileExcludedTestSupply,
  type PoolRosterCandidate,
} from "../src/core/commercial-pool-plan";
import { isRosterBetaPlayer } from "../src/core/roster-beta";
import type { EconomyPlayer } from "../src/core/card-economy";
import { jerseyPresentation } from "../src/core/card-presentation";
import { teamColours } from "../src/core/sport-team-colours";

assert.equal(process.argv[2], "--plan-production-read-only");
const root = process.cwd();
const output = path.join(root, "private-data/commercial-pool-20261105");
const evidence = path.join(root, "docs/qa/commercial-pool-20261105");
mkdirSync(output, { recursive: true });
mkdirSync(evidence, { recursive: true });
const ausFile = path.join(
  root,
  "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
);
const bytes = readFileSync(ausFile);
const dataset = JSON.parse(bytes.toString());
const jerseys = JSON.parse(
  readFileSync(
    path.join(root, "config/roster-jersey-presentation-v1.json"),
    "utf8",
  ),
);
const ownerBase = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
process.chdir(ownerBase);
const sql = ownerDatabase();
process.chdir(root);
const sha = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
async function main() {
  try {
    const captured = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const nfl =
          await tx`select p.id,p.name,p.position,r.team,p.colour,p.first_season,r.provider_id,r.source_url,r.source_hash,r.checked_at,j.verified_jersey_number from beta_fantasy.players p join nfl_roster.current_evidence r on r.player_id=p.id::text left join credits_sandbox.current_player_jerseys j on j.id=p.id::text where p.sport='nfl' and p.status='active' and r.identity_verified and r.status='active' and r.checked_at>clock_timestamp()-interval '72 hours' and p.position in ('QB','RB','WR','TE','K') and (p.position=any(string_to_array(r.position,'/')) or (p.position='RB' and r.position in ('HB','FB'))) order by p.id`;
        const excluded =
          await tx`select p.sport,d.rarity,count(i.id)::int instances,count(*) filter(where r.document#>>'{product,status}'='TEST_ONLY')::int "matchedTestReceipts" from credits_sandbox.card_instances i join credits_sandbox.card_definitions d on d.id=i.definition join credits_sandbox.permanent_players p on p.id=d.player_id left join credits_sandbox.pack_receipts r on r.id=i.document->>'source' group by p.sport,d.rarity order by p.sport,d.rarity`;
        const [gates] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,policy_version,(select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.products where approved) approved_products from commercial_billing.control where id`;
        assert(
          gates &&
            !gates.sales_enabled &&
            !gates.issuance_enabled &&
            !gates.transfers_enabled,
        );
        assert.equal(
          gates.definitions,
          0,
          "Existing pool requires explicit immutable reconciliation",
        );
        assert.equal(gates.cards, 0);
        assert.equal(gates.receipts, 0);
        assert.equal(gates.approved_products, 0);
        return { nfl, excluded, gates };
      },
    );
    assert(captured.nfl.length > 100, "Verified mapped NFL roster unavailable");
    const checkedAt = new Date().toISOString();
    const players: PoolRosterCandidate[] = captured.nfl.map((p) => ({
      id: p.id,
      sport: "nfl",
      provider: "nflverse",
      providerId: p.provider_id,
      eligiblePositions: [p.position],
      snapshot: {
        name: p.name,
        team: p.team,
        position: p.position,
        season: "2026",
        verifiedJerseyNumber: p.verified_jersey_number ?? null,
        colour: jerseyPresentation({ sport: "nfl", team: p.team }).primary,
        status: "active",
        synthetic: false,
      },
      source: {
        url: p.source_url,
        hash: p.source_hash,
        checkedAt: new Date(p.checked_at).toISOString(),
        license: "factual-roster-observation; owner-confirmed-name-use",
        verification: "existing-identity-verified-active-official-roster",
        permanentIssuanceEligible: false,
      },
    }));
    for (const p of dataset.players as EconomyPlayer[]) {
      if (p.sport !== "afl" && p.sport !== "nrl") continue;
      assert(isRosterBetaPlayer(p));
      const source = p.rosterBeta!;
      const palette = teamColours(p.sport, p.currentTeam);
      assert(palette, "Existing stable team palette required");
      const jersey = jerseys[p.fixturePlayerId!];
      const number =
        p.sport === "afl" &&
        jersey?.sport === "afl" &&
        jersey.team === p.currentTeam &&
        /^\d{1,2}$/.test(jersey.number)
          ? Number(jersey.number)
          : null;
      players.push({
        id: p.fixturePlayerId!,
        sport: p.sport,
        provider: p.provider,
        providerId: p.providerId,
        eligiblePositions: p.eligiblePositions!,
        snapshot: {
          name: p.name,
          team: p.currentTeam,
          position: p.position,
          season: "2026",
          verifiedJerseyNumber: number,
          colour: palette.primary,
          accentColour: palette.accent,
          status: "active",
          synthetic: false,
        },
        source: {
          url: source.rosterSource,
          hash: source.sourceHash,
          checkedAt: source.verifiedAt,
          license: source.license,
          verification: source.verification,
          permanentIssuanceEligible: false,
        },
      });
    }
    const rows = dormantCommercialPool(players);
    const reconciliation = reconcileExcludedTestSupply(
      captured.excluded.map((row) => ({
        sport: String(row.sport),
        rarity: String(row.rarity),
        instances: Number(row.instances),
        matchedTestReceipts: Number(row.matchedTestReceipts),
      })),
    );
    const plan = {
      version: "dormant-real-player-pool-2026-11-05-v1",
      capturedAt: checkedAt,
      projectRef,
      readOnly: true,
      productionWrites: 0,
      rows,
      reconciliation,
    };
    const planBytes = JSON.stringify(plan, null, 2) + "\n";
    writeFileSync(path.join(output, "candidate.private.json"), planBytes, {
      mode: 0o600,
    });
    const sports = ["nfl", "afl", "nrl"].map((sport) => {
      const p = players.filter((x) => x.sport === sport);
      return {
        sport,
        players: p.length,
        definitions: p.length * 5,
        oldestSourceCheck: p.map((x) => x.source.checkedAt).sort()[0],
        newestSourceCheck: p
          .map((x) => x.source.checkedAt)
          .sort()
          .at(-1),
        teamCount: new Set(p.map((x) => x.snapshot.team)).size,
        verifiedNumbers: p.filter(
          (x) => x.snapshot.verifiedJerseyNumber !== null,
        ).length,
        sourcePermanentIssuanceApproved: false,
      };
    });
    const result = {
      at: checkedAt,
      projectRef,
      readOnly: true,
      productionWrites: 0,
      planSha256: sha(planBytes),
      datasetSha256: sha(bytes),
      sports,
      definitions: rows.length,
      approved: 0,
      issued: 0,
      coreDefinitions: 0,
      nbaDefinitions: 0,
      reconciliation,
      productionGates: captured.gates,
      activationBlockers: [
        "Every definition remains unapproved; source facts are not permanent issuance approval",
        "Dated AFL/NRL snapshot requires a current eligibility review before permanent issuance",
        "Review original artwork/source attribution and saved pool snapshot before immutable import",
        "Commercial control approval references, product approval, supply pool and activation remain separate",
      ],
    };
    writeFileSync(
      path.join(evidence, "plan.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Dormant pool inspection failed",
  );
  process.exitCode = 1;
});
