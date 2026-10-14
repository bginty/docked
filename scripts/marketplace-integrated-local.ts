// Isolated synthetic acceptance only. Real SQL/auth/HTTP and production worker code;
// no hosted access, alternate identity functions, downloads or member impersonation.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { APIRequestContext } from "@playwright/test";
import { digest, type Period } from "../src/core/scoring-engine";
import { nflSeven, sevenRules } from "../src/core/nfl-seven";
import { registerNflRound } from "../src/server/nfl-member-rounds";
import { runNflCollection } from "../src/server/nfl-collection-worker";
import { reconcileNflBundle } from "../src/server/nfl-postgame-reconcile";
import { nflResource } from "../src/server/nflverse-bundle";
import {
  nflverseRequiredColumns,
  type PostgameMapping,
} from "../src/core/postgame-nflverse";
import permit from "../config/nfl-postgame-permit.json";
import manifest from "../config/hosted-production.json";
import { writeFile } from "node:fs/promises";
import { wallet } from "../src/core/credits-sandbox";
type User = { id: string };
const season = 2026;
async function raw(
  sql: Sql,
  dataset: "rosters" | "weekly" | "pbp",
  rows: unknown[],
) {
  const body = {
    dataset,
    season,
    source: "https://example.invalid/local-synthetic-acceptance",
    rows,
  };
  await sql`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at) values('nflverse',${nflResource(dataset, season)},${digest(body)},${sql.json(body as never)},clock_timestamp(),'LOCAL SYNTHETIC ONLY — not downloaded NFL results',clock_timestamp()+interval '1 day') on conflict do nothing`;
  const [r] =
    await sql`select id from sports_feed.raw_revisions where provider='nflverse' and resource=${nflResource(dataset, season)} and body_hash=${digest(body)} and body is not null`;
  await sql`insert into sports_feed.postgame_cache(resource,raw_id,checked_at,next_attempt) values(${nflResource(dataset, season)},${r.id},clock_timestamp(),clock_timestamp()+interval '12 hours') on conflict(resource) do update set raw_id=excluded.raw_id,checked_at=excluded.checked_at`;
  return Number(r.id);
}
export async function prepareIntegratedCatalogue(sql: Sql, users: User[]) {
  await sql`update beta_fantasy.settings set enabled=true,deployment_mode='production',production_ref=${manifest.supabaseProjectRef},terms_version='local-http-qa-v1',privacy_version='local-http-qa-v1'`;
  await sql`update sports_feed.nfl_control set enabled=true`;
  for (const u of users) {
    await sql`insert into beta_fantasy.members(user_id,expires_at) values(${u.id},'infinity') on conflict do nothing`;
    if (
      !(
        await sql`select id from beta_private.consent_events where user_id=${u.id} and purpose='privacy'`
      ).length
    )
      await sql`insert into beta_private.consent_events(user_id,purpose,granted,version,actor) values(${u.id},'privacy',true,'local-http-qa-v1','isolated-fixture-operator')`;
  }
  const players = (
    await sql`select identity from credits_sandbox.permanent_players`
  ).map((r) => r.identity);
  assert.ok(
    players.every(
      (p) => p.provider === "nflverse" && p.providerId.startsWith("99-"),
    ),
    "Fresh synthetic canonical campaign required",
  );
  const rid = await raw(
    sql,
    "rosters",
    players.map((p) => ({
      gsis_id: p.providerId,
      full_name: p.name,
      position: p.position,
      team: p.currentTeam,
      status: "ACT",
      week: "1",
      season: String(season),
    })),
  );
  for (const p of players.filter((p) =>
    ["QB", "RB", "WR", "TE"].includes(p.position),
  )) {
    if (
      (
        await sql`select player_id from sports_feed.nfl_players where provider_id=${p.providerId}`
      ).length
    )
      continue;
    const id = randomUUID(),
      edition = randomUUID();
    await sql`insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season,status) values(${id},${p.name},'nfl',${p.position},${p.currentTeam},'#1677FF',1,'unknown','active')`;
    await sql`insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status) values(${edition},${id},'CORE','LOCAL ACCEPTANCE','regular',11,'launched')`;
    await sql`insert into sports_feed.nfl_players values(${id},${p.providerId},${edition},${p.currentTeam},'ACT',${rid},clock_timestamp(),${p.currentTeam})`;
    for (const u of users)
      await sql`select beta_fantasy.mint(${edition},${u.id},false,'isolated-local-acceptance',${u.id})`;
  }
}
export async function runIntegratedMarketplace(
  sql: Sql,
  contexts: APIRequestContext[],
  users: User[],
) {
  const checks: string[] = [];
  await sql`update sports_feed.nfl_rounds set next_check=clock_timestamp()+interval '1 day'`;
  const get = async (i: number, path = "/api/fantasy") => {
    const r = await contexts[i].get(path);
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  };
  const fantasy = async (
    i: number,
    action: string,
    payload: unknown,
    id = randomUUID(),
  ) => {
    const r = await contexts[i].post("/api/fantasy", {
      data: { action, payload, request_id: id },
    });
    return { status: r.status(), body: await r.json() };
  };
  const market = async (i: number, command: unknown, id = randomUUID()) => {
    const r = await contexts[i].post("/api/marketplace", {
      data: { request: id, command },
    });
    return { status: r.status(), body: await r.json() };
  };
  const ok = (r: { status: number; body: unknown }) =>
    assert.equal(r.status, 200, JSON.stringify(r.body));
  const state = () =>
    sql`select document from credits_sandbox.state`.then((r) => r[0].document);
  const initial = await get(0),
    inventory = initial.state.seven.inventory;
  assert.ok(inventory.length > 20);
  assert.ok(inventory.every((c: any) => c.status === "active"));
  const paid = inventory.filter(
    (c: any) => c.tier !== "CORE" && ["RB", "WR", "TE"].includes(c.position),
  );
  assert.ok(paid.length >= 2);
  const soldBefore = paid[0],
    retained = paid.find((c: any) => c.player_id !== soldBefore.player_id);
  assert.ok(retained);
  for (const c of [soldBefore, retained]) {
    const [p] =
      await sql`select provider_id from credits_sandbox.permanent_players where id=${c.player_id}`;
    assert.equal(c.provider_id, p.provider_id);
    assert.ok(p.provider_id.startsWith("99-"));
  }
  checks.push(
    "A: Actual catalogue joins resolve owned paid/Core cards to the same permanent NFL player; synthetic provider IDs explicitly isolated",
  );
  const week = Number(
    (
      await sql`select coalesce(max(round),0)+1 n from beta_fantasy.competitions`
    )[0].n,
  );
  const kickoff = new Date(Date.now() + 90000).toISOString(),
    gameId = `2026_${String(week).padStart(2, "0")}_NYJ_NE`,
    fixtureId = "local-marketplace-synthetic-game";
  const players = (
    await sql`select identity from credits_sandbox.permanent_players where identity->>'position' in ('QB','RB','WR','TE')`
  ).map((r) => r.identity);
  const mapping: PostgameMapping = {
    fixtureId,
    gameId,
    season,
    seasonType: "REG",
    home: "NE",
    away: "NYJ",
    endedAt: null,
    completionEvidence: "https://example.invalid/local-synthetic-acceptance",
    players: players.map((p) => ({
      playerId: p.id,
      gsisId: p.providerId,
      team: p.currentTeam,
      position: p.position,
    })),
  };
  const roundIds: string[] = [],
    streams: string[] = [];
  // Each run is a new isolated week. No mutation of previously accepted rounds.
  for (const mode of ["SALARY_CAP", "OPEN"] as const) {
    const id = `beta-real:nfl:seven:local-${mode.toLowerCase()}:${season}:${week}`;
    const period: Period = {
      id,
      label: `LOCAL SYNTHETIC ACCEPTANCE — ${mode}`,
      sport: "nfl",
      locksAt: kickoff,
      fixtures: [
        {
          id: fixtureId,
          scheduledAt: kickoff,
          playerIds: players.map((p) => p.id),
        },
      ],
      rules: sevenRules(),
      inventoryScope: "invited-nfl-test-v2",
      lineupVersion: nflSeven.version,
      competitionMode: mode,
    };
    const cid = await registerNflRound(
      sql,
      period,
      [
        {
          ...mapping,
          scheduledAt: kickoff,
          playerIds: players.map((p) => p.id),
        },
      ],
      {
        source: "https://example.invalid/local-synthetic-fixture",
        verifiedAt: new Date().toISOString(),
        completeRound: true,
        lockPolicy: "whole-round-before-first-kickoff",
        offsetSeconds: 0,
      },
    );
    roundIds.push(cid);
    streams.push(id);
  }
  const build = (cards: any[], priority: any[] = []) => {
    const chosen = new Set<string>();
    const selections: { slot: string; card: string }[] = [];
    for (const slot of nflSeven.slots) {
      const card = [
        ...priority,
        ...cards.filter((c) => c.tier === "CORE"),
      ].find(
        (c) => !chosen.has(c.player_id) && slot.positions.includes(c.position),
      );
      assert.ok(card, slot.id);
      chosen.add(card.player_id);
      selections.push({ slot: slot.id, card: card.id });
    }
    assert.ok(priority.every((c) => selections.some((s) => s.card === c.id)));
    return selections;
  };
  const chosen = build(inventory, [soldBefore, retained]);
  for (const id of roundIds)
    ok(
      await fantasy(0, "seven_enter", {
        competition_id: id,
        revision: 0,
        selections: chosen,
      }),
    );
  const buyerInv = (await get(1)).state.seven.inventory;
  for (const id of roundIds)
    ok(
      await fantasy(1, "seven_enter", {
        competition_id: id,
        revision: 0,
        selections: build(buyerInv),
      }),
    );
  assert.equal(
    (await market(0, { kind: "list", card: soldBefore.id, price: 1000 }))
      .status,
    400,
  );
  const ownerView = await get(0, "/api/marketplace");
  const reserved = ownerView.state.inventory.find(
    (c: any) => c.id === soldBefore.id,
  );
  assert.ok(reserved.transferReason);
  checks.push(
    "B/C: Both real HTTP entries reserve the exact owned card; listing rejected; owner reservation explanation present",
  );
  const replacement = inventory.find(
    (c: any) =>
      c.tier === "CORE" &&
      c.position === soldBefore.position &&
      !chosen.some(
        (s) =>
          inventory.find((p: any) => p.id === s.card)?.player_id ===
          c.player_id,
      ),
  );
  assert.ok(replacement);
  const replaced = chosen.map((s) =>
    s.card === soldBefore.id ? { ...s, card: replacement.id } : s,
  );
  ok(
    await fantasy(0, "seven_enter", {
      competition_id: roundIds[0],
      revision: 1,
      selections: replaced,
    }),
  );
  assert.equal(
    (await market(0, { kind: "list", card: soldBefore.id, price: 1000 }))
      .status,
    400,
  );
  ok(
    await fantasy(0, "seven_enter", {
      competition_id: roundIds[1],
      revision: 1,
      selections: replaced,
    }),
  );
  assert.notEqual(
    (
      await fantasy(0, "seven_enter", {
        competition_id: roundIds[0],
        revision: 1,
        selections: chosen,
      })
    ).status,
    200,
  );
  checks.push(
    "D/E: One-mode replacement still blocks; both replacements release; stale entry revision rejected",
  );
  const purchase = async (card: string) => {
    const before = await state(),
      listing = randomUUID(),
      review = randomUUID(),
      operation = randomUUID();
    ok(await market(0, { kind: "list", card, price: 1000 }, listing));
    ok(await market(1, { kind: "review-buy", listing }, review));
    const cmd = {
      kind: "buy",
      listing,
      review,
      expectedPrice: 1000,
      policy: before.policy.version,
      confirmed: true,
    };
    ok(await market(1, cmd, operation));
    const after = await state();
    ok(await market(1, cmd, operation));
    assert.deepEqual(await state(), after);
    assert.equal(after.commerce.cards[card].owner, users[1].id);
    assert.equal(after.listings[listing].receipt.fee, 75);
    assert.equal(after.listings[listing].receipt.net, 925);
    assert.equal(after.listings[listing].status, "SOLD");
    assert.equal(
      wallet(after, users[1].id).available,
      wallet(before, users[1].id).available - 1000,
    );
    assert.equal(
      wallet(after, users[0].id).available,
      wallet(before, users[0].id).available + 925,
    );
    for (const i of [0, 1])
      assert.ok((await get(i, "/api/marketplace?tab=activity")).state);
    assert.ok(
      (await get(1)).state.seven.inventory.some((c: any) => c.id === card),
    );
    assert.ok(
      !(await get(0)).state.seven.inventory.some((c: any) => c.id === card),
    );
    return { listing, operation };
  };
  await purchase(soldBefore.id);
  checks.push(
    "F/G: Different authenticated buyer settles once; 1000=75 commission+925 proceeds, ownership and both collections reconcile",
  );
  console.log(
    "Integrated chain: both reservations, replacement and pre-lock purchase passed; waiting for real local server kickoff.",
  );
  while (Date.now() <= Date.parse(kickoff))
    await new Promise((r) =>
      setTimeout(r, Math.min(1000, Date.parse(kickoff) - Date.now() + 25)),
    );
  // Actual scheduled worker invokes the supported lock path, not a fabricated snapshot.
  const pending = await runNflCollection(sql, "reconcile", season);
  assert.equal(pending.status, "pending-review");
  const locks =
    await sql`select competition_id,user_id,slot,snapshot,locked_at from beta_fantasy.slot_locks where competition_id=any(${roundIds}) order by competition_id,user_id,slot`;
  assert.equal(locks.length, 28);
  assert.notEqual(
    (
      await fantasy(2, "seven_enter", {
        competition_id: roundIds[0],
        revision: 0,
        selections: build((await get(2)).state.seven.inventory),
      })
    ).status,
    200,
  );
  await purchase(retained.id);
  assert.deepEqual(
    await sql`select competition_id,user_id,slot,snapshot,locked_at from beta_fantasy.slot_locks where competition_id=any(${roundIds}) order by competition_id,user_id,slot`,
    locks,
  );
  const buyerEntry = (await get(1)).state.seven.entries.find(
    (e: any) => e.competition_id === roundIds[0],
  );
  const bad = buyerEntry.snapshot.map((c: any) => ({
    slot: c.slot,
    card: c.card_id,
  }));
  const suitable = bad.find((s: any) =>
    nflSeven.slots
      .find((x) => x.id === s.slot)!
      .positions.includes(retained.position),
  );
  suitable.card = retained.id;
  assert.notEqual(
    (
      await fantasy(1, "seven_enter", {
        competition_id: roundIds[0],
        revision: 1,
        selections: bad,
      })
    ).status,
    200,
  );
  checks.push(
    "H: Worker created 28 actual lock snapshots at server kickoff; transfer preserves them; late first entry and buyer insertion rejected",
  );
  // Synthetic retained source records test production reconciliation, not actual NFL scores.
  // Compressed fixture chronology supplies an already-aged completion observation;
  // the production six-hour predicate is unchanged. No source request/cooldown bypass.
  const pbp = [
    {
      game_id: gameId,
      home_team: "NE",
      away_team: "NYJ",
      play_id: "1",
      play_deleted: "0",
      play_type_nfl: "END_GAME",
      home_score: "0",
      away_score: "0",
      qtr: "4",
      touchdown: "0",
    },
  ];
  const pbpId = await raw(sql, "pbp", pbp);
  await sql`insert into sports_feed.completions(game_id,first_observed_at,first_raw_id) values(${gameId},clock_timestamp()-interval '7 hours',${pbpId}) on conflict do nothing`;
  const rows = players.map((p) => ({
    ...Object.fromEntries(nflverseRequiredColumns.map((k) => [k, "0"])),
    player_id: p.providerId,
    player_display_name: p.name,
    position: p.position,
    season: String(season),
    season_type: "REG",
    week: String(week),
    game_id: gameId,
    team: p.currentTeam,
    opponent_team: p.currentTeam === "NE" ? "NYJ" : "NE",
    rushing_yards: "100",
  }));
  let weeklyId = await raw(sql, "weekly", rows);
  const score = async () => {
    for (const cid of roundIds) {
      await sql`update sports_feed.nfl_rounds set next_check=clock_timestamp(),lease_until=null where competition_id=${cid}`;
      const result = await runNflCollection(sql, "reconcile", season);
      assert.equal(result.status, "reconciled", JSON.stringify(result));
    }
  };
  await score();
  const journal = async (id: string) =>
    (
      await sql`select revision,body,calculated from sports_feed.journal where stream_id=${id} order by revision desc limit 1`
    )[0];
  const before = await Promise.all(streams.map(journal));
  for (const j of before) {
    assert.equal(j.body.entries.length, 2);
    assert.equal(j.body.sources.length, 1);
    assert.equal(j.calculated.rows.length, 2);
    assert.ok(j.calculated.rows.every((r: any) => r.centipoints !== null));
    const seller = j.calculated.rows.find((r: any) => r.member === users[0].id);
    assert.equal(seller.centipoints, 6000 + 1000 * retained.multiplier);
  }
  await score();
  assert.deepEqual(await Promise.all(streams.map(journal)), before);
  rows.find((r) => r.player_id === retained.provider_id)!.rushing_yards = "120";
  weeklyId = await raw(sql, "weekly", rows);
  for (const stream of streams)
    await reconcileNflBundle(
      sql,
      stream,
      weeklyId,
      pbpId,
      mapping,
      permit,
      { id: "local-authorised-correction-reviewer", role: "reviewer" },
      "LOCAL SYNTHETIC correction acceptance; not genuine NFL results",
    );
  const corrected = await Promise.all(streams.map(journal));
  for (let i = 0; i < 2; i++) {
    assert.equal(corrected[i].body.sources.length, 2);
    assert.deepEqual(corrected[i].body.entries, before[i].body.entries);
    assert.notDeepEqual(corrected[i].calculated, before[i].calculated);
    assert.equal(
      corrected[i].calculated.rows.find((r: any) => r.member === users[0].id)
        .centipoints,
      6000 + 1200 * retained.multiplier,
    );
  }
  for (const stream of streams)
    await reconcileNflBundle(
      sql,
      stream,
      weeklyId,
      pbpId,
      mapping,
      permit,
      { id: "local-authorised-correction-reviewer", role: "reviewer" },
      "LOCAL SYNTHETIC correction acceptance; not genuine NFL results",
    );
  assert.deepEqual(await Promise.all(streams.map(journal)), corrected);
  const member = await get(0);
  assert.ok(JSON.stringify(member.state).includes(streams[0]));
  assert.deepEqual(
    await sql`select competition_id,user_id,slot,snapshot,locked_at from beta_fantasy.slot_locks where competition_id=any(${roundIds}) order by competition_id,user_id,slot`,
    locks,
  );
  checks.push(
    "I: Actual collection/reconciliation worker, retained weekly+PBP sources, member read, correction and replay preserve locked seller entitlement after transfer; no duplicate scores/settlements",
  );
  await writeFile(
    "docs/qa/marketplace-authenticated/integrated-scoring.json",
    JSON.stringify(
      {
        scope:
          "LOCAL SYNTHETIC compressed chronology — not NFL Week 6 or provider acceptance",
        rounds: roundIds,
        streams,
        before: before.map((j) => j.calculated),
        corrected: corrected.map((j) => j.calculated),
        locks: locks.length,
        hosted: false,
      },
      null,
      2,
    ),
  );
  return checks;
}
