import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { nflSeven, sevenRules } from "../../src/core/nfl-seven";
test("team continuity: first confirmation, private idempotent rollover, manual edits and mode separation", async () => {
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
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null and current_setting('qa.mfa',true) is distinct from 'required'$$;create table public.qa_inventory(owner uuid,cards jsonb);create or replace function sports_feed.seven_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$select cards from public.qa_inventory where owner=u$$;`,
    );
    const user = randomUUID(),
      other = randomUUID();
    for (const id of [user, other]) {
      await q("insert into auth.users(id)values($1)", [id]);
      await q(
        `insert into beta_fantasy.members(user_id,expires_at)values($1,'infinity')`,
        [id],
      );
      await q(
        `insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','LOCAL',true,'Isolated fixture')`,
        [id],
      );
    }
    await q(
      `select set_config('request.jwt.claim.sub',$1,false),set_config('docked.fantasy_channel','beta',false)`,
      [user],
    );
    const cards = nflSeven.slots.map((s) => ({
      id: randomUUID(),
      player_id: randomUUID(),
      tier: "CORE",
      position: s.positions[0],
      status: "active",
      listed: false,
      multiplierTenths: 10,
      rarityVersion: "docked-lifetime-rarity-v1",
    }));
    const extra = { ...cards[0], id: randomUUID(), player_id: randomUUID() };
    const setInventory = async (items: typeof cards) =>
      q("update public.qa_inventory set cards=$1 where owner=$2", [
        JSON.stringify(items),
        user,
      ]);
    await q("insert into public.qa_inventory values($1,$2)", [
      user,
      JSON.stringify([...cards, extra]),
    ]);
    await q("insert into public.qa_inventory values($1,$2)", [
      other,
      JSON.stringify(cards),
    ]);
    await q(
      "insert into beta_fantasy.lineup_configurations(version,configuration)values($1,$2)",
      [nflSeven.version, JSON.stringify(nflSeven)],
    );
    await q(
      "insert into beta_fantasy.scoring_rules(version,rules)values($1,$2)",
      [sevenRules().version, JSON.stringify(sevenRules())],
    );
    const rounds: Record<string, string> = {};
    async function round(mode: string, week: number) {
      const id = randomUUID(),
        stream = "beta-real:qa:" + id;
      rounds[mode + week] = id;
      await q(
        `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values($1,'LOCAL','nfl','2026',$2,clock_timestamp()+interval '2 days',$3,(select id from beta_fantasy.scoring_rules where version=$4),'No cash prize')`,
        [
          id,
          week,
          JSON.stringify({
            lineup_version: nflSeven.version,
            mode,
            inventory_scope: "invited-nfl-test-v2",
            scoring_version: sevenRules().version,
          }),
          sevenRules().version,
        ],
      );
      await q(
        "insert into beta_fantasy.production_rounds(competition_id)values($1)",
        [id],
      );
      await q("insert into sports_feed.streams(id)values($1)", [stream]);
      await q(
        `insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,$2,'member',$3)`,
        [
          id,
          stream,
          JSON.stringify([
            {
              fixtureId: stream + ":f",
              scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
              playerIds: [...cards, extra].map((c) => c.player_id),
            },
          ]),
        ],
      );
      return id;
    }
    for (const mode of ["SALARY_CAP", "OPEN"])
      for (const week of [6, 7]) await round(mode, week);
    const picks = cards.map((c, i) => ({
      slot: nflSeven.slots[i].id,
      card: c.id,
    }));
    const command = async (
      action: string,
      id: string,
      selections: unknown[],
      revision: number,
    ) =>
      q("select sports_feed.seven_command($1,$2,$3) result", [
        action,
        JSON.stringify({ competition_id: id, selections, revision }),
        randomUUID(),
      ]);
    const reconcile = async () =>
      (await q("select sports_feed.seven_continue_teams() c"))[0].c;
    await command("seven_draft", rounds.SALARY_CAP6, picks, 0);
    assert.deepEqual(
      (await reconcile()).established,
      {},
      "Draft is not first confirmation",
    );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.team_rollovers"))[0].n,
      0,
    );
    await command("seven_enter", rounds.SALARY_CAP6, picks, 0);
    const previous = (
      await q(
        "select snapshot,lineup_revision from beta_fantasy.entries where competition_id=$1",
        [rounds.SALARY_CAP6],
      )
    )[0];
    const first = await reconcile();
    assert.deepEqual(first.established, { "nfl:SALARY_CAP": true });
    assert.equal(first.rollovers.length, 1);
    assert.deepEqual(first.rollovers[0].selections, picks);
    const draft = async (id: string) =>
      (
        await q(
          "select * from beta_fantasy.round_drafts where competition_id=$1 and user_id=$2",
          [id, user],
        )
      )[0];
    assert.equal((await draft(rounds.SALARY_CAP7)).revision, 1);
    assert.equal(
      (
        await q(
          "select count(*)::int n from beta_fantasy.entries where competition_id=$1",
          [rounds.SALARY_CAP7],
        )
      )[0].n,
      0,
      "No automatic entry",
    );
    await Promise.all([reconcile(), reconcile()]);
    assert.equal(
      (await draft(rounds.SALARY_CAP7)).revision,
      1,
      "Repeated/overlapping reads cannot replace a draft",
    );
    assert.equal(
      await draft(rounds.OPEN7),
      undefined,
      "Traditional chain must not seed All-Star",
    );
    const changed = picks.map((p, i) =>
      i === 0 ? { ...p, card: extra.id } : p,
    );
    await command("seven_draft", rounds.SALARY_CAP7, changed, 1);
    await reconcile();
    assert.deepEqual(
      (await draft(rounds.SALARY_CAP7)).selections,
      changed,
      "Manual substitution retained",
    );
    assert.deepEqual(
      (
        await q(
          "select snapshot,lineup_revision from beta_fantasy.entries where competition_id=$1",
          [rounds.SALARY_CAP6],
        )
      )[0],
      previous,
    );
    await command("seven_enter", rounds.OPEN6, picks, 0);
    await command("seven_draft", rounds.OPEN7, picks.slice(0, 2), 0);
    await reconcile();
    assert.equal(
      (await draft(rounds.OPEN7)).selections.length,
      2,
      "Never overwrite an existing future draft",
    );
    await command("seven_withdraw", rounds.OPEN6, [], 1);
    assert.equal(
      (await reconcile()).established["nfl:OPEN"],
      true,
      "Withdrawal does not reset first-time setup",
    );
    const next = await round("SALARY_CAP", 8);
    await setInventory([
      ...cards.filter((_, i) => i !== 1),
      { ...extra, listed: true },
    ]);
    const partial = await reconcile();
    const last = partial.rollovers.find((r: any) => r.competition_id === next);
    assert.equal(last.selections.length, 5);
    assert.equal(last.omitted.length, 2);
    assert.ok(
      last.selections.every(
        (p: any) => p.card !== extra.id && p.card !== cards[1].id,
      ),
    );
    await setInventory([...cards, extra]);
    await reconcile();
    assert.equal(
      (await draft(next)).selections.length,
      5,
      "New/returned cards must not auto-fill a persisted draft",
    );
    const retryRound = await round("SALARY_CAP", 9);
    await pg.exec(
      `create function public.qa_rollover_failure() returns trigger language plpgsql as $$begin raise exception 'Isolated audit failure';end$$;create trigger qa_rollover_failure before insert on beta_fantasy.team_rollovers for each row execute function public.qa_rollover_failure();`,
    );
    await assert.rejects(reconcile, /Isolated audit failure/);
    assert.equal(
      await draft(retryRound),
      undefined,
      "Audit failure rolls back the draft and receipt in the same transaction",
    );
    await pg.exec(
      "drop trigger qa_rollover_failure on beta_fantasy.team_rollovers",
    );
    await reconcile();
    assert.equal((await draft(retryRound)).revision, 1);
    // Isolate only the previous projection to exercise the real read wrapper and grants.
    await pg.exec(
      `create or replace function beta_fantasy.production_read_state_before_continuity() returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('user_id',auth.uid(),'seven',jsonb_build_object('inventory',sports_feed.seven_inventory(auth.uid()),'drafts','[]'::jsonb))$$;`,
    );
    await pg.exec("set role docked_beta_app");
    const projected = (
      await q("select beta_fantasy.production_read_state() s")
    )[0].s;
    assert.equal(projected.seven.established["nfl:SALARY_CAP"], true);
    assert.ok(
      projected.seven.drafts.some((d: any) => d.competition_id === retryRound),
    );
    assert.ok(projected.seven.drafts.every((d: any) => !("user_id" in d)));
    await pg.exec("reset role");
    await q(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
    assert.deepEqual((await reconcile()).rollovers, []);
    assert.deepEqual((await reconcile()).established, {});
    await q(`select set_config('qa.mfa','required',false)`);
    await assert.rejects(reconcile, /Invited test member/);
    await q(`select set_config('qa.mfa','',false)`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261019213437_weekly_team_continuity.sql",
        "utf8",
      ),
    );
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => q("select * from beta_fantasy.team_rollovers"),
      /permission denied/,
    );
    await assert.rejects(reconcile, /permission denied/);
    await pg.exec("reset role");
  } finally {
    await pg.close();
  }
});
