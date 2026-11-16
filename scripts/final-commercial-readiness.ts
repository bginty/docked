/** One read-only Production snapshot; no imports, grants, mutations or reset targets. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { custodyQuery } from "./lib/reviewed-inventory";
import { digest } from "../src/core/scoring-engine";
import { validateCredits } from "../src/core/credits-sandbox";
import {
  commercialPack,
  commercialSports,
} from "../src/core/commercial-billing";
import { hasRequiredPackSupply } from "../src/core/commercial-pack-supply";
import { packOdds } from "../src/core/pack-odds";
const root = process.cwd();
const evidenceArg = process.argv.find((arg) => arg.startsWith("--evidence="));
const evidencePath =
  evidenceArg?.slice("--evidence=".length) ??
  "docs/qa/final-commercial-20261116/commercial-readiness.json";
assert(/^docs\/qa\/[a-zA-Z0-9_/-]+\.json$/.test(evidencePath));
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const proposed = JSON.parse(
  readFileSync(
    "docs/qa/v31-revenue-launch-20261113/cards/current-eligibility-delta.NOT-APPROVED.json",
    "utf8",
  ),
);
const proposedIds = new Set<string>(proposed.proposedDefinitionIds);
assert.equal(proposedIds.size, 6055);
type Definition = {
  id: string;
  sport: string;
  player_id: string;
  rarity: string;
  lifetime_cap: number;
  issued: number;
  legacy_issued: number;
  approved: boolean;
  rights_reference: string;
  snapshot: unknown;
};
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const definitions = await tx<
          Definition[]
        >`select * from commercial_billing.definitions order by id`;
        const caps: Record<string, number> = {
          RARE: 5000,
          ELITE: 2500,
          ULTRA_RARE: 400,
          LEGENDARY: 50,
          ICON: 1,
        };
        assert.equal(
          new Set(
            definitions.map(
              (d) => d.sport + ":" + d.player_id + ":" + d.rarity,
            ),
          ).size,
          definitions.length,
        );
        for (const d of definitions) {
          assert.equal(d.lifetime_cap, caps[d.rarity]);
          assert(d.issued >= d.legacy_issued && d.issued <= d.lifetime_cap);
        }
        for (const id of proposedIds)
          assert(
            definitions.some((d) => d.id === id),
            "Proposed definition missing",
          );
        const [integrity] = await tx`select
    (select count(*)::int from beta_packs.issued) beta_allocations,
    (select count(*)::int from commercial_billing.cards) commercial_cards,
    (select count(*)::int from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from beta_packs.issued b where b.definition=d.id)+(select count(*) from commercial_billing.cards c where c.definition=d.id)) lifetime_mismatches,
    (select count(*)::int from (select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards) a join commercial_billing.definitions d on d.id=a.definition where a.serial<=d.legacy_issued or a.serial>d.issued or a.serial>d.lifetime_cap) invalid_later_serials,
    (select count(*)::int from (select definition,serial,count(*) from (select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards) a group by 1,2 having count(*)>1)b) duplicate_later_serials,
    (select count(*)::int from (select journal,sum(amount) from commercial_billing.lines group by journal having sum(amount)<>0) j) unbalanced_commercial_journals,
    (select count(*)::int from commercial_billing.jobs where kind='test' and state<>'done') unresolved_test_notifications,
    (select count(*)::int from public_gameplay.rounds where enabled or fixture_kind<>'practice') active_or_scored_rounds,
    (select count(*)::int from private.feature_flags where key='registration' and enabled) registration,
    (select count(*)::int from operations.retention_policy where enabled) deletion_enabled`;
        for (const key of [
          "lifetime_mismatches",
          "invalid_later_serials",
          "duplicate_later_serials",
          "unbalanced_commercial_journals",
          "unresolved_test_notifications",
          "active_or_scored_rounds",
          "registration",
          "deletion_enabled",
        ])
          assert.equal(integrity[key], 0, key);
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled,policy_version,approvals from commercial_billing.control where id`;
        assert(
          !control.sales_enabled &&
            !control.issuance_enabled &&
            !control.transfers_enabled &&
            !control.gameplay_enabled,
        );
        const [wallet] =
          await tx`select document from credits_sandbox.state where id`;
        validateCredits(wallet.document);
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        const rights =
          await tx`select sport,season,scope,count(*)::int grants,count(*)filter(where valid_from<=now() and (valid_until is null or valid_until>now()))::int within_time_window from season_catalogue.rights group by 1,2,3 order by 1,2,3`;
        const products =
          await tx`select id,credits,aud_cents,approved from commercial_billing.products order by id`;
        const groups = commercialSports.flatMap((sport) =>
          Object.keys(caps).map((rarity) => {
            const rows = definitions.filter(
              (d) =>
                proposedIds.has(d.id) &&
                d.sport === sport &&
                d.rarity === rarity,
            );
            return {
              sport,
              rarity,
              definitions: rows.length,
              players: new Set(
                rows
                  .filter((d) => d.issued < d.lifetime_cap)
                  .map((d) => d.player_id),
              ).size,
              consumed: rows.reduce((n, d) => n + d.issued, 0),
              remaining: rows.reduce(
                (n, d) => n + d.lifetime_cap - d.issued,
                0,
              ),
            };
          }),
        );
        const offers = commercialSports.flatMap((sport) =>
          (["STANDARD", "PREMIUM"] as const).flatMap((family) =>
            ([1, 3, 9] as const).map((size) => {
              const p = commercialPack(sport, family, size);
              return {
                id: p.id,
                sport,
                family,
                cards: p.cards,
                priceCredits: p.priceCredits,
                weights: p.weights,
                odds: packOdds(p),
                configurationHash: p.configurationHash,
                hypotheticalCapacityPass: hasRequiredPackSupply(
                  p,
                  groups.filter((g) => g.sport === sport),
                ),
                saleable: false,
              };
            }),
          ),
        );
        assert(offers.every((o) => o.hypotheticalCapacityPass));
        return {
          at: new Date().toISOString(),
          productionWrites: 0,
          counts: {
            definitions: definitions.length,
            lifetime: definitions.reduce((n, d) => n + d.issued, 0),
            legacy: definitions.reduce((n, d) => n + d.legacy_issued, 0),
            approvedForSale: definitions.filter((d) => d.approved).length,
            custody: custody.length,
          },
          countsAreResetTargets: false,
          integrity,
          custodyDigest: digest(custody),
          definitionsDigest: digest(definitions),
          permanentCaps: { CORE: "unlimited", ...caps },
          walletHashChainAndZeroSum: true,
          products,
          control: {
            ...control,
            approvals: undefined,
            approvalKeys: Object.keys(control.approvals),
          },
          seasonRights: rights,
          proposal: {
            sourceObservedAt: proposed.at,
            proposedEligible: proposedIds.size,
            held: definitions.length - proposedIds.size,
            eligibleIdDigest: digest([...proposedIds].sort()),
            immutableDefinitionDigest: digest(
              definitions
                .filter((d) => proposedIds.has(d.id))
                .map(
                  ({ issued: _issued, legacy_issued: _legacy, ...rest }) =>
                    rest,
                ),
            ),
            approved: false,
            note: "Preserves the existing conservative 6,055-ID proposal, not a new source eligibility approval. Historical current-roster comparison is outside its 72-hour window. Stable retained identities do not require a fake refresh; a reviewed commercial season/source permission must determine final inclusion. Free beta rights are not paid-sales permission.",
          },
          capacity: groups,
          offers,
        };
      },
    );
    const release = await fetch("https://docked.com.au/api/beta-release", {
      signal: AbortSignal.timeout(20000),
    }).then((r) => {
      assert(r.ok);
      return r.json();
    });
    writeFileSync(
      evidencePath,
      JSON.stringify({ ...result, release }, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        counts: result.counts,
        integrity: result.integrity,
        capacityOffers: result.offers.length,
        eligibleIdDigest: result.proposal.eligibleIdDigest,
        rights: result.seasonRights,
        release,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch(() => {
  console.error(
    "Read-only commercial assessment failed; no writes performed. Inspect queries before retry.",
  );
  process.exitCode = 1;
});
