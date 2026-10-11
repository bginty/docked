// Two ordinary QA identities, all Auth/admission/holdings/round changes rolled back.
// This is real hosted SQL acceptance, not a browser login or future competitive result.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import friendsPacket from "../config/friends-policy-content.json" with { type: "json" };
import { transitionFriendsPolicy } from "./friends-policy-transition.mjs";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
import core from "../src/core/scoring-engine.ts";
import members from "../src/server/nfl-member-rounds.ts";
import storeMod from "../src/server/sports-feed-store.ts";
const { digest, importStatistics, results } = core,
  { connectLockedNflEntries } = members,
  { SportsFeedStore } = storeMod;
const sql = ownerDatabase(),
  app = ownerRuntimeDatabase();
const friendsPolicy = process.argv[2] === "--friends-policy-candidate";
assert.ok(
  process.argv.length <= 2 || (process.argv.length === 3 && friendsPolicy),
);
const report = {
  at: new Date().toISOString(),
  scope:
    "Hosted rollback-only two-user SQL acceptance. Real historical statistics, synthetic QA accounts and fixture clock; not browser sign-in or competitive results.",
  passed: false,
  checks: [],
  policyVersionTested: friendsPolicy
    ? friendsPacket.version
    : "existing hosted policy",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
const fingerprint = async () =>
  JSON.stringify(
    await sql`select (select count(*) from auth.users) users,(select count(*) from beta_fantasy.cards) cards,(select sum(issued) from beta_fantasy.editions) issued,(select count(*) from beta_private.admissions) admissions,(select count(*) from sports_feed.nfl_allocations) grants,(select count(*) from beta_fantasy.entries) entries,(select count(*) from fantasy.cards) commercial,
    (select policy_versions from beta_private.admission_control where id) policy_versions,
    (select jsonb_agg(to_jsonb(s)) from beta_fantasy.settings s) game_settings,
    (select md5(jsonb_agg(to_jsonb(c) order by to_jsonb(c)::text)::text) from beta_private.consent_events c) consent_digest,
    (select md5(jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text)::text) from beta_public.profiles p) profile_digest,
    (select count(*) from beta_private.audit_events where action='friends_policy_transition') policy_audits`,
  );
try {
  const before = await fingerprint();
  await assert.rejects(
    () =>
      sql.begin(async (tx) => {
        const db = new Proxy(tx, {
          get(t, k) {
            if (k === "begin") return (fn) => t.savepoint(fn);
            const v = Reflect.get(t, k);
            return typeof v === "function" ? v.bind(t) : v;
          },
        });
        if (friendsPolicy) {
          const auditBefore = Number(
            (
              await tx`select count(*) n from beta_private.audit_events where action='friends_policy_transition'`
            )[0].n,
          );
          const first = await transitionFriendsPolicy(tx, {
            actor: "rollback-qa",
            reason:
              "ROLLBACK ONLY new policy admission and gameplay acceptance",
          });
          assert.equal(first.changed, true);
          assert.equal(
            (
              await transitionFriendsPolicy(tx, {
                actor: "rollback-qa",
                reason: "ROLLBACK ONLY duplicate policy transition acceptance",
              })
            ).changed,
            false,
          );
          assert.equal(
            Number(
              (
                await tx`select count(*) n from beta_private.audit_events where action='friends_policy_transition'`
              )[0].n,
            ),
            auditBefore + 1,
          );
          report.checks.push(
            "Policy transition aligns admission and game versions atomically, audits once, and preserves historical consent",
          );
        }
        const [control] =
          await tx`select policy_versions from beta_private.admission_control where id`;
        await tx`update beta_private.friends_control set enabled=true,readiness_evidence='ROLLBACK ONLY hosted software acceptance; no external admission opened',approved_by='qa-operator',approved_at=clock_timestamp()`;
        await tx`update beta_private.admission_control set testers_enabled=true where id`;
        await tx`update beta_fantasy.swap_policy set enabled=true where id`;
        const users = Array.from({ length: 2 }, () => ({
          id: randomUUID(),
          session: randomUUID(),
          token: randomBytes(32).toString("hex"),
        }));
        const context = async (u) =>
          tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal: "aal1" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
        const cmd = async (u, action, p = {}) => {
          await context(u);
          return (
            await tx`select beta_fantasy.production_command(${action},${tx.json(p)},${randomUUID()}) r`
          )[0].r;
        };
        for (const [i, u] of users.entries()) {
          const email = `nfl-rollback-${u.id}@example.invalid`;
          await tx`insert into auth.users(id,email,email_confirmed_at,is_anonymous,aud,role,created_at,updated_at) values(${u.id},${email},clock_timestamp(),false,'authenticated','authenticated',clock_timestamp(),clock_timestamp())`;
          await tx`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(${u.session},${u.id},clock_timestamp(),clock_timestamp(),'aal1')`;
          await tx`insert into beta_private.friends_roster(user_id,email,enabled,authority) values(${u.id},${email},true,'ROLLBACK ONLY hosted acceptance identity; never invited')`;
          await tx`select beta_private.reserve_admission(${email},${u.id},${hash(u.token)},${randomUUID()},clock_timestamp()+interval '1 hour','rollback-qa')`;
          await tx`select beta_private.accept_admission(${u.token},${u.id},${u.session},'AU','VIC',true,${tx.json(control.policy_versions)})`;
          await tx`insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values(${u.id},'AU','VIC',true,${control.policy_versions.terms})`;
          await tx`insert into beta_private.consent_events(user_id,purpose,granted,version,actor)values(${u.id},'privacy',true,${control.policy_versions.privacy},'rollback-qa')`;
          const grant = await cmd(u, "claim_starter");
          assert.equal(grant.card_ids.length, 10);
          assert.deepEqual(
            (await cmd(u, "claim_starter")).card_ids,
            grant.card_ids,
          );
          const state = (
            await tx`select beta_fantasy.production_read_state() s`
          )[0].s;
          assert.equal(state.cards.length, 10);
          assert.equal(state.nfl_beta, true);
          report.checks.push(
            `Ordinary QA member ${i + 1} AAL1 admitted, ten real NFL cards allocated once, visible in own collection`,
          );
        }
        const swap = async (u, a, p = {}, req = randomUUID()) => {
          await context(u);
          return (
            await tx`select beta_fantasy.swap_command(${a},${tx.json(p)},${req}) r`
          )[0].r;
        };
        const denySwap = async (u, a, p, pattern) => {
          await tx
            .savepoint(async (sp) => {
              await context(u);
              await assert.rejects(
                () =>
                  sp`select beta_fantasy.swap_command(${a},${sp.json(p)},${randomUUID()})`,
                pattern,
              );
              throw Error("EXPECTED_DENIAL");
            })
            .catch((e) => assert.equal(e.message, "EXPECTED_DENIAL"));
        };
        await context(users[0]);
        const swapView = (await tx`select beta_fantasy.swap_read_state() s`)[0]
          .s;
        assert.equal(swapView.mode, "FRIENDS_CARD_SWAP");
        assert.equal(swapView.window.fee_cents, 0);
        assert.equal(swapView.reserves_granted, true);
        const own = swapView.cards.find((c) => c.owner_id === users[0].id),
          peer = swapView.cards.find((c) => c.owner_id === users[1].id);
        assert.ok(own && peer);
        const quote = {
          give_card: own.id,
          take_card: peer.id,
          fee_cents: 0,
          policy_revision: swapView.window.revision,
        };
        const cancel = await swap(users[0], "offer", quote);
        await swap(users[0], "cancel", { swap_id: cancel.swap_id });
        const offer = await swap(users[0], "offer", quote),
          stale = await swap(users[0], "offer", quote),
          request = randomUUID();
        const accepted = await swap(
          users[1],
          "accept",
          { swap_id: offer.swap_id, fee_cents: 0 },
          request,
        );
        assert.equal(accepted.state, "accepted");
        assert.deepEqual(
          await swap(
            users[1],
            "accept",
            { swap_id: offer.swap_id, fee_cents: 0 },
            request,
          ),
          accepted,
        );
        assert.equal(
          (
            await tx`select owner_id from beta_fantasy.cards where id=${own.id}`
          )[0].owner_id,
          users[1].id,
        );
        assert.equal(
          (
            await tx`select count(*)::int n from beta_fantasy.ownership_events where reference=${offer.swap_id}`
          )[0].n,
          2,
        );
        assert.equal(
          Number(
            (
              await tx`select coalesce(sum(amount_cents),0) n from beta_fantasy.swap_ledger where reference=${offer.swap_id}`
            )[0].n,
          ),
          0,
        );
        await denySwap(
          users[1],
          "accept",
          { swap_id: stale.swap_id, fee_cents: 0 },
          /ownership|stale/i,
        );
        await denySwap(
          users[0],
          "reserve_pack",
          {},
          /unavailable in the free NFL beta/,
        );
        report.checks.push(
          "Two ordinary members: zero-fee real NFL swap, cancellation, idempotent repeat acceptance, competing stale offer rejected, two ownership audit rows, no extra fictional packs",
        );
        const [prior] =
          await tx`select body,raw_id from sports_feed.journal where stream_id='beta-real:qa:nfl-atl-pit-2026' order by revision desc limit 1`;
        const oldSource = prior.body.sources.at(-1),
          gsis = oldSource.players.map((p) => p.playerId.replace("gsis:", ""));
        const pool =
          await tx`select np.*,p.position from sports_feed.nfl_players np join beta_fantasy.players p on p.id=np.player_id where np.provider_id=any(${gsis})`;
        assert.equal(pool.length, 7);
        const stream = "beta-real:qa:two-member-" + randomUUID(),
          fixture = stream + ":game",
          comp = randomUUID();
        const deadline = new Date(
          (
            await tx`select clock_timestamp()+interval '20 seconds' as instant`
          )[0].instant,
        ).toISOString();
        const state = structuredClone(prior.body);
        state.period = {
          ...state.period,
          id: stream,
          label:
            "ROLLBACK QA · historical statistics · not a member competition",
          locksAt: deadline,
          fixtures: [
            {
              id: fixture,
              playerIds: pool.map((p) => p.player_id),
              scheduledAt: deadline,
            },
          ],
        };
        state.entries = [];
        state.sources = [];
        state.lineupsLockedAt = null;
        state.audits = [
          {
            sequence: 1,
            actor: "rollback-qa",
            action: "qa-created",
            at: new Date().toISOString(),
            reason: "Synthetic acceptance clock only; always rolled back",
            payloadHash: digest(pool),
          },
        ];
        await new SportsFeedStore(db).create(state);
        await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize) values(${comp},'ROLLBACK QA','nfl','2026',999,${deadline},'{"postgame":true,"duplicates":false}',(select id from beta_fantasy.scoring_rules where version=${state.period.rules.version}),'[]','No cash prize')`;
        await tx`insert into beta_fantasy.production_rounds values(${comp})`;
        await tx`insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures) values(${comp},${stream},'member',${tx.json([{ playerIds: pool.map((p) => p.player_id) }])})`;
        // Dedicated temporary grants for the known completed-match acceptance lineup.
        const lineups = [];
        for (const u of users) {
          const cards = [];
          for (const p of pool) {
            cards.push(
              (
                await tx`select beta_fantasy.mint(${p.edition_id},${u.id},true,'ROLLBACK-QA-historical-lineup',${comp}) id`
              )[0].id,
            );
          }
          lineups.push(cards);
          await cmd(u, "save_lineup", { competition_id: comp, cards });
        }
        await tx
          .savepoint(async (sp) => {
            await context(users[1]);
            await assert.rejects(
              () =>
                sp`select beta_fantasy.production_command('save_lineup',${sp.json({ competition_id: comp, cards: lineups[0] })},${randomUUID()})`,
              /owned|NFL requires/i,
            );
            throw Error("EXPECTED_DENIAL");
          })
          .catch((e) => {
            assert.equal(e.message, "EXPECTED_DENIAL");
          });
        await new Promise((r) =>
          setTimeout(r, Math.max(0, Date.parse(deadline) - Date.now() + 50)),
        );
        for (let attempt = 0; attempt < 5; attempt++) {
          if (
            (
              await tx`select clock_timestamp()>=${deadline}::timestamptz due`
            )[0].due
          )
            break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        assert.equal(
          await connectLockedNflEntries(db, stream),
          true,
          "DB deadline reached and durable lock created",
        );
        await denySwap(
          users[0],
          "offer",
          {
            give_card: lineups[0][0],
            take_card: lineups[1][0],
            fee_cents: 0,
            policy_revision: swapView.window.revision,
          },
          /unsettled lineup/i,
        );
        const store = new SportsFeedStore(db);
        const source = structuredClone(oldSource);
        source.fixtureId = fixture;
        source.players = source.players.map((p) => ({
          ...p,
          playerId: pool.find(
            (r) => r.provider_id === p.playerId.replace("gsis:", ""),
          ).player_id,
        }));
        source.observedAt = new Date(
          (await tx`select clock_timestamp() at`)[0].at,
        ).toISOString();
        const approval = {
          provider: "nflverse",
          competition: "NFL",
          intendedUse: "isolated-free-beta",
          fantasyUse: true,
          storage: true,
          evidence:
            "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md",
          reviewExpires: "2026-11-10T00:00:00.000Z",
          maxAgeSeconds: 86400,
        };
        const scored = await store.change(
          stream,
          (s) =>
            importStatistics(
              s,
              source,
              { id: "ROLLBACK-QA", role: "reviewer" },
              source.observedAt,
              "Historical actual-data acceptance only",
              approval,
            ),
          prior.raw_id,
        );
        assert.equal(results(scored).rows.length, 2);
        assert.ok(
          results(scored).rows.every(
            (r) => r.centipoints === 7124 && r.rank === 1,
          ),
        );
        await context(users[0]);
        const read = (
          await tx`select beta_fantasy.production_read_state() s`
        )[0].s;
        assert.equal(
          read.results.find((r) => r.competition_id === comp).score,
          71.24,
        );
        assert.equal(
          read.round_details.find((r) => r.competition_id === comp).scores
            .length,
          7,
        );
        const stand = (
          await tx`select sports_feed.nfl_standings() s`
        )[0].s.find((s) => s.competitionId === comp);
        assert.equal(stand.rows.length, 2);
        const lockedHash = digest(scored.entries),
          firstHash = digest(scored.sources[0]);
        source.revision++;
        source.observedAt = new Date().toISOString();
        source.players.find(
          (p) => p.playerId === pool.find((r) => r.position === "QB").player_id,
        ).stats.passing_yards++;
        const corrected = await store.change(
          stream,
          (s) =>
            importStatistics(
              s,
              source,
              { id: "ROLLBACK-QA", role: "reviewer" },
              source.observedAt,
              "Synthetic one-yard correction; rollback only",
              approval,
            ),
          prior.raw_id,
        );
        assert.equal(digest(corrected.entries), lockedHash);
        assert.equal(digest(corrected.sources[0]), firstHash);
        assert.ok(results(corrected).rows.every((r) => r.centipoints === 7128));
        report.checks.push(
          "Two pre-deadline saved QA lineups locked; actual historical player breakdowns reconcile to 71.24 each; shared-rank standings; synthetic +0.04 correction appended without rewriting earlier lineup/source",
        );
        await tx
          .savepoint(async (sp) => {
            await assert.rejects(
              () =>
                sp`select beta_fantasy.production_command('save_lineup',${sp.json({ competition_id: comp, cards: lineups[0] })},${randomUUID()})`,
              /locked/i,
            );
            throw Error("EXPECTED_DENIAL");
          })
          .catch((e) => assert.equal(e.message, "EXPECTED_DENIAL"));
        report.checks.push(
          "Post-deadline save denied; all QA changes roll back",
        );
        throw Error("ROLLBACK_ACCEPTANCE");
      }),
    /ROLLBACK_ACCEPTANCE/,
  );
  assert.equal(await fingerprint(), before);
  for (const query of [
    "select * from sports_feed.nfl_allocations",
    "update beta_fantasy.cards set owner_id=owner_id",
    "select * from fantasy.cards",
  ])
    await assert.rejects(() => app.unsafe(query));
  report.passed = true;
  writeFileSync(
    friendsPolicy
      ? "docs/qa/friends-cutover/hosted-two-user-policy.json"
      : "docs/qa/nfl-member/hosted-two-user.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await sql.end();
  await app.end();
}
