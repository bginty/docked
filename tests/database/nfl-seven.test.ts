import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { nflSeven, sevenRules } from "../../src/core/nfl-seven";
import { rarityConfiguration, rarityRule } from "../../src/core/card-rarity";
test("seven-mode SQL: salary boundaries, API authority, immutable locks, private drafts and frozen configuration", async () => {
  const pg = new PGlite();
  const q = async (s: string, args: unknown[] = []) =>
    (await pg.query<any>(s, args)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    // Only inventory/auth transport are fixture adapters here. SQL command, salary, locking and grants are the production migration.
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;create table public.qa_inventory(owner uuid,cards jsonb);create or replace function sports_feed.seven_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$select cards from public.qa_inventory where owner=u$$;`,
    );
    const u = randomUUID(),
      other = randomUUID();
    for (const id of [u, other]) {
      await q(`insert into auth.users(id)values($1)`, [id]);
      await q(
        `insert into beta_fantasy.members(user_id,expires_at)values($1,'infinity')`,
        [id],
      );
      await q(
        `insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','LOCAL FIXTURE',true,'Local SQL test only')`,
        [id],
      );
    }
    await q(
      `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{"aal":"aal1"}',false)`,
      [u],
    );
    await q(
      `insert into beta_fantasy.lineup_configurations(version,configuration) values($1,$2)`,
      [nflSeven.version, JSON.stringify(nflSeven)],
    );
    await assert.rejects(
      () =>
        q(`update beta_fantasy.lineup_configurations set configuration='{}'`),
      /immutable/i,
    );
    const cards = nflSeven.slots.map((s, i) => ({
      id: randomUUID(),
      player_id: `p${i}`,
      tier: i < 3 ? "ICON" : "CORE",
      position: s.positions[0],
      status: "active",
      listed: false,
      multiplierTenths: i < 3 ? 15 : 10,
      rarityVersion: rarityConfiguration.version,
    }));
    await q(`insert into public.qa_inventory values($1,$2)`, [
      u,
      JSON.stringify(cards),
    ]);
    const rule = sevenRules();
    await q(
      `insert into beta_fantasy.scoring_rules(version,rules)values($1,$2)`,
      [rule.version, JSON.stringify(rule)],
    );
    const rounds = [randomUUID(), randomUUID()];
    for (let i = 0; i < 2; i++) {
      const c = rounds[i],
        sid = "beta-real:qa:" + c;
      await q(
        `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values($1,'LOCAL SEVEN SQL','nfl','2026',999,clock_timestamp()+interval '1 day',$2,(select id from beta_fantasy.scoring_rules where version=$3),'No cash prize')`,
        [
          c,
          JSON.stringify({
            lineup_version: nflSeven.version,
            mode: i ? "OPEN" : "SALARY_CAP",
            inventory_scope: "invited-nfl-test-v2",
            scoring_version: rule.version,
          }),
          rule.version,
        ],
      );
      await q(`insert into sports_feed.streams(id)values($1)`, [sid]);
      await q(
        `insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,$2,'member',$3)`,
        [
          c,
          sid,
          JSON.stringify([
            {
              fixtureId: sid + ":f",
              scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
              playerIds: cards.map((c) => c.player_id),
            },
          ]),
        ],
      );
    }
    const picks = nflSeven.slots.map((s, i) => ({
      slot: s.id,
      card: cards[i].id,
    }));
    const command = async (
      action: string,
      cid: string,
      selections: unknown[],
      revision: number,
      id = randomUUID(),
    ) =>
      (
        await q(`select sports_feed.seven_command($1,$2,$3) r`, [
          action,
          JSON.stringify({ competition_id: cid, selections, revision }),
          id,
        ])
      )[0].r;
    assert.equal(
      (await command("seven_enter", rounds[0], picks, 0)).salary,
      4400000,
    );
    await command("seven_draft", rounds[0], picks.slice(0, 3), 0);
    await q(
      `insert into beta_fantasy.team_names(user_id,name) values($1,'Local Team')`,
      [u],
    );
    const standings = async () =>
      (await q(`select sports_feed.play_standings() rows`))[0].rows;
    const ownStandings = await standings();
    const ownRound = ownStandings.find(
      (r: any) => r.competitionId === rounds[0],
    );
    assert.equal(ownRound.rows[0].name, "Local Team");
    assert.equal(ownRound.rows[0].centipoints, null);
    assert.equal(ownRound.rows[0].rank, null);
    assert.equal(ownRound.finalised, false);
    assert.equal(ownRound.rows[0].lineup.length, 7);
    assert.equal(
      JSON.stringify(ownStandings).includes(u),
      false,
      "No auth account IDs in read model",
    );
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
    const opponent = (await standings()).find(
      (r: any) => r.competitionId === rounds[0],
    );
    assert.equal(
      opponent.rows[0].lineup,
      null,
      "Opposing editable lineup is not serialized",
    );
    assert.equal(
      opponent.rows[0].key,
      ownRound.rows[0].key,
      "Opaque season identity is stable",
    );
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => q(`select sports_feed.play_standings()`),
      /permission denied/,
    );
    await pg.exec("reset role");
    await q(`select set_config('request.jwt.claim.sub','',false)`);
    await assert.rejects(standings, /Active admitted session/);
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [u]);

    await assert.rejects(
      () =>
        q(
          `update beta_fantasy.entries set snapshot=jsonb_set(snapshot,'{0,kickoff}',to_jsonb((clock_timestamp()-interval '1 second')::text)) where competition_id=$1`,
          [rounds[0]],
        ),
      /Kickoff crossed/,
    );
    await assert.rejects(
      () => command("seven_draft", rounds[0], picks, 0),
      /another window/,
    );
    cards[6].tier = "RARE";
    cards[6].multiplierTenths = rarityRule("RARE").multiplierTenths;
    await q(`update public.qa_inventory set cards=$1 where owner=$2`, [
      JSON.stringify(cards),
      u,
    ]);
    await assert.rejects(
      () => command("seven_enter", rounds[0], picks, 1),
      /Salary cap exceeded: attempted 4500000, cap 4400000/,
    );
    assert.equal(
      (
        await q(
          `select lineup_revision from beta_fantasy.entries where competition_id=$1`,
          [rounds[0]],
        )
      )[0].lineup_revision,
      1,
    );
    await command("seven_draft", rounds[0], picks.slice(0, 6), 1);
    for (const c of cards) {
      c.tier = "ICON";
      c.multiplierTenths = 15;
    }
    await q(`update public.qa_inventory set cards=$1 where owner=$2`, [
      JSON.stringify(cards),
      u,
    ]);
    assert.equal(
      (await command("seven_enter", rounds[1], picks, 0)).salary,
      5600000,
    );
    await assert.rejects(
      () => command("seven_enter", rounds[1], [...picks, picks[0]], 1),
      /exactly seven/,
    );
    await assert.rejects(
      () => command("seven_enter", rounds[1], picks.slice(0, 6), 1),
      /exactly seven/,
    );
    await assert.rejects(
      () =>
        q(`select beta_fantasy.production_command('save_lineup',$1,$2)`, [
          JSON.stringify({
            competition_id: rounds[1],
            cards: cards.map((c) => c.id),
          }),
          randomUUID(),
        ]),
      /explicit draft/,
    );
    await assert.rejects(
      () =>
        q(`select sports_feed.seven_admin_control($1,$2)`, [
          JSON.stringify({
            competition_id: rounds[1],
            revision: 0,
            enabled: false,
            standings_visible: false,
            reason: "Local ordinary member denied",
          }),
          randomUUID(),
        ]),
      /MFA/,
    );
    for (const table of [
      "round_drafts",
      "entries",
      "slot_locks",
      "entry_revisions",
    ]) {
      await pg.exec("set role authenticated");
      await assert.rejects(
        () => q(`select * from beta_fantasy.${table}`),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
    await assert.rejects(
      () => command("seven_enter", rounds[1], picks, 0),
      /Owned/,
    );
    // Publication gate uses real SQL; community admission is an isolated transport fixture.
    const ownerProfile = randomUUID(),
      viewerProfile = randomUUID(),
      publicRound = randomUUID();
    await q(
      `insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'XX','QA',true,'fixture'),($2,'XX','QA',true,'fixture')`,
      [u, other],
    );
    await q(
      `insert into private.social_profiles(id,user_id,handle,display_name) values($1,$2,'lockedowner','Local Owner'),($3,$4,'lockedviewer','Local Viewer')`,
      [ownerProfile, u, viewerProfile, other],
    );
    await pg.exec(
      `create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select p_user is not null$$;`,
    );
    for (const member of [u, other]) {
      await q(
        `insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at) values($1,$2::uuid,md5(($2::uuid)::text)||md5(($2::uuid)::text),gen_random_uuid(),clock_timestamp()+interval '1 day')`,
        [member + "@fixture.invalid", member],
      );
      await q(
        `update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions='{"terms":"fixture"}' where user_id=$1`,
        [member],
      );
    }
    await q(
      `insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values($1,'AU','NSW',true,'fixture'),($2,'AU','NSW',true,'fixture')`,
      [u, other],
    );
    await q(
      `insert into beta_private.social_profiles(id,user_id,handle,display_name) values($1,$2,'lockedowner','Local Owner'),($3,$4,'lockedviewer','Local Viewer')`,
      [ownerProfile, u, viewerProfile, other],
    );
    await pg.exec(
      `create or replace function private.community_actor(p_actor uuid,p_feature text,p_require_posting boolean default true) returns uuid language sql as $$select id from private.social_profiles where user_id=p_actor$$;create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select p_user is not null$$;`,
    );
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [u]);
    await q(
      `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) select $1,'LOCAL PUBLICATION FIXTURE',sport,season,1001,clock_timestamp()+interval '2 seconds',rules,scoring_id,prize from beta_fantasy.competitions where id=$2`,
      [publicRound, rounds[1]],
    );
    const publicStream = "beta-real:qa:" + publicRound;
    await q(`insert into sports_feed.streams(id) values($1)`, [publicStream]);
    await q(
      `insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures) values($1,$2,'member',$3)`,
      [
        publicRound,
        publicStream,
        JSON.stringify([
          {
            fixtureId: publicStream + ":f",
            scheduledAt: new Date(Date.now() + 3000).toISOString(),
            playerIds: cards.map((c) => c.player_id),
          },
        ]),
      ],
    );
    await command("seven_enter", publicRound, picks, 0);
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
    const published = async () =>
      (
        await q(`select private.social_locked_lineups($1) teams`, [
          ownerProfile,
        ])
      )[0].teams;
    assert.deepEqual(await published(), []);
    await q(
      `insert into beta_fantasy.lineup_publication_policy(competition_id,enabled,policy_version,authority_note) values($1,true,'isolated-test','Local fixture publication only')`,
      [publicRound],
    );
    assert.deepEqual(
      await published(),
      [],
      "deadline and kickoff not yet passed",
    );
    await q(`select pg_sleep(3.1)`);
    assert.deepEqual(
      await published(),
      [],
      "clock alone cannot publish an unsaved lock",
    );
    await q(
      `insert into beta_fantasy.slot_locks(competition_id,user_id,slot,snapshot,locked_at) select competition_id,user_id,s->>'slot',s,(s->>'kickoff')::timestamptz from beta_fantasy.entries,jsonb_array_elements(snapshot) s where competition_id=$1 and s->>'slot'<>'FLEX1'`,
      [publicRound],
    );
    assert.deepEqual(
      await published(),
      [],
      "partial rolling lineup remains private",
    );
    await q(`select sports_feed.seven_lock_due()`);
    const visible = await published();
    assert.equal(visible.length, 1);
    assert.equal(visible[0].players.length, 7);
    let publishedStandings = (await standings()).find(
      (r: any) => r.competitionId === publicRound,
    );
    assert.equal(
      publishedStandings.rows[0].lineup.length,
      7,
      "Approved fully locked opposing entry is visible",
    );
    await q(
      `insert into beta_private.social_blocks(actor_id,target_id) values($1,$2)`,
      [viewerProfile, ownerProfile],
    );
    assert.equal(
      (await standings()).find((r: any) => r.competitionId === publicRound)
        .rows[0].lineup,
      null,
      "Bilateral block enforced with profile identity",
    );
    await q(`delete from beta_private.social_blocks where actor_id=$1`, [
      viewerProfile,
    ]);
    const snapshot = (
      await q(
        `select snapshot from beta_fantasy.entries where competition_id=$1`,
        [publicRound],
      )
    )[0].snapshot;
    const scoringRows = [
      {
        member: u,
        centipoints: 12345,
        rank: 1,
        status: "final",
        players: snapshot.map((c: any) => ({
          cardId: c.card_id,
          baseCentipoints: 1000,
          centipoints: 1500,
          matches: [
            {
              score: {
                parts: [
                  { statistic: "fixture", quantity: 1, centipoints: 1000 },
                ],
              },
            },
          ],
        })),
      },
    ];
    await q(
      `insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values($1,1,'fixture','fixture-final',$2,$3)`,
      [
        publicStream,
        JSON.stringify({
          scope: "authorised-free-beta",
          period: { rules: rule },
          finalisedAt: new Date().toISOString(),
        }),
        JSON.stringify({ rows: scoringRows }),
      ],
    );
    await q(
      `update beta_fantasy.competitions set scored_at=clock_timestamp() where id=$1`,
      [publicRound],
    );
    publishedStandings = (await standings()).find(
      (r: any) => r.competitionId === publicRound,
    );
    assert.equal(publishedStandings.finalised, true);
    assert.equal(publishedStandings.rows[0].centipoints, 12345);
    assert.equal(publishedStandings.rows[0].lineup[0].baseCentipoints, 1000);
    assert.equal(
      publishedStandings.rows[0].lineup[0].parts[0].statistic,
      "fixture",
    );
    await q(`update public.qa_inventory set cards='[]' where owner=$1`, [u]);
    assert.deepEqual(
      (await standings()).find((r: any) => r.competitionId === publicRound)
        .rows[0].lineup,
      publishedStandings.rows[0].lineup,
      "Current inventory changes do not affect historical snapshots",
    );
    await q(`update public.qa_inventory set cards=$1 where owner=$2`, [
      JSON.stringify(cards),
      u,
    ]);
    await q(
      `insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values($1,2,'fixture-final','fixture-reopened',$2,$3)`,
      [
        publicStream,
        JSON.stringify({
          scope: "authorised-free-beta",
          period: { rules: rule },
          finalisedAt: null,
        }),
        JSON.stringify({
          rows: scoringRows.map((r) => ({
            ...r,
            status: "provisional",
            centipoints: 12001,
          })),
        }),
      ],
    );
    publishedStandings = (await standings()).find(
      (r: any) => r.competitionId === publicRound,
    );
    assert.equal(
      publishedStandings.finalised,
      false,
      "Latest review overrides previously finalised week",
    );
    assert.equal(publishedStandings.rows[0].centipoints, 12001);

    assert.equal(JSON.stringify(visible).includes("card_id"), false);
    assert.equal(JSON.stringify(visible).includes("selections"), false);
    await q(
      `insert into private.social_blocks(actor_id,target_id) values($1,$2)`,
      [viewerProfile, ownerProfile],
    );
    assert.deepEqual(
      await published(),
      [],
      "blocked members cannot view locked lineups",
    );
    await q(`delete from private.social_blocks where actor_id=$1`, [
      viewerProfile,
    ]);
    await q(
      `update beta_fantasy.lineup_publication_policy set enabled=false where competition_id=$1`,
      [publicRound],
    );
    assert.deepEqual(
      await published(),
      [],
      "publication policy revocation is immediate",
    );
    // Member-facing review metadata never includes other users' selections.
    const review = (await q(`select sports_feed.member_review_context() r`))[0]
      .r;
    assert.equal(review.rounds.length, 3);
    assert.ok(
      review.rounds.every(
        (r: any) => !r.entered && r.rules.version === rule.version,
      ),
    );
    assert.equal(JSON.stringify(review).includes(cards[0].id), false);
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => q(`select sports_feed.member_review_context()`),
      /permission denied/,
    );
    await pg.exec("reset role");
  } finally {
    await pg.close();
  }
});
