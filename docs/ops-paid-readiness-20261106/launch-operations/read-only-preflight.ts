/** Bounded authorised read-only census. No claims, accounts, grants, purchases,
 * configuration changes, notices, migrations or Google Console calls. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "../../../scripts/owner-gameplay-db.mjs";
import { wallet, type CreditsState } from "../../../src/core/credits-sandbox";
import { publicPracticeLineup } from "../../../src/core/public-practice-configuration";
import type { PublicSport } from "../../../src/core/public-customer";
const root = process.cwd(),
  out = resolve("docs/ops-paid-readiness-20261106/launch-operations"),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au",
  source = "7319dddd1227b294fb38542cdee2044e01c89bd4";
function match(
  slots: { positions: string[] }[],
  players: { id: string; positions: string[] }[],
) {
  const assignments = new Map<string, number>();
  function place(slot: number, seen: Set<string>): boolean {
    for (const p of players) {
      if (
        seen.has(p.id) ||
        !p.positions.some((x) => slots[slot].positions.includes(x))
      )
        continue;
      seen.add(p.id);
      const prior = assignments.get(p.id);
      if (prior === undefined || place(prior, seen)) {
        assignments.set(p.id, slot);
        return true;
      }
    }
    return false;
  }
  let count = 0;
  for (let i = 0; i < slots.length; i++) if (place(i, new Set())) count++;
  return count;
}
async function mainRun() {
  const runtime = JSON.parse(
    readFileSync(
      "private-data/google-eligibility-20261105/production/" +
        source +
        "/resolved-runtime.private.json",
      "utf8",
    ),
  );
  const keys = [
    "REGISTRATION_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DOCKED_MULTI_SPORT_SANDBOX",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_PUBLIC_CUSTOMERS",
  ];
  for (const key of keys) assert.equal(runtime[key], "false", key);
  assert(
    !Object.keys(runtime).some((k) => k.startsWith("DOCKED_V30_TRANSPORT")),
  );
  const auth = JSON.parse(
    readFileSync(main + "/private-data/vercel-cli/auth.json", "utf8"),
  );
  const metaResponse = await fetch(
    "https://api.vercel.com/v13/deployments/docked.com.au?teamId=team_tf6xweKKyVCj9bTppUKttJ4l",
    {
      headers: { authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(metaResponse.ok);
  const deploy = await metaResponse.json();
  assert.equal(deploy.id, "dpl_2YxdbcCi584D1zQPVmyewM8QPxiQ");
  assert.equal(deploy.meta.githubCommitSha, source);
  assert.equal(deploy.readyState, "READY");
  const routes = [
    ["/api/beta-release", 200],
    ["/app/login", 200],
    ["/privacy", 200],
    ["/account-deletion", 200],
    ["/api/store/google/commercial", 403],
    ["/api/public-gameplay?sport=nfl", 403],
    ["/api/public-gameplay?sport=afl", 403],
    ["/api/public-gameplay?sport=nrl", 403],
    ["/api/public-gameplay?sport=basketball", 403],
    ["/profile/qa_billing", 503],
  ] as const;
  const http = await Promise.all(
    routes.map(async ([route, status]) => {
      const r = await fetch("https://docked.com.au" + route, {
        redirect: "manual",
        signal: AbortSignal.timeout(40000),
      });
      assert.equal(r.status, status, route);
      const text = await r.text();
      if (route === "/api/beta-release") {
        const v = JSON.parse(text);
        assert.equal(v.commit, source);
        assert.equal(v.publicRegistration, false);
      }
      if (route === "/privacy")
        assert(text.includes("2026-11-06-privacy-sdk-v3"));
      return { route, status: r.status };
    }),
  );
  process.chdir(main);
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const data = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='45s'`;
        const [context] =
          await tx`select clock_timestamp() as_of,current_user connection_role,current_setting('transaction_read_only') read_only`;
        assert.equal(context.read_only, "on");
        const [control] =
          await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled,policy_version from commercial_billing.control where id`;
        assert.equal(control.environment, "commercial");
        for (const k of [
          "sales_enabled",
          "issuance_enabled",
          "transfers_enabled",
          "gameplay_enabled",
        ])
          assert.equal(control[k], false);
        const [counts] =
          await tx`select(select count(*)::int from commercial_billing.definitions) definitions,(select count(*)::int from commercial_billing.definitions where approved) approved_definitions,(select coalesce(sum(issued),0)::int from commercial_billing.definitions) issued,(select coalesce(sum(legacy_issued),0)::int from commercial_billing.definitions) legacy_issued,(select count(*)::int from commercial_billing.accounts) accounts,(select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.packs) packs,(select count(*)::int from commercial_billing.journals) journals,(select count(*)::int from commercial_billing.lots) lots,(select count(*)::int from commercial_billing.recovery_cases) recoveries,(select count(*)::int from commercial_billing.listings) listings,(select count(*)::int from beta_fantasy.cards) legacy_beta_cards,(select count(*)::int from beta_fantasy.entries) historical_beta_entries,(select count(*)::int from credits_sandbox.card_instances) sandbox_instances`;
        for (const k of [
          "definitions",
          "approved_definitions",
          "issued",
          "legacy_issued",
          "accounts",
          "receipts",
          "cards",
          "packs",
          "journals",
          "lots",
          "recoveries",
          "listings",
        ])
          assert.equal(counts[k], 0, k);
        const products =
          await tx`select id,credits,aud_cents,version,approved from commercial_billing.products order by credits`;
        assert.equal(products.length, 2);
        assert(products.every((p) => !p.approved));
        const reviewer = "eea25d64-9f12-4d8b-be8b-a8d8818ce0ff";
        const [u] =
          await tx`select email_confirmed_at is not null confirmed,deleted_at is not null deleted from auth.users where id=${reviewer}`;
        assert(u?.confirmed && !u.deleted);
        const [state] =
          await tx`select document from credits_sandbox.state where id`;
        const w = wallet(state.document as CreditsState, reviewer);
        const [reviewerProfile] =
          await tx`select exists(select 1 from public.profiles where id=${reviewer} and disabled_at is null) ordinary_profile,exists(select 1 from beta_public.profiles where id=${reviewer} and disabled_at is null) beta_profile,(select count(*)::int from commercial_billing.cards where owner_id=${reviewer}) permanent_cards,(select count(*)::int from commercial_billing.receipts where member_id=${reviewer}) commercial_receipts`;
        assert.equal(w.total, 30000);
        assert.equal(w.withdrawable, 0);
        assert.equal(w.restricted, 30000);
        const [policy] =
          await tx`select enabled,terms_version,privacy_version,valid_until,version from public_gameplay.policy where id`;
        assert.equal(policy.enabled, false);
        assert.equal(policy.terms_version, "2026-11-02-release-preparation-v2");
        assert.equal(policy.privacy_version, "2026-11-06-privacy-sdk-v3");
        const sports =
          await tx`select sport,visible,play_enabled from public_gameplay.sports order by sport`;
        assert.deepEqual(
          sports.map((s) => s.sport),
          ["afl", "nfl", "nrl"],
        );
        assert(sports.every((s) => !s.visible && !s.play_enabled));
        const rounds =
          await tx`select c.id,c.name,c.sport,c.season,c.round,c.locks_at,c.locks_at>clock_timestamp() future,c.rules->>'mode' mode,c.rules,c.prize,c.awards,l.configuration,r.enabled,r.rules_hash=md5(c.rules::text) rules_match,r.fixture_kind,r.source_reference from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id join beta_fantasy.lineup_configurations l on l.version=c.rules->>'lineup_version' order by c.sport,mode`;
        assert.equal(rounds.length, 6);
        const eligible =
          await tx`select p.id::text id,r.sport,r.season,r.eligible_positions positions,r.valid_until from sports_feed.free_core_roster r join beta_fantasy.players p on p.id=r.player_id where r.active and r.valid_until>clock_timestamp() and p.status='active' union all select p.identity->>'fixturePlayerId',r.sport,r.season,r.eligible_positions,r.valid_until from sports_feed.free_core_roster_beta r join credits_sandbox.nba_fixture_players p on p.id=r.provider_player_id where r.active and r.valid_until>clock_timestamp() and p.identity->>'status'='active' and credits_sandbox.is_roster_beta_player(p.identity)`;
        const competitionReadiness = rounds.map((r) => {
          assert(r.future && !r.enabled && r.rules_match);
          assert.equal(r.fixture_kind, "practice");
          assert.equal(r.rules.entry_fee_credits, 0);
          assert.equal(r.rules.round_reward_policy.active, false);
          assert.deepEqual(r.rules.round_reward_policy.items, []);
          assert.deepEqual(r.awards, []);
          const config = publicPracticeLineup(r.sport as PublicSport);
          assert.deepEqual(r.configuration, config);
          const players = eligible.filter(
            (p) =>
              p.sport === r.sport &&
              p.season === r.season &&
              new Date(p.valid_until) > new Date(r.locks_at),
          );
          const merged = new Map<string, { id: string; positions: string[] }>();
          for (const p of players) {
            const old = merged.get(p.id);
            merged.set(p.id, {
              id: p.id,
              positions: [
                ...new Set([...(old?.positions ?? []), ...p.positions]),
              ],
            });
          }
          const complete = match(config.slots, [...merged.values()]);
          assert.equal(complete, config.slots.length);
          return {
            id: r.id,
            sport: r.sport,
            mode: r.mode,
            name: r.name,
            season: r.season,
            round: r.round,
            locksAt: r.locks_at,
            future: r.future,
            enabled: r.enabled,
            savedRulesMatch: r.rules_match,
            slots: config.slots.length,
            traditionalCap: r.mode === "SALARY_CAP" ? config.salaryCap : null,
            coreSalary: config.salaries.CORE,
            allCoreTotal: config.slots.length * config.salaries.CORE,
            entryFeeCredits: 0,
            awards: [],
            fixtureKind: r.fixture_kind,
            rosterCandidates: merged.size,
            uniquePositionMatch: complete,
            sourceReference: r.source_reference,
            eligibilityExpiresAt: players.reduce(
              (m, p) =>
                !m || new Date(p.valid_until) < new Date(m) ? p.valid_until : m,
              null,
            ),
          };
        });
        const regions =
          await tx`select state,approved,minimum_age,effective_from,effective_to,review_at,preview_community_only,review_at>clock_timestamp() review_current,effective_to>clock_timestamp() effective_current from private.region_policies where country='AU' and version='docked-au-adult-closed-loop-v1' order by state`;
        assert.equal(regions.length, 8);
        assert(
          regions.every(
            (r) =>
              r.approved &&
              r.minimum_age === 18 &&
              !r.preview_community_only &&
              r.review_current &&
              r.effective_current,
          ),
        );
        const [retention] =
          await tx`select p.enabled,p.completed_job_days,p.archive_days,(select count(*)::int from billing_retention.archives) archives,(select count(*)::int from billing_retention.holds where released_at is null) active_holds from billing_retention.policy p where id`;
        assert.equal(retention.enabled, false);
        const [ops] =
          await tx`select to_regprocedure('public.docked_billing_ops_enqueue()') is not null alert_enqueue_present,to_regprocedure('public.docked_billing_ops_queue(text,jsonb)') is not null alert_worker_present`;
        const [registration] =
          await tx`select enabled from private.feature_flags where key='registration'`;
        assert.equal(registration.enabled, false);
        return {
          context,
          control,
          counts,
          products,
          reviewer: {
            confirmed: u.confirmed,
            deleted: u.deleted,
            testWallet: {
              available: w.available,
              total: w.total,
              spendable: w.spendable,
              restricted: w.restricted,
              withdrawable: w.withdrawable,
            },
            ...reviewerProfile,
          },
          policy,
          sports,
          rounds: competitionReadiness,
          regions,
          retention,
          ops,
          registrationEnabled: registration.enabled,
        };
      },
    );
    const report = {
      checkedAt: new Date().toISOString(),
      project: "pojoymtniryarxxunyvz",
      canonical: { id: deploy.id, source, readyState: deploy.readyState },
      runtimeFlagEvidence:
        "exact deployed immutable runtime receipt plus live gate probes; no secret values or project-default substitutions",
      normalFlags: Object.fromEntries(keys.map((k) => [k, false])),
      namespace: {
        betaStaging: runtime.DOCKED_BETA_STAGING === "true",
        friendsBeta: runtime.DOCKED_FRIENDS_BETA === "true",
        releaseChannel: runtime.DOCKED_RELEASE_CHANNEL,
      },
      noTestTransport: true,
      customerVisibleSports: ["nfl", "afl", "nrl"],
      nbaCustomerHidden: true,
      http,
      ...data,
      scope: {
        productionWrites: 0,
        authSecretsRead: false,
        newCredentialsOrGrants: 0,
        googleTests: 0,
        consoleInteractions: 0,
        authenticatedBrowserAcceptance: false,
        newBackupOrRestore: false,
        claimsCreated: 0,
      },
      passed: true,
    };
    writeFileSync(
      out + "/production-readonly-preflight.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        passed: true,
        asOf: data.context.as_of,
        source,
        counts: data.counts,
        reviewerTestTotal: data.reviewer.testWallet.total,
        publicRounds: data.rounds.length,
        regions: data.regions.length,
        allPublicMappingsDisabled: true,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
mainRun().catch((e) => {
  writeFileSync(
    out + "/preflight-failure.txt",
    "Bounded preflight failed: " +
      e.name +
      "; no mutation attempted. Inspect private local diagnostic for details.\n",
  );
  writeFileSync(
    resolve("private-data/launch-ops-preflight-error.log"),
    String(e.stack),
    { mode: 0o600 },
  );
  console.error(
    "Bounded read-only preflight failed; private diagnostic retained",
  );
  process.exitCode = 1;
});
