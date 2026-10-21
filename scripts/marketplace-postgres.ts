import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { wallet, validateCredits } from "../src/core/credits-sandbox";
import { mkdir, writeFile } from "node:fs/promises";
import { type CreditsState } from "../src/core/credits-sandbox";
import {
  marketplaceFixture,
  marketActors,
} from "../tests/fixtures/marketplace-state";
import { rarityConfiguration } from "../src/core/card-rarity";
import { initialMemberTestCredits } from "../src/core/member-test-wallet";
import { nflSeven, sevenRules } from "../src/core/nfl-seven";
async function main() {
  await mkdir("docs/qa/marketplace-operational", { recursive: true });
  await writeFile(
    "docs/qa/marketplace-operational/postgres.json",
    JSON.stringify({
      passed: false,
      status: "RUNNING_OR_INCOMPLETE",
      at: new Date().toISOString(),
    }),
  );
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  const target = new URL(url);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/docked_free_play_test_\d+$/);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const connections = marketActors.map(() =>
    postgres(url, {
      max: 1,
      onnotice: () => {},
      connection: { options: "-c role=docked_beta_app" },
    }),
  );
  const stores = connections.map((c) => new CreditsSandboxStore(c));
  const pg = {
    exec: async (q: string) => {
      await sql.unsafe(q);
    },
    query: async <T extends Record<string, unknown> = Record<string, any>>(
      q: string,
      args: any[] = [],
    ) => ({ rows: await sql.unsafe<T[]>(q, args) }),
    close: async () => {
      await Promise.all(connections.map((c) => c.end()));
      await sql.end();
    },
  };
  const checks: string[] = [];
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    const s = marketplaceFixture(),
      own = (i: number) =>
        Object.keys(s.cards).filter(
          (id) => s.commerce.cards[id].owner === marketActors[i].id,
        );
    for (const a of marketActors) {
      await pg.query("insert into auth.users(id)values($1)", [a.id]);
      await pg.query(
        "insert into beta_fantasy.members(user_id,expires_at)values($1,'infinity')",
        [a.id],
      );
    }
    await pg.query(
      "insert into credits_sandbox.rarity_configuration values($1,$2)",
      [rarityConfiguration.version, rarityConfiguration],
    );
    for (const p of Object.values(s.economy!.players))
      await pg.query(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [p.id, p.sport, p.provider, p.providerId, p.assetKind, p],
      );
    for (const p of Object.values(s.economy!.products))
      await pg.query(
        "insert into credits_sandbox.pack_configuration values($1,$2)",
        [p.version, p],
      );
    await pg.query("insert into credits_sandbox.state values(true,0,$1)", [
      initialMemberTestCredits(),
    ]);
    for (const j of s.journal)
      await pg.query(
        "insert into credits_sandbox.journal(id,document)values($1,$2)",
        [j.id, j],
      );
    await pg.query("update credits_sandbox.state set document=$1", [s]);
    const read = async () =>
      (
        await pg.query<{ document: CreditsState }>(
          "select document from credits_sandbox.state",
        )
      ).rows[0].document;
    const run = async (
      i: number,
      c: unknown,
      request = randomUUID(),
      failAfterWrite = false,
    ): Promise<any> => {
      if (failAfterWrite)
        await sql.unsafe(
          `create function public.qa_fail_settlement() returns trigger language plpgsql as $$begin raise exception 'LOCAL injected failure after settlement writes'; end$$; create trigger zz_qa_failure after update on credits_sandbox.state for each row execute function public.qa_fail_settlement()`,
        );
      try {
        return await stores[i].execute(marketActors[i], request, c);
      } finally {
        if (failAfterWrite)
          await sql.unsafe(
            "drop trigger zz_qa_failure on credits_sandbox.state;drop function public.qa_fail_settlement()",
          );
      }
    };
    const pids = await Promise.all(
      connections.map((c) => c`select pg_backend_pid() pid,current_user role`),
    );
    assert.equal(new Set(pids.map((r) => r[0].pid)).size, 3);
    assert.ok(pids.every((r) => r[0].role === "docked_beta_app"));
    const contention: { scenario: string; waitingConnections: number }[] = [];
    const contended = async (
      scenario: string,
      actions: (() => Promise<unknown>)[],
    ) => {
      let pending!: Promise<PromiseSettledResult<unknown>[]>;
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71820342)`;
        pending = Promise.allSettled(actions.map((action) => action()));
        let count = 0;
        for (let tries = 0; tries < 60; tries++) {
          const rows =
            await tx`select count(*)::int n from pg_stat_activity where pid=any(${pids.map((r) => r[0].pid)}) and wait_event_type='Lock'`;
          count = rows[0].n;
          if (count >= 2) break;
          await tx`select pg_sleep(0.05)`;
        }
        contention.push({ scenario, waitingConnections: count });
        assert.ok(
          count >= 2,
          "Two separate connections must actually wait on the shared transaction lock",
        );
      });
      return pending;
    };
    checks.push(
      "Three distinct PostgreSQL backend PIDs using actual CreditsSandboxStore and docked_beta_app role; synthetic actors, not HTTP authentication",
    );
    const list = randomUUID(),
      card = own(0)[0];
    await run(0, { kind: "list", card, price: 1000 }, list);
    const q1 = randomUUID(),
      q2 = randomUUID();
    await run(1, { kind: "review-buy", listing: list }, q1);
    await run(2, { kind: "review-buy", listing: list }, q2);
    const cmd = (q: string) => ({
      kind: "buy",
      listing: list,
      review: q,
      expectedPrice: 1000,
      policy: s.policy.version,
      confirmed: true,
    });
    assert.notEqual(marketActors[1].id, marketActors[2].id); // DISTINCT buyers
    const originalInstances = structuredClone(s.economy!.instances);
    const originalSupply = structuredClone(s.economy!.definitions);
    const outcomes = await contended("distinct-buyers", [
      () => run(1, cmd(q1)),
      () => run(2, cmd(q2)),
    ]);
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    checks.push(
      "Two DISTINCT buyers on separate connections: exactly one succeeds",
    );
    const sold = await read();
    // Current approved seller fee is 5%, half up, capped at 2,000.
    assert.equal(sold.listings[list].receipt?.net, 950);
    const bad = structuredClone(sold);
    bad.listings[list].receipt!.net = 1000;
    await assert.rejects(
      () => pg.query("update credits_sandbox.state set document=$1", [bad]),
      /immutable/,
    );
    assert.deepEqual(await read(), sold);
    const l2 = randomUUID();
    await run(0, { kind: "list", card: own(0)[1], price: 1000 }, l2);
    const review = randomUUID();
    await run(1, { kind: "review-buy", listing: l2 }, review);
    const cancelRace = await contended("cancel-purchase", [
      () => run(0, { kind: "cancel-listing", listing: l2 }),
      () => run(1, { ...cmd(review), listing: l2 }),
    ]);
    assert.equal(cancelRace.filter((x) => x.status === "fulfilled").length, 1);
    checks.push("Separate-connection purchase/cancellation: one winner");
    const dupe = structuredClone(await read());
    dupe.listings.fake = {
      member: marketActors[0].id,
      card: own(0)[2],
      version: 1,
      price: 1,
      status: "OPEN",
    };
    dupe.listings.fake2 = { ...dupe.listings.fake };
    await assert.rejects(
      () => pg.query("update credits_sandbox.state set document=$1", [dupe]),
      /One active/,
    );
    // Fault after both state and journal writes: transaction must restore every source.
    const faultListing = randomUUID(),
      faultQuote = randomUUID();
    await run(0, { kind: "list", card: own(0)[7], price: 100 }, faultListing);
    await run(1, { kind: "review-buy", listing: faultListing }, faultQuote);
    const faultBefore = await read(),
      journalBefore = (
        await pg.query("select * from credits_sandbox.journal order by id")
      ).rows;
    const linesBefore = (
      await pg.query(
        "select * from credits_sandbox.lines order by journal,ordinal",
      )
    ).rows;
    const historyBefore = (
      await pg.query("select * from credits_sandbox.history order by revision")
    ).rows;
    await assert.rejects(
      () =>
        run(
          1,
          { ...cmd(faultQuote), listing: faultListing, expectedPrice: 100 },
          randomUUID(),
          true,
        ),
      /injected/,
    );
    assert.deepEqual(await read(), faultBefore);
    assert.deepEqual(
      (await pg.query("select * from credits_sandbox.journal order by id"))
        .rows,
      journalBefore,
    );
    assert.deepEqual(
      (
        await pg.query(
          "select * from credits_sandbox.lines order by journal,ordinal",
        )
      ).rows,
      linesBefore,
    );
    assert.deepEqual(
      (
        await pg.query(
          "select * from credits_sandbox.history order by revision",
        )
      ).rows,
      historyBefore,
    );
    await run(0, { kind: "cancel-listing", listing: faultListing });
    checks.push(
      "Injected AFTER UPDATE failure rolls back balance, ownership, receipt and journal writes",
    );
    // Retired swaps cannot reserve a card or prevent its fixed-price purchase.
    const swapListing = randomUUID(),
      swapQuote = randomUUID(),
      swap = randomUUID();
    await run(0, { kind: "list", card: own(0)[8], price: 1000 }, swapListing);
    await run(2, { kind: "review-buy", listing: swapListing }, swapQuote);
    await assert.rejects(
      () =>
        run(
          0,
          {
            kind: "offer",
            other: marketActors[1].id,
            give: [own(0)[8]],
            take: [own(1)[8]],
            feeEach: 50,
          },
          swap,
        ),
      /disabled/,
    );
    await run(2, { ...cmd(swapQuote), listing: swapListing });
    assert.equal((await read()).listings[swapListing].status, "SOLD");
    checks.push(
      "Retired swap creation rejected; fixed-price purchase remains available",
    );
    // Dedicated, future test entries; no retrospective member competition or grants.
    await pg.query(
      "insert into beta_fantasy.lineup_configurations values($1,$2)",
      [nflSeven.version, nflSeven],
    );
    const rules = sevenRules();
    await pg.query(
      "insert into beta_fantasy.scoring_rules(version,rules)values($1,$2)",
      [rules.version, rules],
    );
    const reserved = own(0)[2],
      rounds = [randomUUID(), randomUUID()];
    for (const [i, id] of rounds.entries()) {
      await pg.query(
        "insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values($1,'LOCAL reservation acceptance','nfl','2099',42,clock_timestamp()+interval '1 day',$2,(select id from beta_fantasy.scoring_rules where version=$3),'No cash prize')",
        [
          id,
          {
            lineup_version: nflSeven.version,
            mode: i ? "OPEN" : "SALARY_CAP",
            inventory_scope: "invited-nfl-test-v2",
          },
          rules.version,
        ],
      );
      const snapshot = nflSeven.slots.map((slot, j) => ({
        slot: slot.id,
        card_id: j ? own(0)[j + 2] : reserved,
        player_id: `local-${j}`,
        kickoff: new Date(Date.now() + 86400000).toISOString(),
        rarity: "RARE",
        multiplierTenths: 11,
        salary: 600000,
      }));
      await pg.query(
        "insert into beta_fantasy.entries(competition_id,user_id,cards,snapshot)values($1,$2,$3,$4)",
        [id, marketActors[0].id, snapshot.map((x) => x.card_id), snapshot],
      );
    }
    await assert.rejects(
      () => run(0, { kind: "list", card: reserved, price: 1000 }),
      /unlocked/,
    );
    await pg.query("delete from beta_fantasy.entries where competition_id=$1", [
      rounds[0],
    ]);
    await assert.rejects(
      () => run(0, { kind: "list", card: reserved, price: 1000 }),
      /unlocked/,
    );
    // Real PostgreSQL connections; inventory and auth below remain explicit local fixture adapters. Exercise the real seven_command against
    // a LOCAL inventory/auth adapter, NOT an authenticated HTTP integration.
    const available = Object.entries((await read()).commerce.cards)
      .filter(([, c]) => c.owner === marketActors[0].id)
      .map(([id]) => id);
    const qaInventory = nflSeven.slots.map((slot, i) => ({
      id: available[i],
      player_id: `race-player-${i}`,
      tier: "RARE",
      position: slot.positions[0],
      status: "active",
      multiplierTenths: 11,
      rarityVersion: rarityConfiguration.version,
    }));
    await pg.exec(`create table public.qa_market_inventory(cards jsonb);
      create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;
      create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;
      create or replace function sports_feed.seven_inventory(u uuid) returns jsonb language sql as $$select coalesce(jsonb_agg(c || jsonb_build_object('listed',exists(select 1 from jsonb_each(d.document->'listings') l where l.value->>'card'=c->>'id' and l.value->>'status'='OPEN'))),'[]') from public.qa_market_inventory i, jsonb_array_elements(i.cards)c,credits_sandbox.state d where d.document#>>array['commerce','cards',c->>'id','owner']=u::text$$;`);
    await pg.query("insert into public.qa_market_inventory values($1)", [
      qaInventory,
    ]);
    await pg.query(
      "insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','LOCAL QA',true,'Local integration fixture')",
      [marketActors[0].id],
    );
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
      marketActors[0].id,
    ]);
    const raceRound = randomUUID(),
      stream = `beta-real:qa:${raceRound}`,
      raceListing = randomUUID(),
      raceQuote = randomUUID();
    await pg.query(
      "insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values($1,'LOCAL purchase-entry race','nfl','2099',44,clock_timestamp()+interval '1 day',$2,(select id from beta_fantasy.scoring_rules where version=$3),'No cash prize')",
      [
        raceRound,
        {
          lineup_version: nflSeven.version,
          mode: "OPEN",
          inventory_scope: "invited-nfl-test-v2",
        },
        rules.version,
      ],
    );
    await pg.query("insert into sports_feed.streams(id)values($1)", [stream]);
    await pg.query(
      "insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,$2,'member',$3)",
      [
        raceRound,
        stream,
        [
          {
            fixtureId: stream + ":f",
            scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
            playerIds: qaInventory.map((c) => c.player_id),
          },
        ],
      ],
    );
    // Choose a card outside the reserved slot; old synthetic snapshots reserve all
    // selected cards, so use the already withdrawn round and lock remaining one.
    await pg.query(
      "insert into beta_fantasy.slot_locks(competition_id,user_id,slot,snapshot,locked_at) select competition_id,user_id,s->>'slot',s,clock_timestamp() from beta_fantasy.entries,jsonb_array_elements(snapshot)s where competition_id=$1 on conflict do nothing",
      [rounds[1]],
    );
    await run(
      0,
      {
        kind: "list",
        card: qaInventory.find((c) => c.id !== reserved)!.id,
        price: 1000,
      },
      raceListing,
    );
    await run(1, { kind: "review-buy", listing: raceListing }, raceQuote);
    const entryRace = await Promise.allSettled([
      pg.query("select sports_feed.seven_command('seven_enter',$1,$2)", [
        {
          competition_id: raceRound,
          selections: nflSeven.slots.map((slot, i) => ({
            slot: slot.id,
            card: qaInventory[i].id,
          })),
          revision: 0,
        },
        randomUUID(),
      ]),
      run(1, { ...cmd(raceQuote), listing: raceListing }),
    ]);
    assert.equal(
      entryRace[0].status,
      "rejected",
      "Listed card cannot enter; if sale wins first, missing ownership rejects instead",
    );
    assert.equal(entryRace[1].status, "fulfilled");
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from beta_fantasy.entries where competition_id=$1",
          [raceRound],
        )
      ).rows[0].n,
      0,
    );
    checks.push(
      "Real seven_command and purchase on separate connections: listed/lost-ownership card cannot enter; both-mode pre-lock reservations enforced",
    );
    // Materialise a legitimate saved snapshot as locked: equivalent to kickoff;
    // snapshots cannot be rewritten even after transfer. No scheduler bypass in app.
    await pg.query(
      "insert into beta_fantasy.slot_locks(competition_id,user_id,slot,snapshot,locked_at) select competition_id,user_id,s->>'slot',s,clock_timestamp() from beta_fantasy.entries,jsonb_array_elements(snapshot)s where competition_id=$1 on conflict do nothing",
      [rounds[1]],
    );
    const beforeLocks = (
      await pg.query(
        "select snapshot from beta_fantasy.slot_locks order by slot",
      )
    ).rows;
    const l3 = randomUUID();
    await run(0, { kind: "list", card: reserved, price: 1000 }, l3);
    const q3 = randomUUID();
    await run(1, { kind: "review-buy", listing: l3 }, q3);
    await run(1, { ...cmd(q3), listing: l3 });
    assert.deepEqual(
      (
        await pg.query(
          "select snapshot from beta_fantasy.slot_locks order by slot",
        )
      ).rows,
      beforeLocks,
    );

    assert.deepEqual(
      (await read()).economy!.instances,
      originalInstances,
      "Permanent serials and mint records unchanged",
    );
    assert.deepEqual(
      (await read()).economy!.definitions,
      originalSupply,
      "Supply unchanged",
    );

    checks.push(
      "Permanent identities, supply and locked snapshots unchanged after transfers",
    );
    // Replayed transport result: return the persisted result even after later ownership changes.
    const replayListing = randomUUID(),
      replayQuote = randomUUID(),
      replayID = randomUUID();
    const current = await read(),
      sellerCard = Object.entries(current.commerce.cards).find(
        ([id, c]) =>
          c.owner === marketActors[2].id &&
          !Object.values(current.listings).some(
            (l) => l.card === id && l.status === "OPEN",
          ),
      )![0];
    await run(2, { kind: "list", card: sellerCard, price: 100 }, replayListing);
    await run(0, { kind: "review-buy", listing: replayListing }, replayQuote);
    const replayCommand = {
      ...cmd(replayQuote),
      listing: replayListing,
      expectedPrice: 100,
    };
    const original = await run(0, replayCommand, replayID);
    const stable = await read();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => run(0, replayCommand, replayID)),
    );
    for (const result of results) assert.deepEqual(result, original);
    assert.deepEqual(await read(), stable);
    assert.equal(original.receipt.fee, 5);
    assert.equal(original.receipt.net, 95);
    const final = await read();
    validateCredits(final);
    assert.ok(marketActors.every((a) => wallet(final, a.id).available >= 0));
    assert.deepEqual(
      Object.keys(final.economy!.instances).sort(),
      Object.keys(s.economy!.instances).sort(),
    );
    const issued = (x: CreditsState) =>
      x.journal.reduce(
        (total, j) =>
          total +
          Math.max(
            0,
            j.lines
              .filter((l) => l.account.startsWith("lot:"))
              .reduce((n, l) => n + l.credits, 0),
          ),
        0,
      );
    assert.ok(
      issued(s) > 0,
      "Fixture has funded wallets; conservation must not compare empty totals",
    );
    assert.equal(issued(final), issued(s));
    checks.push(
      "Lost-response/same-ID replay: identical original receipt, one settlement; 100/5/95; no negative wallets or new issuance",
    );
    // Both modes: actual SQL entry/edit and transfer serialize on the shared lock.
    // This is deliberately still a fixture identity/inventory mapping, not Auth.
    const holdings = marketActors.map((a) =>
      Object.entries(final.commerce.cards)
        .filter(
          ([id, c]) =>
            c.owner === a.id &&
            !Object.values(final.listings).some(
              (l) => l.card === id && l.status === "OPEN",
            ),
        )
        .map(([id]) => id),
    );
    const seller = holdings.findIndex((ids) => ids.length >= 9);
    assert.ok(seller >= 0, "Nine isolated owned cards required");
    const buyer = (seller + 1) % 3,
      ids = holdings[seller].slice(0, 9);
    const inventory = ids.map((id, i) => ({
      id,
      player_id: `edit-player-${i}`,
      tier: "RARE",
      position: nflSeven.slots[i < 7 ? i : 0].positions[0],
      status: "active",
      multiplierTenths: 11,
      rarityVersion: rarityConfiguration.version,
    }));
    await pg.query("update public.qa_market_inventory set cards=$1", [
      inventory,
    ]);
    await pg.query(
      "insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','LOCAL QA',true,'Local integration fixture') on conflict(user_id) do nothing",
      [marketActors[seller].id],
    );
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
      marketActors[seller].id,
    ]);
    const kickoff = (
      await pg.query<{ at: string }>(
        "select (clock_timestamp()+interval '8 seconds')::text at",
      )
    ).rows[0].at;
    const editRounds: string[] = [];
    const selections = nflSeven.slots.map((slot, i) => ({
      slot: slot.id,
      card: ids[i],
    }));
    for (const [index, mode] of ["SALARY_CAP", "OPEN"].entries()) {
      const round = randomUUID(),
        streamId = `beta-real:qa:${round}`;
      editRounds.push(round);
      await pg.query(
        "insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values($1,'LOCAL edit boundary acceptance','nfl','2099',$2,$3,$4,(select id from beta_fantasy.scoring_rules where version=$5),'No cash prize')",
        [
          round,
          60 + index,
          kickoff,
          {
            lineup_version: nflSeven.version,
            mode,
            inventory_scope: "invited-nfl-test-v2",
          },
          rules.version,
        ],
      );
      await pg.query("insert into sports_feed.streams(id)values($1)", [
        streamId,
      ]);
      await pg.query(
        "insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,$2,'member',$3)",
        [
          round,
          streamId,
          [
            {
              fixtureId: streamId + ":f",
              scheduledAt: kickoff,
              playerIds: inventory.map((c) => c.player_id),
            },
          ],
        ],
      );
      await pg.query("select sports_feed.seven_command('seven_enter',$1,$2)", [
        { competition_id: round, selections, revision: 0 },
        randomUUID(),
      ]);
      const listing = randomUUID(),
        quote = randomUUID();
      await run(
        seller,
        { kind: "list", card: ids[7 + index], price: 100 },
        listing,
      );
      await run(buyer, { kind: "review-buy", listing }, quote);
      const revised = selections.map((s, i) =>
        i ? s : { ...s, card: ids[7 + index] },
      );
      const raced = await Promise.allSettled([
        pg.query("select sports_feed.seven_command('seven_enter',$1,$2)", [
          { competition_id: round, selections: revised, revision: 1 },
          randomUUID(),
        ]),
        run(buyer, { ...cmd(quote), listing, expectedPrice: 100 }),
      ]);
      assert.equal(raced[0].status, "rejected");
      assert.equal(raced[1].status, "fulfilled");
      const entry = (
        await pg.query<{ cards: string[]; lineup_revision: number }>(
          "select cards,lineup_revision from beta_fantasy.entries where competition_id=$1",
          [round],
        )
      ).rows[0];
      assert.deepEqual(entry.cards, ids.slice(0, 7));
      assert.equal(entry.lineup_revision, 1);
    }
    await assert.rejects(
      () => run(seller, { kind: "list", card: ids[0], price: 100 }),
      /unlocked/,
    );
    // Observe a real server-time deadline; do not replace clock_timestamp or the guard.
    await pg.query(
      "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
      [kickoff],
    );
    await pg.query("select sports_feed.seven_lock_due()");
    const locked = (
      await pg.query(
        "select * from beta_fantasy.slot_locks where competition_id=any($1::uuid[]) order by competition_id,slot",
        [editRounds],
      )
    ).rows;
    assert.equal(locked.length, 14);
    for (const round of editRounds)
      await assert.rejects(
        () =>
          pg.query("select sports_feed.seven_command('seven_enter',$1,$2)", [
            {
              competition_id: round,
              selections: selections.map((s, i) =>
                i ? s : { ...s, card: ids[7] },
              ),
              revision: 1,
            },
            randomUUID(),
          ]),
        /Started|Locked/,
      );
    const afterLockListing = randomUUID(),
      afterLockQuote = randomUUID();
    await run(
      seller,
      { kind: "list", card: ids[0], price: 100 },
      afterLockListing,
    );
    await run(
      buyer,
      { kind: "review-buy", listing: afterLockListing },
      afterLockQuote,
    );
    await run(buyer, {
      ...cmd(afterLockQuote),
      listing: afterLockListing,
      expectedPrice: 100,
    });
    assert.deepEqual(
      (
        await pg.query(
          "select * from beta_fantasy.slot_locks where competition_id=any($1::uuid[]) order by competition_id,slot",
          [editRounds],
        )
      ).rows,
      locked,
    );
    validateCredits(await read());
    assert.equal(issued(await read()), issued(s));
    checks.push(
      "Both modes: entered edit/purchase races preserve original seven; same card in both modes blocks pre-lock transfer; actual server deadline materialises 14 immutable locks; later transfer preserves locked scoring inputs",
    );
    // The retired swap path must also reject direct creation in PostgreSQL.
    await pg.exec(
      `create or replace function beta_fantasy.swap_actor() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_fantasy.swap_read_state_before_marketplace() returns jsonb language sql as $$select '{}'::jsonb$$;`,
    );
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
      marketActors[0].id,
    ]);
    const fp = randomUUID(),
      fe = randomUUID(),
      fa = randomUUID(),
      fb = randomUUID(),
      expired = randomUUID();
    await pg.exec(
      `insert into beta_fantasy.sports values('nfl','{}',7) on conflict do nothing;insert into beta_fantasy.tiers values('RARE',2,5000) on conflict do nothing;`,
    );
    await pg.query(
      "insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season)values($1,'LOCAL expiry player','nfl','QB','TEST','#112233',1,'2099')",
      [fp],
    );
    await pg.query(
      "insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)values($1,$2,'RARE','2099','regular',10,'launched')",
      [fe, fp],
    );
    await pg.query(
      "insert into beta_fantasy.cards(id,edition_id,serial,owner_id,tradeable)values($1,$2,1,$3,true)",
      [fa, fe, marketActors[0].id],
    );
    await pg.query(
      "insert into beta_fantasy.cards(id,edition_id,serial,owner_id,tradeable)values($1,$2,2,$3,true)",
      [fb, fe, marketActors[1].id],
    );
    await assert.rejects(
      () =>
        pg.query(
          "insert into beta_fantasy.swaps(id,sender,recipient,give_card,take_card,give_revision,take_revision,fee_cents,policy_revision,expires_at)values($1,$2,$3,$4,$5,0,0,0,1,clock_timestamp()-interval '2 days')",
          [expired, marketActors[0].id, marketActors[1].id, fa, fb],
        ),
      /disabled/,
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from beta_private.audit_events where action='swap_expired' and subject=$1",
          [expired],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pg.query<{ owner_id: string }>(
          "select owner_id from beta_fantasy.cards where id=$1",
          [fa],
        )
      ).rows[0].owner_id,
      marketActors[0].id,
    );
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => pg.query("select * from credits_sandbox.state"),
      /permission/,
    );
    await assert.rejects(
      () =>
        pg.query("select credits_sandbox.market_context($1)", [
          marketActors[0].id,
        ]),
      /permission/,
    );
    await pg.exec("reset role");
    checks.push(
      "Ordinary SQL roles denied private aggregate and market context; no HTTP auth claim",
    );
    await mkdir("docs/qa/marketplace-operational", { recursive: true });
    await writeFile(
      "docs/qa/marketplace-operational/postgres.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          version: (await sql`select version() v`)[0].v,
          pids: pids.map((r) => r[0].pid),
          contention,
          checks,
          authentication:
            "Synthetic actor + SQL auth fixtures; actual HTTP/Supabase Auth NOT tested by this runner",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await pg.close();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error
      ? {
          name: e.name,
          message: e.message,
          stack: e.stack?.split("\n").slice(0, 3),
        }
      : "Local test failed",
  );
  process.exitCode = 1;
});
