// Rollback-only real hosted database acceptance. No human transactions or grants.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { digest, results, importStatistics } from "../src/core/scoring-engine";
import { nflRarityRules } from "../src/core/scoring-v1";
import { rarityPoints } from "../src/core/card-rarity";
import { connectLockedNflEntries } from "../src/server/nfl-member-rounds";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet } from "../src/core/credits-sandbox";
async function main() {
  const sql = ownerDatabase(),
    report: any = {
      at: new Date().toISOString(),
      scope:
        "Hosted rollback-only ordinary AAL1 accounts; historical actual NFL statistics; synthetic correction; no genuine member results",
      checks: [],
      passed: false,
    };
  mkdirSync("docs/qa/rarity-round", { recursive: true });
  try {
    const fingerprint = async () =>
      digest(
        await sql`select (select document from credits_sandbox.state where id) wallet,(select jsonb_agg(to_jsonb(e) order by id) from beta_fantasy.entries e) entries,(select count(*) from auth.users) accounts,(select sum(issued) from beta_fantasy.editions) issued`,
      );
    const before = await fingerprint();
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`select pg_advisory_xact_lock(71820342)`;
          if (!process.argv.includes("--installed"))
            await tx.unsafe(
              readFileSync(
                "supabase/migrations/20261012120429_nfl_rarity_member_rounds.sql",
                "utf8",
              ),
            );
          const [originalDelegate] =
            await tx`select pg_get_functiondef('beta_fantasy.production_command_before_rarity(text,jsonb,uuid)'::regprocedure) body`;
          if (
            !(
              await tx`select 1 from supabase_migrations.schema_migrations where version='20261012123000'`
            ).length
          )
            await tx.unsafe(
              readFileSync(
                "supabase/migrations/20261012123000_nfl_rarity_core_identity.sql",
                "utf8",
              ),
            );
          assert.equal(
            (
              await tx`select pg_get_functiondef('beta_fantasy.production_command_before_rarity(text,jsonb,uuid)'::regprocedure) body`
            )[0].body,
            originalDelegate.body,
          );
          const db: any = new Proxy(tx, {
            get(t, k) {
              if (k === "begin") return (fn: any) => t.savepoint(fn);
              const v = Reflect.get(t, k);
              return typeof v === "function" ? v.bind(t) : v;
            },
          });
          const [control] =
            await tx`select policy_versions from beta_private.admission_control where id`;
          const users = Array.from({ length: 2 }, () => ({
            id: randomUUID(),
            session: randomUUID(),
            token: randomBytes(32).toString("hex"),
          }));
          const context = async (u: any) =>
            tx`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u.id, session_id: u.session, aal: "aal1" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
          for (const u of users) {
            const email = `rarity-rollback-${u.id}@example.invalid`;
            await tx`insert into auth.users(id,email,email_confirmed_at,is_anonymous,aud,role,created_at,updated_at) values(${u.id},${email},clock_timestamp(),false,'authenticated','authenticated',clock_timestamp(),clock_timestamp())`;
            await tx`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(${u.session},${u.id},clock_timestamp(),clock_timestamp(),'aal1')`;
            await tx`insert into beta_private.friends_roster(user_id,email,enabled,authority) values(${u.id},${email},true,'ROLLBACK ONLY; never invited')`;
            await tx`select beta_private.reserve_admission(${email},${u.id},${createHash("sha256").update(u.token).digest("hex")},${randomUUID()},clock_timestamp()+interval '1 hour','rollback-qa')`;
            await tx`select beta_private.accept_admission(${u.token},${u.id},${u.session},'AU','VIC',true,${tx.json(control.policy_versions)})`;
            await tx`insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values(${u.id},'AU','VIC',true,${control.policy_versions.terms})`;
            await tx`insert into beta_private.consent_events(user_id,purpose,granted,version,actor) values(${u.id},'privacy',true,${control.policy_versions.privacy},'rollback-qa')`;
            await tx`insert into beta_fantasy.members(user_id,expires_at) values(${u.id},'infinity')`;
            await tx`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note) values(${u.id},'tester','Rollback QA',true,'Rollback acceptance only')`;
          }
          const [prior] =
            await tx`select body,raw_id from sports_feed.journal where stream_id='beta-real:qa:nfl-atl-pit-2026' order by revision desc limit 1`;
          assert.ok(
            prior?.raw_id,
            "Existing authorised historical acceptance required",
          );
          const original = prior.body.sources.at(-1);
          const providers = original.players.map((p: any) =>
            p.playerId.replace("gsis:", ""),
          );
          const pool =
            await tx`select p.id player_id,p.provider_id,r.position,r.status from credits_sandbox.permanent_players p join credits_sandbox.current_player_status r on r.id=p.id where p.provider_id=any(${providers})`;
          assert.equal(pool.length, 7);
          assert.ok(pool.every((p) => p.status === "ACT"));
          const [stateRow] =
            await tx`select document from credits_sandbox.state where id for update`;
          const state = stateRow.document;
          const keep = new Set(pool.map((p) => p.player_id));
          for (const p of Object.values(state.economy.players) as any[])
            if (keep.size < 9 && p.status === "active") keep.add(p.id);
          for (const p of Object.values(state.economy.players) as any[])
            p.status = keep.has(p.id) ? "active" : "inactive";
          await tx`update credits_sandbox.state set document=${tx.json(state)} where id`;
          const credits = new CreditsSandboxStore(db),
            lineups: string[][] = [];
          for (const u of users) {
            await credits.execute(
              { id: "rollback-reviewer", role: "reviewer", aal: "aal2" },
              randomUUID(),
              {
                kind: "promotion",
                member: u.id,
                amount: 1800,
                campaign: "rarity-rollback",
                reason: "Dedicated rollback-only ordinary member fixture",
                confirmed: true,
                redeemable: false,
              },
            );
            const req = randomUUID(),
              command = {
                kind: "buy-pack",
                product: "standard-nine-test-v1",
                configuration: "standard-nine-test-v1",
                policy: state.policy.version,
                confirmed: true,
              };
            const receipt = await credits.execute(
              { id: u.id, role: "member" },
              req,
              command,
            );
            assert.deepEqual(
              await credits.execute({ id: u.id, role: "member" }, req, command),
              receipt,
            );
            assert.equal(wallet(await credits.read(), u.id).spendable, 900);
            await credits.execute({ id: u.id, role: "member" }, randomUUID(), {
              kind: "open-pack",
              entitlement: req,
            });
            const cards = (await credits.read()).economy!.packs[req].cards;
            assert.equal(cards.length, 9);
            const s = await credits.read();
            lineups.push(
              cards.filter((id) =>
                pool.some(
                  (p) => p.player_id === s.economy!.instances[id].playerId,
                ),
              ),
            );
            assert.equal(lineups.at(-1)!.length, 7);
          }
          report.checks.push(
            "Two ordinary QA accounts: nine-card purchases, same-request recovery, one debit, persisted opening",
          );
          const stream = "beta-real:qa:rarity-" + randomUUID(),
            comp = randomUUID(),
            fixture = stream + ":game";
          const deadline = new Date(
            (await tx`select clock_timestamp()+interval '25 seconds' as at`)[0]
              .at,
          ).toISOString();
          const scoring = {
            ...structuredClone(prior.body),
            period: {
              ...prior.body.period,
              id: stream,
              inventoryScope: "invited-nfl-test-v2",
              label: "HISTORICAL RARITY REPLAY · TEST LINEUPS · NO REWARDS",
              locksAt: deadline,
              rules: nflRarityRules(),
              fixtures: [
                {
                  id: fixture,
                  scheduledAt: deadline,
                  playerIds: pool.map((p) => p.player_id),
                },
              ],
            },
            entries: [],
            sources: [],
            lineupsLockedAt: null,
            finalisedAt: null,
            audits: [
              {
                sequence: 1,
                actor: "rollback-qa",
                action: "replay-created",
                at: new Date().toISOString(),
                reason:
                  "Historical replay with synthetic clock, not a genuine round",
                payloadHash: digest(pool),
              },
            ],
          };
          const feed = new SportsFeedStore(db);
          await feed.create(scoring);
          await tx`insert into beta_fantasy.scoring_rules(version,rules) values(${scoring.period.rules.version},${tx.json(scoring.period.rules)}) on conflict do nothing`;
          await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize) values(${comp},${scoring.period.label},'nfl','2026',999,${deadline},${tx.json({ postgame: true, duplicates: false, inventory_scope: "invited-nfl-test-v2", rarity_version: scoring.period.rules.rarityVersion })},(select id from beta_fantasy.scoring_rules where version=${scoring.period.rules.version}),'[]','No cash prize')`;
          await tx`insert into beta_fantasy.production_rounds values(${comp})`;
          await tx`insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures) values(${comp},${stream},'member',${tx.json([{ playerIds: pool.map((p) => p.player_id) }])})`;
          const save = async (
            u: any,
            cards: string[],
            request = randomUUID(),
          ) => {
            await context(u);
            return (
              await tx`select beta_fantasy.production_command('save_lineup',${tx.json({ competition_id: comp, cards })},${request}) r`
            )[0].r;
          };
          for (let i = 0; i < 2; i++) {
            const req = randomUUID();
            const first = await save(users[i], lineups[i], req);
            assert.deepEqual(await save(users[i], lineups[i], req), first);
          }
          const reject = async (
            fn: () => Promise<unknown>,
            pattern: RegExp,
          ) => {
            await assert.rejects(
              () =>
                tx.savepoint(async () => {
                  await fn();
                }),
              pattern,
            );
          };
          await reject(() => save(users[1], lineups[0]), /owned|eligible/i);
          const corePlayer = pool.find((p) => p.position === "RB")!;
          const [coreDefinition] =
            await tx`select n.player_id,n.edition_id from sports_feed.nfl_players n where provider_id=${corePlayer.provider_id}`;
          const coreCard = randomUUID();
          await tx`insert into beta_fantasy.cards(id,edition_id,owner_id,serial,tradeable) select ${coreCard},${coreDefinition.edition_id},${users[0].id},coalesce(max(serial),0)+1,false from beta_fantasy.cards where edition_id=${coreDefinition.edition_id}`;
          const stateForCore = await credits.read();
          const samePlayerCard = lineups[0].find(
            (id) =>
              stateForCore.economy!.instances[id].playerId ===
              corePlayer.player_id,
          )!;
          await save(
            users[0],
            lineups[0].map((id) => (id === samePlayerCard ? coreCard : id)),
          );
          const [coreSnapshot] =
            await tx`select snapshot from beta_fantasy.entries where user_id=${users[0].id} and competition_id=${comp}`;
          assert.ok(
            coreSnapshot.snapshot.some(
              (c: any) =>
                c.card_id === coreCard &&
                c.player_id === corePlayer.player_id &&
                c.multiplierTenths === 10,
            ),
          );
          const [coreView] =
            await tx`select beta_fantasy.production_read_state() s`;
          assert.equal(
            coreView.s.cards.find((c: any) => c.id === coreCard)
              .canonical_player_id,
            corePlayer.player_id,
          );
          // Two RB instances for the same real player still satisfy slot counts but must fail identity uniqueness.
          const anotherRb = lineups[0].find(
            (id) =>
              id !== samePlayerCard &&
              pool.find(
                (p) =>
                  p.player_id === stateForCore.economy!.instances[id].playerId,
              )?.position === "RB",
          )!;
          await reject(
            () =>
              save(
                users[0],
                lineups[0].map((id) => (id === anotherRb ? coreCard : id)),
              ),
            /one card per mapped player/,
          );
          await save(users[0], lineups[0]);
          report.checks.push(
            "Core/limited same-player aliases: valid Core coverage maps to permanent identity, duplicate real player rejected; old free command unchanged",
          );
          await reject(
            () => save(users[0], [...lineups[0].slice(0, 6), lineups[0][0]]),
            /distinct/,
          );
          // Real transfer command reaches the database guard, then rolls back everything.
          const list = String(randomUUID());
          await credits.execute({ id: users[0].id, role: "member" }, list, {
            kind: "list",
            card: lineups[0][0],
            price: 100,
          });
          const beforeBuy = digest(await credits.read());
          await reject(
            () =>
              credits.execute(
                { id: users[1].id, role: "member" },
                randomUUID(),
                {
                  kind: "buy",
                  listing: list,
                  expectedPrice: 100,
                  policy: state.policy.version,
                  confirmed: true,
                },
              ),
            /committed|unsettled/,
          );
          assert.equal(digest(await credits.read()), beforeBuy);
          await credits.execute(
            { id: users[0].id, role: "member" },
            randomUUID(),
            { kind: "cancel-listing", listing: list },
          );
          report.checks.push(
            "Ownership/duplicate rejection; saved-team transfer denied atomically before deadline; reopened snapshots retain rarity and multiplier",
          );
          const remaining = Number(
            (
              await tx`select greatest(0,extract(epoch from (${deadline}::timestamptz-clock_timestamp()))*1000)::int ms`
            )[0].ms,
          );
          await new Promise((r) => setTimeout(r, remaining + 200));
          assert.equal(await connectLockedNflEntries(db, stream), true);
          await reject(() => save(users[0], lineups[0]), /locked/);
          const lockedListing = randomUUID();
          await credits.execute(
            { id: users[0].id, role: "member" },
            lockedListing,
            { kind: "list", card: lineups[0][0], price: 100 },
          );
          const lockedWallet = digest(await credits.read());
          await reject(
            () =>
              credits.execute(
                { id: users[1].id, role: "member" },
                randomUUID(),
                {
                  kind: "buy",
                  listing: lockedListing,
                  expectedPrice: 100,
                  policy: state.policy.version,
                  confirmed: true,
                },
              ),
            /committed|unsettled/,
          );
          assert.equal(digest(await credits.read()), lockedWallet);
          report.checks.push(
            "After-lock complete transfer transaction rejected by database guard; wallet and locked lineup preserved",
          );
          const source = structuredClone(original);
          source.fixtureId = fixture;
          source.observedAt = new Date().toISOString();
          source.players = source.players.map((p: any) => ({
            ...p,
            playerId: pool.find(
              (x) => x.provider_id === p.playerId.replace("gsis:", ""),
            )!.player_id,
          }));
          const approval = {
            provider: "nflverse",
            competition: "NFL",
            intendedUse: "isolated-free-beta",
            fantasyUse: true,
            storage: true,
            evidence:
              "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md",
            reviewExpires: "2026-11-10T00:00:00Z",
            maxAgeSeconds: 86400,
          };
          const scored = await feed.change(
            stream,
            (s) =>
              importStatistics(
                s,
                source,
                { id: "rollback-qa", role: "reviewer" },
                source.observedAt,
                "Historical actual-data replay, not genuine entry",
                approval,
              ),
            prior.raw_id,
          );
          const scoredRows = results(scored).rows;
          for (const row of scoredRows) {
            assert.equal(row.players.length, 7);
            assert.ok(row.centipoints !== null);
            for (const p of row.players)
              assert.equal(
                p.centipoints,
                rarityPoints(p.baseCentipoints!, p.multiplierTenths!),
              );
          }
          for (const u of users) {
            await context(u);
            const s = (
              await tx`select beta_fantasy.production_read_state() s`
            )[0].s;
            assert.equal(
              s.round_details.find((r: any) => r.competition_id === comp).cards
                .length,
              7,
            );
            assert.equal(
              s.results.find((r: any) => r.competition_id === comp).score,
              scoredRows.find((r) => r.member === u.id)!.centipoints! / 100,
            );
            assert.equal(
              (await tx`select sports_feed.nfl_standings() s`)[0].s.find(
                (r: any) => r.competitionId === comp,
              ).rows.length,
              2,
            );
          }
          const locked = digest(scored.entries),
            originalHash = digest(scored.sources[0]);
          source.revision++;
          source.observedAt = new Date().toISOString();
          source.players.find(
            (p: any) =>
              pool.find((x) => x.player_id === p.playerId)?.position === "QB",
          ).stats.passing_yards++;
          const corrected = await feed.change(
            stream,
            (s) =>
              importStatistics(
                s,
                source,
                { id: "rollback-qa", role: "reviewer" },
                source.observedAt,
                "Synthetic one-yard correction in rollback-only replay",
                approval,
              ),
            prior.raw_id,
          );
          assert.equal(digest(corrected.entries), locked);
          assert.equal(digest(corrected.sources[0]), originalHash);
          assert.notDeepEqual(
            results(corrected).rows.map((r) => r.centipoints),
            scoredRows.map((r) => r.centipoints),
          );
          report.replay = scoredRows.map((r) => ({
            base: r.players.reduce((n, p) => n + p.baseCentipoints!, 0) / 100,
            weighted: r.centipoints! / 100,
            players: r.players.map((p) => ({
              rarity: p.rarity,
              multiplier: p.multiplier,
              base: p.baseCentipoints! / 100,
              points: p.centipoints! / 100,
            })),
          }));
          report.checks.push(
            "Durable deadline lock; real historical player statistics -> locked multipliers -> own breakdowns and shared standings; synthetic correction appended with original rules and snapshots preserved",
          );
          throw Error("ROLLBACK_ACCEPTANCE");
        }),
      /ROLLBACK_ACCEPTANCE/,
    );
    assert.equal(await fingerprint(), before);
    report.passed = true;
    console.log(report);
  } catch (e: any) {
    console.error({
      databaseError: e.actual?.message,
      where: e.actual?.where,
      position: e.actual?.position,
      internalQuery: e.actual?.internalQuery,
    });
    report.error = e.message;
    console.error(e);
    process.exitCode = 1;
  } finally {
    await sql.end();
    writeFileSync(
      "docs/qa/rarity-round/hosted-replay.json",
      JSON.stringify(report, null, 2),
    );
  }
}
void main();
