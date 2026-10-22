import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  aflConfiguration,
  type SportConfiguration,
} from "../../src/core/sport-configuration";
import { nflSeven } from "../../src/core/nfl-seven";
import { nbaWeeklyLineup } from "../../src/core/nba-weekly";
/** Explicit artificial units, identities and schedule. Never a published salary proposal. */
export function sandboxConfig(sport = aflConfiguration) {
  if (sport.formatVersion === "docked-nba-weekly-lineup-proposal-v1")
    return nbaWeeklyLineup();
  return {
    ...nflSeven,
    version: `${sport.formatVersion}-qa`,
    sport: sport.id,
    inventoryScope: "isolated-multi-sport-v1",
    slots: sport.slots,
    salaryCap: sport.slots.length * 120,
    salaries: {
      CORE: 100,
      RARE: 110,
      ELITE: 120,
      ULTRA_RARE: 130,
      LEGENDARY: 140,
      ICON: 150,
    },
    lockPolicy: "round-wide-v1",
    commerciallyApproved: false,
  };
}
export async function multiSportDatabase(
  sport: SportConfiguration = aflConfiguration,
) {
  const pg = new PGlite();
  const q = async (sql: string, params: unknown[] = []) =>
    (await pg.query<Record<string, any>>(sql, params)).rows;
  await pg.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
  // Controlled clock for isolated time-travel tests; guard/lock logic is unchanged.
  await pg.exec(`create schema qa; create function qa.now() returns timestamptz language sql as $$select coalesce(nullif(current_setting('qa.now',true),''),'2099-01-01T00:00:00Z')::timestamptz$$;
  do $$declare r record;begin for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('sports_feed','beta_fantasy') and p.prokind='f' and position('clock_timestamp()' in p.prosrc)>0 loop execute replace(pg_get_functiondef(r.oid),'clock_timestamp()','qa.now()');end loop;end$$;`);
  // Transport-only local fixture adapters; all command/locks/privacy/rollover SQL stays real.
  await pg.exec(
    `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;`,
  );
  const user = randomUUID(),
    other = randomUUID();
  const config = sandboxConfig(sport);
  await q("insert into beta_fantasy.lineup_configurations values($1,$2)", [
    config.version,
    JSON.stringify(config),
  ]);
  await q(
    "insert into beta_fantasy.scoring_rules(version,rules)values('isolated-no-scoring-v1','{}')",
  );
  const inventories: Record<string, any[]> = {};
  const sessions: Record<string, string> = {};
  for (const u of [user, other]) {
    await q("insert into auth.users(id,email_confirmed_at)values($1,now())", [
      u,
    ]);
    sessions[u] = randomUUID();
    await q("insert into auth.sessions(id,user_id)values($1,$2)", [
      sessions[u],
      u,
    ]);
    await q(
      "insert into beta_fantasy.members(user_id,expires_at)values($1,'infinity')",
      [u],
    );
    await q(
      "insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','ISOLATED QA',true,'No real players or member assets')",
      [u],
    );
    await q("insert into sports_feed.sport_sandbox_access values($1)", [u]);
    const cards = [...sport.slots, sport.slots[0]].map((slot, i) => ({
      id: randomUUID(),
      player_id: randomUUID(),
      owner_id: u,
      name: `QA ${sport.label} ${i + 1}`,
      team: "Isolated fixture",
      colour: "#1759a3",
      sport: sport.id,
      position: slot.positions[0],
      eligible_positions: [slot.positions[0]],
      status: "active",
      listed: false,
      tier: "CORE",
      multiplierTenths: 10,
      serial: 1,
      max_supply: 0,
      season: "2099 QA",
      verifiedJerseyNumber: null,
    }));
    inventories[u] = cards;
    await q(
      "insert into sports_feed.sport_sandbox_inventory values($1,$2,$3)",
      [u, sport.id, JSON.stringify(cards)],
    );
  }
  const rounds: Record<string, string> = {};
  await q("select set_config('docked.multi_sport','isolated-preview',false)");
  for (const mode of ["SALARY_CAP", "OPEN"])
    for (const week of [1, 2, 3]) {
      const id = randomUUID();
      rounds[mode + week] = id;
      await q(
        `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)
    values($1,$2,$3,'2099',$4,'2099-02-01T00:00:00Z',$5,(select id from beta_fantasy.scoring_rules where version='isolated-no-scoring-v1'),'No cash prize')`,
        [
          id,
          `Sandbox ${sport.label} ${mode} ${week}`,
          sport.id,
          week,
          JSON.stringify({
            mode,
            lineup_version: config.version,
            inventory_scope: config.inventoryScope,
            lock_policy: "round-wide-v1",
            scoring_version: "isolated-no-scoring-v1",
          }),
        ],
      );
      await q(
        "insert into sports_feed.sport_rounds(competition_id,sport,fixtures)values($1,$2,$3)",
        [
          id,
          sport.id,
          JSON.stringify([
            {
              fixtureId:
                sport.formatVersion === "docked-nba-weekly-lineup-proposal-v1"
                  ? `sim:basketball:qa:${id}`
                  : `qa:${id}`,
              scheduledAt:
                sport.formatVersion === "docked-nba-weekly-lineup-proposal-v1"
                  ? "2099-02-01T00:00:00Z"
                  : "2099-02-02T00:00:00Z",
              status: "scheduled",
              playerIds: Object.values(inventories)
                .flat()
                .map((c) => c.player_id),
            },
          ]),
        ],
      );
    }
  async function asUser(u: string) {
    await q(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.multi_sport','isolated-preview',false),set_config('docked.fantasy_channel','beta',false)",
      [u, JSON.stringify({ sub: u, aal: "aal2", session_id: sessions[u] })],
    );
  }
  await asUser(user);
  const command = async (
    action: string,
    competition: string,
    selections: unknown[],
    revision: number,
    request = randomUUID(),
  ) =>
    (
      await q("select sports_feed.seven_command($1,$2,$3) result", [
        action,
        JSON.stringify({ competition_id: competition, selections, revision }),
        request,
      ])
    )[0].result;
  const state = async () =>
    (await q("select sports_feed.sport_sandbox_state($1) state", [sport.id]))[0]
      .state;
  return {
    pg,
    q,
    user,
    other,
    inventories,
    rounds,
    config,
    asUser,
    sessions,
    command,
    state,
  };
}
