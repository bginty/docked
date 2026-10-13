// Rollback-only real hosted database acceptance. No human transactions or grants.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { digest, results, importStatistics } from "../src/core/scoring-engine";
import { rarityPoints } from "../src/core/card-rarity";
import { connectLockedNflEntries } from "../src/server/nfl-member-rounds";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet } from "../src/core/credits-sandbox";
import { nflSeven, sevenRules } from "../src/core/nfl-seven";
async function main() {
  const sql = ownerDatabase(),
    report: any = {
      at: new Date().toISOString(),
      scope:
        "Hosted rollback-only ordinary AAL1 accounts; historical actual NFL statistics; synthetic correction; no genuine member results",
      checks: [],
      passed: false,
    };
  mkdirSync("docs/qa/seven-round", { recursive: true });
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
                "supabase/migrations/20261013064456_nfl_seven_slot_modes.sql",
                "utf8",
              ),
            );
          if (
            !(
              await tx`select 1 from supabase_migrations.schema_migrations where version='20261013073543'`
            ).length
          )
            await tx.unsafe(
              readFileSync(
                "supabase/migrations/20261013073543_nfl_seven_final_write_guard.sql",
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
          await tx`select set_config('docked.nfl_seven','enabled',true)`;
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
          await tx`insert into beta_fantasy.lineup_configurations values(${nflSeven.version},${tx.json(nflSeven)},clock_timestamp()) on conflict do nothing`;
          const stream = "beta-real:qa:seven-" + randomUUID(),
            comp = randomUUID(),
            fixture = stream + ":game",
            cap = randomUUID(),
            capStream = stream + ":cap";
          const deadline = new Date(Date.now() + 90000).toISOString(),
            late = new Date(Date.now() + 115000).toISOString(),
            early = pool.find((p) => p.position === "QB")!.player_id;
          const scoring = {
            ...structuredClone(prior.body),
            period: {
              ...prior.body.period,
              id: stream,
              inventoryScope: "invited-nfl-test-v2",
              lineupVersion: nflSeven.version,
              competitionMode: "OPEN",
              label: "HISTORICAL SEVEN REPLAY · TEST LINEUPS · NO REWARDS",
              locksAt: deadline,
              rules: sevenRules(),
              fixtures: [
                { id: fixture, scheduledAt: deadline, playerIds: [early] },
                {
                  id: fixture + ":late",
                  scheduledAt: late,
                  playerIds: pool
                    .filter((p) => p.player_id !== early)
                    .map((p) => p.player_id),
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
          for (const [cid, sid, mode] of [
            [comp, stream, "OPEN"],
            [cap, capStream, "SALARY_CAP"],
          ]) {
            const replay = {
              ...scoring,
              period: { ...scoring.period, id: sid, competitionMode: mode },
            };
            await feed.create(replay);
            await tx`insert into beta_fantasy.scoring_rules(version,rules) values(${replay.period.rules.version},${tx.json(replay.period.rules)}) on conflict do nothing`;
            await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize) values(${cid},${replay.period.label},'nfl','2026',999,${deadline},${tx.json({ postgame: true, duplicates: false, inventory_scope: "invited-nfl-test-v2", rarity_version: replay.period.rules.rarityVersion, scoring_version: replay.period.rules.version, lineup_version: nflSeven.version, mode })},(select id from beta_fantasy.scoring_rules where version=${replay.period.rules.version}),'[]','No cash prize')`;
            await tx`insert into beta_fantasy.production_rounds values(${cid})`;
            await tx`insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures) values(${cid},${sid},'member',${tx.json(replay.period.fixtures.map((f: any) => ({ ...f, fixtureId: f.id })))})`;
          }
          const reject = async (
            fn: () => Promise<unknown>,
            pattern: RegExp,
          ) => {
            report.lastRejection = String(pattern);
            await assert.rejects(() => tx.savepoint(fn), pattern);
          };
          const choose = async (u: any, ids: string[]) => {
            const inv = (
              await tx`select sports_feed.seven_inventory(${u.id}) i`
            )[0].i;
            const remaining = ids.map((id) =>
              inv.find((c: any) => c.id === id),
            );
            return nflSeven.slots.map((s) => {
              const i = remaining.findIndex(
                (c: any) => c && s.positions.includes(c.position),
              );
              assert.ok(i >= 0);
              return { slot: s.id, card: remaining.splice(i, 1)[0].id };
            });
          };
          const picks = [
            await choose(users[0], lineups[0]),
            await choose(users[1], lineups[1]),
          ];
          const cmd = async (
            u: any,
            action: string,
            cid: string,
            selections: any[],
            revision: number,
            request = randomUUID(),
          ) => {
            console.log("QA command", action, revision);
            await context(u);
            return (
              await tx`select beta_fantasy.production_command(${action},${tx.json({ competition_id: cid, selections, revision })},${request}) r`
            )[0].r;
          };
          const corePicks: any[][] = [];
          for (const u of users) {
            const cards: string[] = [];
            for (const player of pool) {
              const [def] =
                await tx`select edition_id from sports_feed.nfl_players where provider_id=${player.provider_id}`;
              const [mint] =
                await tx`select beta_fantasy.mint(${def.edition_id},${u.id},false,'rollback-seven-test',${u.id}) id`;
              cards.push(mint.id);
            }
            const inv = (
              await tx`select sports_feed.seven_inventory(${u.id}) i`
            )[0].i;
            corePicks.push(
              picks[users.indexOf(u)].map((p) => ({
                slot: p.slot,
                card: inv.find(
                  (c: any) =>
                    cards.includes(c.id) &&
                    c.player_id ===
                      inv.find((x: any) => x.id === p.card).player_id,
                ).id,
              })),
            );
          }
          for (let i = 0; i < 2; i++) {
            await cmd(users[i], "seven_draft", comp, picks[i].slice(0, 3), 0);
            await reject(
              () => cmd(users[i], "seven_draft", comp, picks[i], 0),
              /another window/,
            );
            await reject(
              () => cmd(users[i], "seven_enter", comp, picks[i].slice(0, 6), 0),
              /exactly seven/,
            );
            const req = randomUUID(),
              entered = await cmd(
                users[i],
                "seven_enter",
                comp,
                picks[i],
                0,
                req,
              );
            assert.deepEqual(
              await cmd(users[i], "seven_enter", comp, picks[i], 0, req),
              entered,
            );
            await cmd(users[i], "seven_draft", comp, [], 1);
            assert.equal(
              (
                await tx`select cardinality(cards) n from beta_fantasy.entries where competition_id=${comp} and user_id=${users[i].id}`
              )[0].n,
              7,
            );
            await cmd(users[i], "seven_enter", cap, corePicks[i], 0);
          }
          await reject(
            () => cmd(users[1], "seven_enter", comp, picks[0], 1),
            /Owned/,
          );
          await reject(
            () =>
              cmd(
                users[0],
                "seven_enter",
                comp,
                [
                  { ...picks[0][0], card: picks[0][1].card },
                  ...picks[0].slice(1),
                ],
                1,
              ),
            /position/,
          );
          const own = (
            await tx`select sports_feed.seven_inventory(${users[0].id}) i`
          )[0].i;
          const rbIdentity = own.find(
            (c: any) => c.id === corePicks[0][1].card,
          ).player_id;
          const rbAlias = own.find(
            (c: any) => c.player_id === rbIdentity && c.tier !== "CORE",
          );
          const duplicate = [...corePicks[0]];
          duplicate[2] = { slot: duplicate[2].slot, card: rbAlias.id };
          await reject(
            () => cmd(users[0], "seven_enter", cap, duplicate, 1),
            /underlying player/,
          );
          await reject(
            () =>
              cmd(
                users[0],
                "seven_enter",
                comp,
                picks[0].map((x, i) => (i ? x : { ...x, salary: 0 })),
                1,
              ),
            /Only slot/,
          );
          await cmd(users[0], "seven_enter", comp, corePicks[0], 1);
          await cmd(users[0], "seven_enter", comp, picks[0], 2);
          await context(users[0]);
          const view = (
            await tx`select beta_fantasy.production_read_state() s`
          )[0].s;
          assert.equal(view.seven.entries.length, 2);
          assert.equal(view.seven.drafts[0].selections.length, 0);
          report.checks.push(
            "Separate incomplete drafts and entries; idempotency; stale saves; ownership/position/duplicate/forged salary rejection; cross-mode card; Core 3.5M entry",
          );
          const list = randomUUID();
          await credits.execute({ id: users[0].id, role: "member" }, list, {
            kind: "list",
            card: picks[0][0].card,
            price: 100,
          });
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
            /unlocked submitted/,
          );
          await credits.execute(
            { id: users[0].id, role: "member" },
            randomUUID(),
            { kind: "cancel-listing", listing: list },
          );
          const waitMs = Number(
            (
              await tx`select greatest(0,extract(epoch from (${deadline}::timestamptz-clock_timestamp()))*1000)::int ms`
            )[0].ms,
          );
          await new Promise((r) => setTimeout(r, waitMs + 1000));
          report.boundary =
            await tx`select clock_timestamp() at,c.locks_at,c.rules,n.locked_at from beta_fantasy.competitions c join sports_feed.nfl_rounds n on n.competition_id=c.id where c.id=${comp}`;
          console.log("QA first lock sync start");
          assert.equal(await connectLockedNflEntries(db, stream), true);
          console.log("QA first lock sync end");
          report.firstLocks =
            await tx`select slot,locked_at from beta_fantasy.slot_locks where competition_id=${comp}`;
          assert.equal(report.firstLocks.length, 2);
          await reject(
            () =>
              cmd(
                users[0],
                "seven_enter",
                comp,
                [
                  { ...picks[0][0], card: corePicks[0][0].card },
                  ...picks[0].slice(1),
                ],
                3,
              ),
            /Started/,
          );
          await cmd(
            users[0],
            "seven_enter",
            comp,
            [picks[0][0], corePicks[0][1], ...picks[0].slice(2)],
            3,
          );
          await cmd(users[0], "seven_enter", comp, picks[0], 4);
          await reject(
            () => cmd(users[0], "seven_withdraw", comp, [], 5),
            /closed/,
          );
          const lockedListing = randomUUID();
          await credits.execute(
            { id: users[0].id, role: "member" },
            lockedListing,
            { kind: "list", card: picks[0][0].card, price: 100 },
          );
          await credits.execute(
            { id: users[1].id, role: "member" },
            randomUUID(),
            {
              kind: "buy",
              listing: lockedListing,
              expectedPrice: 100,
              policy: state.policy.version,
              confirmed: true,
            },
          );
          await reject(
            () =>
              cmd(
                users[1],
                "seven_draft",
                comp,
                [{ slot: "QB1", card: picks[0][0].card }, ...picks[1].slice(1)],
                2,
              ),
            /Started/,
          );
          const lateMs = Number(
            (
              await tx`select greatest(0,extract(epoch from (${late}::timestamptz-clock_timestamp()))*1000)::int ms`
            )[0].ms,
          );
          await new Promise((r) => setTimeout(r, lateMs + 1000));
          await connectLockedNflEntries(db, stream);
          console.log("QA final lock sync end");
          report.checks.push(
            "Synchronous kickoff locks; unlocked RB edit after closure; locked replacement denied; transfer after lock preserves entitlement; buyer cannot insert started player",
          );
          const source = structuredClone(original);
          source.observedAt = new Date().toISOString();
          source.fixtureId = fixture;
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
          let scored: any;
          for (const mapped of scoring.period.fixtures) {
            const slice = {
              ...source,
              fixtureId: mapped.id,
              players: source.players.filter((p: any) =>
                mapped.playerIds.includes(p.playerId),
              ),
            };
            scored = await feed.change(
              stream,
              (s) =>
                importStatistics(
                  s,
                  slice,
                  { id: "rollback-qa", role: "reviewer" },
                  slice.observedAt,
                  "Historical actual-data replay, not genuine entry",
                  approval,
                ),
              prior.raw_id,
            );
            console.log(
              "QA source appended",
              mapped.id.endsWith(":late") ? "late" : "early",
            );
          }
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
            assert.equal(s.seven.entries.length, 2);
            assert.equal(
              s.results.find((r: any) => r.competition_id === comp).score,
              scoredRows.find((r) => r.member === u.id)!.centipoints! / 100,
            );
            const standings = (
              await tx`select sports_feed.nfl_standings() s`
            )[0].s.find((r: any) => r.competitionId === comp);
            assert.equal(standings.rows.length, 2);
            assert.ok(!JSON.stringify(standings).includes(picks[0][0].card));
          }
          const locked = digest(scored.entries),
            originalHash = digest(scored.sources[0]);
          source.revision++;
          source.observedAt = new Date().toISOString();
          source.players = source.players.filter(
            (p: any) => p.playerId === early,
          );
          source.players[0].stats.passing_yards++;
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
          }));
          report.checks.push(
            "Actual retained NFL stats -> seven locked cards -> adjusted totals -> private player breakdowns and public-name standings; append-only correction",
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
      internalQuery: e.actual?.internalQuery,
      stack: e.actual?.stack,
    });
    report.error = e.message;
    console.error(e);
    process.exitCode = 1;
  } finally {
    await sql.end();
    writeFileSync(
      "docs/qa/seven-round/hosted-replay.json",
      JSON.stringify(report, null, 2),
    );
  }
}
void main();
