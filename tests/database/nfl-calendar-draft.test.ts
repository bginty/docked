import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgliteSql } from "../fixtures/pglite-sql";
import { registerNflRound } from "../../src/server/nfl-member-rounds";
import { nflSeven, sevenRules } from "../../src/core/nfl-seven";
import type { Period } from "../../src/core/scoring-engine";

test("calendar drafts stay unpublished and uncollected; retries preserve state and failures roll back", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated;`);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    const sql = pgliteSql(pg);
    const future = new Date(Date.now() + 86400000).toISOString();
    const evidence = {
      source: "https://calendar.example/verified",
      verifiedAt: new Date().toISOString(),
      completeRound: true,
      lockPolicy: "whole-round-before-first-kickoff" as const,
      offsetSeconds: 0,
    };
    const period: Period = {
      id: "beta-real:nfl:seven:salary_cap:2099:10",
      sport: "nfl",
      label: "NFL Round 10 · Traditional",
      lineupVersion: nflSeven.version,
      competitionMode: "SALARY_CAP",
      locksAt: future,
      rules: sevenRules(),
      inventoryScope: "invited-nfl-test-v2",
      fixtures: [
        {
          id: "isolated-calendar-fixture",
          playerIds: ["isolated-player"],
          scheduledAt: future,
        },
      ],
    };
    const id = await registerNflRound(sql, period, period.fixtures, evidence, {
      publication: "draft",
    });
    assert.equal(
      (
        await sql`select * from beta_fantasy.production_rounds where competition_id=${id}`
      ).length,
      0,
    );
    const [controls] =
      await sql`select enabled,standings_visible from beta_fantasy.round_controls where competition_id=${id}`;
    assert.deepEqual(controls, { enabled: false, standings_visible: false });
    const [registered] =
      await sql`select next_check::text,locked_at from sports_feed.nfl_rounds where competition_id=${id}`;
    assert.equal(registered.next_check, "infinity");
    assert.equal(registered.locked_at, null);
    const [audit] =
      await sql`select body->'audits'->0->>'reason' reason from sports_feed.journal where stream_id=${period.id}`;
    assert.match(audit.reason, /unpublished calendar draft; collection paused/);
    const before =
      await sql`select to_jsonb(c) state from beta_fantasy.competitions c where id=${id}`;
    assert.equal(
      await registerNflRound(
        sql,
        { ...period, label: "Retry must not rewrite" },
        period.fixtures,
        evidence,
        { publication: "beta" },
      ),
      id,
    );
    assert.deepEqual(
      await sql`select to_jsonb(c) state from beta_fantasy.competitions c where id=${id}`,
      before,
    );
    assert.equal(
      (
        await sql`select * from beta_fantasy.production_rounds where competition_id=${id}`
      ).length,
      0,
      "Retry cannot publish an existing draft",
    );

    const open = {
      ...period,
      id: "beta-real:nfl:seven:open:2099:10",
      competitionMode: "OPEN" as const,
    };
    const liveBeta = await registerNflRound(sql, open, open.fixtures, evidence);
    assert.equal(
      (
        await sql`select * from beta_fantasy.production_rounds where competition_id=${liveBeta}`
      ).length,
      1,
      "Existing explicit beta callers retain their contract",
    );
    assert.equal(
      (
        await sql`select next_check < 'infinity'::timestamptz active from sports_feed.nfl_rounds where competition_id=${liveBeta}`
      )[0].active,
      true,
    );

    const countBefore = (
      await sql`select count(*)::int n from beta_fantasy.competitions`
    )[0].n;
    await pg.exec(`create function public.fail_calendar_fixture() returns trigger language plpgsql as $$begin raise exception 'Injected calendar failure';end$$;
      create trigger fail_calendar_fixture before insert on sports_feed.nfl_rounds for each row execute function public.fail_calendar_fixture();`);
    const failed = { ...period, id: "beta-real:nfl:seven:salary_cap:2099:11" };
    await assert.rejects(
      () =>
        registerNflRound(sql, failed, failed.fixtures, evidence, {
          publication: "draft",
        }),
      /Injected calendar failure/,
    );
    assert.equal(
      (await sql`select count(*)::int n from beta_fantasy.competitions`)[0].n,
      countBefore,
    );
    assert.equal(
      (
        await sql`select * from sports_feed.journal where stream_id=${failed.id}`
      ).length,
      0,
    );
    assert.equal(
      (await sql`select * from sports_feed.streams where id=${failed.id}`)
        .length,
      0,
    );
    assert.equal(
      (await sql`select count(*)::int n from beta_fantasy.entries`)[0].n,
      0,
    );
  } finally {
    await pg.close();
  }
});
