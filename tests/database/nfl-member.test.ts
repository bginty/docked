import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("exact NFL migration: isolated grants, free allocation, FLEX, ownership and preserved scarcity", async () => {
  const pg = new PGlite();
  const q = async (s: string, args: unknown[] = []) =>
    (await pg.query<any>(s, args)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    // Auth is isolated to this disposable unit test; hosted acceptance uses real gates.
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;update sports_feed.nfl_control set enabled=true;`,
    );
    const users = [randomUUID(), randomUUID()],
      raw = (
        await q(
          `insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at) values('nflverse','fixture','fixture','{"dataset":"rosters"}',clock_timestamp(),'isolated test',clock_timestamp()+interval '1 day') returning id`,
        )
      )[0].id;
    for (const u of users)
      await q(
        `insert into beta_fantasy.members values($1,'infinity',null,clock_timestamp())`,
        [u],
      );
    const players = [];
    for (const [i, pos] of [
      "QB",
      "QB",
      "RB",
      "RB",
      "RB",
      "WR",
      "WR",
      "WR",
      "TE",
      "TE",
    ].entries()) {
      const player = randomUUID(),
        edition = randomUUID();
      players.push(player);
      await q(
        `insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season) values($1,$2,'nfl',$3,'TEST','#1677FF',1,'unknown')`,
        [player, "Synthetic QA " + i, pos],
      );
      await q(
        `insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)values($1,$2,'CORE','2026','regular',11,'launched')`,
        [edition, player],
      );
      await q(
        `insert into sports_feed.nfl_players values($1,$2,$3,'TEST','ACT',$4,clock_timestamp(),'TEST')`,
        [player, "00-" + String(i).padStart(7, "0"), edition, raw],
      );
    }
    const comp = randomUUID(),
      scoring = randomUUID();
    await q(
      `insert into beta_fantasy.scoring_rules values($1,'nfl-test','{}')`,
      [scoring],
    );
    await q(
      `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize)values($1,'ISOLATED QA','nfl','2026',1,clock_timestamp()+interval '1 day','{}',$2,'[]','No cash prize')`,
      [comp, scoring],
    );
    await q(
      `insert into sports_feed.streams values('beta-real:test',clock_timestamp(),'member','{}')`,
    );
    await q(
      `insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,'beta-real:test','member',$2)`,
      [comp, JSON.stringify([{ playerIds: players }])],
    );
    const cmd = async (u: string, a: string, p: object = {}) => {
      await q(`select set_config('request.jwt.claim.sub',$1,false)`, [u]);
      return (
        await q(`select beta_fantasy.production_command($1,$2,$3) r`, [
          a,
          JSON.stringify(p),
          randomUUID(),
        ])
      )[0].r;
    };
    const grants: string[][] = [];
    for (const u of users) {
      const a = await cmd(u, "claim_starter");
      assert.equal(a.card_ids.length, 10);
      assert.deepEqual((await cmd(u, "claim_starter")).card_ids, a.card_ids);
      grants.push(a.card_ids);
    }
    assert.equal(
      (await q(`select count(*)::int n from beta_fantasy.cards`))[0].n,
      20,
    );
    // Exact migration boundary with disposable auth/read fixtures only.
    await pg.exec(
      `create or replace function beta_fantasy.swap_actor() returns uuid language sql as $$select auth.uid()$$;`,
    );
    for (const action of ["reserve_pack", "practice_credit", "fee_mode"])
      await assert.rejects(
        () =>
          q(`select beta_fantasy.swap_command($1,'{}',$2)`, [
            action,
            randomUUID(),
          ]),
        /unavailable in the free NFL beta/,
      );
    await assert.rejects(
      () =>
        q(`select beta_fantasy.swap_command('offer',$1,$2)`, [
          JSON.stringify({ give_card: randomUUID(), take_card: grants[0][0] }),
          randomUUID(),
        ]),
      /Only real NFL/,
    );
    assert.equal(
      (
        await q(
          `select has_function_privilege('docked_beta_app','beta_fantasy.swap_command_before_nfl(text,jsonb,uuid)','execute') allowed`,
        )
      )[0].allowed,
      false,
    );
    await pg.exec(
      `create or replace function beta_fantasy.swap_read_state_before_nfl() returns jsonb language sql as $$select jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('id','${grants[0][0]}'),jsonb_build_object('id','${randomUUID()}')),'reserves_granted',false)$$;`,
    );
    const swapRead = (await q(`select beta_fantasy.swap_read_state() s`))[0].s;
    assert.equal(swapRead.cards.length, 1);
    assert.equal(swapRead.reserves_granted, true);
    for (const [n, u] of users.entries()) {
      const cards = await q(
        `select c.id,p.position from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id where c.owner_id=$1 order by p.position,c.id`,
        [u],
      );
      const lineup = ["QB", "RB", "RB", "WR", "WR", "TE", "TE"].map((pos) => {
        const i = cards.findIndex((c) => c.position === pos);
        return cards.splice(i, 1)[0].id;
      });
      assert.equal(
        (await cmd(u, "save_lineup", { competition_id: comp, cards: lineup }))
          .saved,
        true,
      );
      await assert.rejects(
        () =>
          cmd(users[1 - n], "save_lineup", {
            competition_id: comp,
            cards: lineup,
          }),
        /owned|NFL requires/i,
      );
      await assert.rejects(
        () =>
          cmd(u, "save_lineup", {
            competition_id: comp,
            cards: [...lineup.slice(0, 6), lineup[0]],
          }),
        /distinct/,
      );
    }
    assert.equal(
      (
        await q(
          `select sum(issued)::int n from beta_fantasy.editions where season='2026'`,
        )
      )[0].n,
      20,
    );
    await assert.rejects(
      () =>
        pg.exec(`set role docked_nfl_worker;select * from beta_fantasy.cards;`),
      /permission denied/,
    );
    await pg.exec("reset role");
    await assert.rejects(
      () =>
        pg.exec(
          `set role docked_nfl_worker;select * from sports_feed.nfl_allocations;`,
        ),
      /permission denied/,
    );
    await pg.exec("reset role");
    await assert.rejects(
      () =>
        pg.exec(
          `set role docked_nfl_worker;update sports_feed.nfl_rounds set locked_at=clock_timestamp();`,
        ),
      /permission denied/,
    );
    await pg.exec("reset role");
    await assert.rejects(
      () =>
        pg.exec(
          `set role docked_beta_app;select * from sports_feed.raw_revisions;`,
        ),
      /permission denied/,
    );
    await pg.exec("reset role");
    const migration = await readFile(
      "supabase/migrations/20261011002634_nfl_member_rounds.sql",
      "utf8",
    );
    await mkdir("docs/qa/nfl-member", { recursive: true });
    await writeFile(
      "docs/qa/nfl-member/migration-test.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          sha256: createHash("sha256").update(migration).digest("hex"),
          swapsSha256: createHash("sha256")
            .update(
              await readFile(
                "supabase/migrations/20261011011400_nfl_swap_projection.sql",
                "utf8",
              ),
            )
            .digest("hex"),
          projectionSha256: createHash("sha256")
            .update(
              await readFile(
                "supabase/migrations/20261011004639_nfl_member_read_projection.sql",
                "utf8",
              ),
            )
            .digest("hex"),
          scope: "Disposable PGlite; not hosted Auth",
          checks: [
            "two isolated allocations idempotent",
            "valid FLEX teams",
            "cross-user/duplicate denial",
            "supply counts",
            "worker cannot read holdings/allocation identities or edit locked lineups",
            "member cannot read raw feed",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await pg.close();
  }
});
