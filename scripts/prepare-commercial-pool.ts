/** Production inspection is READ ONLY. Writes a dormant candidate file locally;
 * no hosted import, product approval, inventory, wallet or feature activation. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  dormantCommercialPool,
  poolPlanVersion,
  poolRosterCandidate,
  reconcileExcludedTestSupply,
  type PoolRosterCandidate,
} from "../src/core/commercial-pool-plan";
import { isRosterBetaPlayer } from "../src/core/roster-beta";
import type { EconomyPlayer } from "../src/core/card-economy";
import { jerseyPresentation } from "../src/core/card-presentation";
import {
  teamColourCatalogue,
  teamColours,
} from "../src/core/sport-team-colours";
import { officialTeams } from "../src/core/official-roster-refresh";
import {
  nflPoolPositions,
  parsePoolOutputTag,
  readDatedPoolInputs,
  selectStablePoolIdentities,
  sourceSha256 as sha,
} from "./roster-refresh-20261106/pool-source-inputs";

assert.equal(process.argv[2], "--plan-production-read-only");
const root = process.cwd();
const argNames = [
  "--output-tag",
  "--nfl-inputs",
  "--nfl-manifest",
  "--aus-inputs",
  "--aus-manifest",
];
const args = process.argv.slice(3);
const params = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  const [name, value] = args.slice(index, index + 2);
  assert(
    argNames.includes(name) && value && !params.has(name),
    "Invalid dated-input arguments",
  );
  params.set(name, value);
}
assert(
  params.size === 0 || params.size === argNames.length,
  "All dated inputs and manifests are required; no stale fallback",
);
const dated = params.size > 0;
const tag = params.get("--output-tag") ?? "20261105";
const outputTag = parsePoolOutputTag(tag);
assert(
  !dated || outputTag.dateTag > "20261105",
  "Preserve the original November 5 artifacts; use a later date",
);
const output = path.join(root, `private-data/commercial-pool-${tag}`);
const evidence = path.join(root, `docs/qa/commercial-pool-${tag}`);
const candidatePath = path.join(output, "candidate.private.json");
const planPath = path.join(evidence, "plan.json");
if (dated)
  assert(
    !existsSync(candidatePath) && !existsSync(planPath),
    "Dated candidate artifacts are immutable; use a new tag for a new generation",
  );
const observedAt = Date.now();
const sources = dated
  ? (
      [
        ["nfl", "--nfl-inputs", "--nfl-manifest"],
        ["wikimedia", "--aus-inputs", "--aus-manifest"],
      ] as const
    ).map(([group, inputArg, manifestArg]) => {
      const inputFile = params.get(inputArg)!;
      const manifestFile = params.get(manifestArg)!;
      return {
        group,
        manifestFile: path
          .relative(root, path.resolve(manifestFile))
          .replaceAll("\\", "/"),
        ...readDatedPoolInputs(
          group,
          readFileSync(inputFile),
          readFileSync(manifestFile),
          observedAt,
        ),
      };
    })
  : null;
const localPlayers = sources?.flatMap((source) => source.players) ?? [];
// Never read the old Australian dataset for a current-source generation.
const bytes = dated
  ? null
  : readFileSync(
      path.join(
        root,
        "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
      ),
    );
const dataset = bytes ? JSON.parse(bytes.toString()) : null;
const jerseys = dated
  ? null
  : JSON.parse(
      readFileSync(
        path.join(root, "config/roster-jersey-presentation-v1.json"),
        "utf8",
      ),
    );
async function main() {
  const ownerBase = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
  const sql = (() => {
    process.chdir(ownerBase);
    try {
      return ownerDatabase();
    } finally {
      process.chdir(root);
    }
  })();
  try {
    const captured = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const allowedNflPositions = dated
          ? nflPoolPositions
          : [...nflPoolPositions, "K"];
        const nfl =
          await tx`select p.id,p.name,p.position,r.team,p.colour,p.first_season,r.provider_id,r.source_url,r.source_hash,r.checked_at,j.verified_jersey_number from beta_fantasy.players p join nfl_roster.current_evidence r on r.player_id=p.id::text left join credits_sandbox.current_player_jerseys j on j.id=p.id::text where p.sport='nfl' and p.status='active' and r.identity_verified and r.status='active' and r.checked_at>current_timestamp-interval '72 hours' and r.checked_at<=current_timestamp and p.position=any(${tx.array(allowedNflPositions)}::text[]) and (p.position=any(string_to_array(r.position,'/')) or (p.position='RB' and r.position in ('HB','FB'))) order by p.id`;
        const known =
          dated && localPlayers.length
            ? await tx<
                {
                  id: string;
                  sport: string;
                  provider: string;
                  providerId: string;
                }[]
              >`
          select id, sport, provider, provider_id "providerId"
          from credits_sandbox.permanent_players
          where sport='nfl' and id=any(${tx.array(localPlayers.filter((p) => p.sport === "nfl").map((p) => p.id))}::text[])
          union all
          select identity->>'fixturePlayerId', identity->>'sport', identity->>'provider', identity->>'providerId'
          from credits_sandbox.nba_fixture_players
          where identity->>'sport' in ('afl','nrl') and identity->>'provider'='wikimedia'
            and identity->>'fixturePlayerId'=any(${tx.array(localPlayers.filter((p) => p.sport !== "nfl").map((p) => p.id))}::text[])
        `
            : [];
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
        return { nfl, known, excluded, gates };
      },
    );
    assert(captured.nfl.length > 100, "Verified mapped NFL roster unavailable");
    const checkedAt = new Date().toISOString();
    const baseline: PoolRosterCandidate[] = captured.nfl.map((p) =>
      poolRosterCandidate.parse({
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
      }),
    );
    const combined = dated
      ? selectStablePoolIdentities(baseline, localPlayers, [
          ...baseline,
          ...captured.known,
        ])
      : null;
    const players = combined?.players ?? [...baseline];
    for (const p of (dataset?.players ?? []) as EconomyPlayer[]) {
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
      version: outputTag.version,
      definitionIdNamespace: poolPlanVersion,
      capturedAt: checkedAt,
      projectRef,
      readOnly: true,
      productionWrites: 0,
      rows,
      reconciliation,
    };
    const planBytes = JSON.stringify(plan, null, 2) + "\n";
    const sports = ["nfl", "afl", "nrl"].map((sport) => {
      const p = players.filter((x) => x.sport === sport);
      const expected =
        sport === "nfl"
          ? Object.keys(officialTeams)
          : teamColourCatalogue
              .filter((t) => t.sport === sport)
              .map((t) => t.key);
      const seen = new Set(
        p.map((x) =>
          sport === "nfl"
            ? x.snapshot.team
            : teamColours(sport, x.snapshot.team)?.key,
        ),
      );
      assert(
        [...seen].every((key) => key && expected.includes(key)),
        "Unmapped stable team in candidate",
      );
      return {
        sport,
        players: p.length,
        definitions: p.length * 5,
        oldestSourceCheck: p.map((x) => x.source.checkedAt).sort()[0],
        newestSourceCheck: p
          .map((x) => x.source.checkedAt)
          .sort()
          .at(-1),
        teamCount: seen.size,
        expectedTeamCount: expected.length,
        representedTeams: [...seen].sort(),
        missingTeams: expected.filter((team) => !seen.has(team)).sort(),
        eligibilityCounts: Object.fromEntries(
          [...new Set(p.flatMap((x) => x.eligiblePositions))]
            .sort()
            .map((pos) => [
              pos,
              p.filter((x) => x.eligiblePositions.includes(pos)).length,
            ]),
        ),
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
      datasetSha256: bytes ? sha(bytes) : null,
      datedSourceMode: dated,
      sourceEvidence:
        sources?.map(
          ({ group, manifestFile, count, inputsSha256, manifestSha256 }) => ({
            group,
            manifestFile,
            count,
            inputsSha256,
            manifestSha256,
          }),
        ) ?? null,
      sourceCoverageIsNotCompleteCatalogue: true,
      publishedOctoberRosterUsed: !dated,
      baselineNflPlayers: baseline.length,
      identityHolds: combined?.holds ?? [],
      duplicateIdenticalInputsRemoved: combined?.duplicateCopies ?? 0,
      sourceAttribution: dated
        ? {
            nfl: "Existing official team factual roster observations; no statistics, likeness or trademark rights inferred",
            wikimedia:
              "English Wikipedia contributors (CC BY-SA 4.0); Wikidata identifiers (CC0). Source revisions, derivative changes, dates and excluded contexts are in the hashed source manifest.",
          }
        : null,
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
        dated
          ? "Review source manifests, held identities, missing team coverage and source age before permanent issuance"
          : "Dated AFL/NRL snapshot requires a current eligibility review before permanent issuance",
        "Review original artwork/source attribution and saved pool snapshot before immutable import",
        "Commercial control approval references, product approval, supply pool and activation remain separate",
      ],
    };
    assert(
      rows.every(
        (row) => !row.approved && row.issued === 0 && row.legacy_issued === 0,
      ),
    );
    mkdirSync(output, { recursive: true });
    mkdirSync(evidence, { recursive: true });
    writeFileSync(candidatePath, planBytes, {
      mode: 0o600,
      flag: dated ? "wx" : "w",
    });
    writeFileSync(planPath, JSON.stringify(result, null, 2) + "\n", {
      flag: dated ? "wx" : "w",
    });
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
