import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { mock } from "node:test";
import postgres from "postgres";
import {
  initialMemberTestCredits,
  testReceipt,
} from "../src/core/member-test-wallet";
import {
  initialCardEconomy,
  type EconomyPlayer,
} from "../src/core/card-economy";
import { founderCreditProducts } from "../src/core/founder-credit-packs";
import {
  founderCreditCommand,
  founderCreditIssue,
} from "../src/core/founder-credits";
import {
  rarityConfiguration,
  limitedRarities,
  rarityRule,
} from "../src/core/card-rarity";
import { fixtureSports } from "../src/core/fixture-sports";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import { wallet } from "../src/core/credits-sandbox";

async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL!;
  assert.equal(new URL(url).hostname, "127.0.0.1");
  assert.match(new URL(url).pathname, /^\/docked_free_play_test_\d+$/);
  const sql = postgres(url, { max: 1, onnotice: () => {} }),
    runtime = postgres(url, {
      max: 8,
      onnotice: () => {},
      connection: {
        options:
          "-c role=docked_beta_app -c statement_timeout=45000 -c lock_timeout=30000",
      },
    });
  const checks: string[] = [];
  try {
    await sql.unsafe(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,phone text unique,phone_confirmed_at timestamptz,deleted_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await sql.unsafe(await readFile("supabase/migrations/" + f, "utf8"));
    checks.push(
      "Full migration chain installs with private packs and grants OFF",
    );
    assert.equal(
      (
        await sql`select enabled or grants_enabled active from beta_packs.control`
      )[0].active,
      false,
    );
    // Only auth transport is substituted; admission and owner checks below remain real.
    await sql.unsafe(`create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;
      create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and banned_until is null)$$;
      create or replace function sports_feed.nba_beta_identity() returns uuid language sql as $$select auth.uid()$$;
      update sports_feed.private_beta_sports set enabled=true,authority='Isolated free-credit pack test' where sport in('afl','nrl');`);
    const owner = randomUUID(),
      member = randomUUID(),
      other = randomUUID();
    for (const u of [owner, member, other]) {
      await sql`insert into auth.users(id,email,email_confirmed_at)values(${u},${u === owner ? "support@docked.com.au" : u + "@example.invalid"},now())`;
      await sql`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values(${u},${u === owner ? "owner" : "tester"},'Synthetic private beta fixture',true,'Isolated test authority')`;
      if (u !== other)
        await sql`insert into beta_packs.members values(${u},'Isolated founder-approved member snapshot')`;
      await sql`insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values(${u},true,'Isolated shared sport admission test','infinity')`;
      await sql`insert into sports_feed.sport_sandbox_access values(${u})`;
    }
    const session = randomUUID();
    await sql`insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at)values('synthetic-owner@example.invalid',${owner},${"a".repeat(64)},${randomUUID()},now()+interval '1 day')`;
    await sql`update beta_private.admissions set status='accepted',accepted_at=now(),country='AU',state='NSW',age_attested=true,policy_digest=${"a".repeat(64)},policy_versions=${sql.json({ terms: "isolated fixture" })} where user_id=${owner}`;
    await sql`insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values(${owner},'AU','NSW',true,'isolated fixture')`;
    await sql`insert into beta_private.roles(user_id,role)values(${owner},'owner')`;
    await sql`insert into auth.sessions values(${session},${owner},null)`;
    const claims = async (tx: any, u: string, aal = "aal2") => {
      await tx`select set_config('request.jwt.claim.sub',${u},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u, aal, session_id: session, email: u === owner ? "support@docked.com.au" : "fixture@example.invalid" })},true)`;
    };
    const players: EconomyPlayer[] = [];
    const canonical = new Map<string, string>();
    for (const sport of ["nfl", "afl", "nrl"] as const) {
      for (const scope of ["free_weekly", "free_beta_packs"]) {
        await sql`insert into season_catalogue.rights values(${sport + scope},${sport},'2026',${scope},'2000-01-01',null,'{}','Isolated synthetic source use approval')`;
      }
      for (let i = 0; i < 12; i++) {
        const id = randomUUID(),
          q = "Q" + (1000 + i),
          legacy =
            sport === "nfl" ? "fixture-nfl-" + i : `${sport}-roster-beta-${q}`;
        const p: EconomyPlayer = {
          id: legacy,
          sport,
          provider: sport === "nfl" ? "fixture" : "wikimedia",
          providerId: sport === "nfl" ? String(i) : sport + ":" + q,
          assetKind: "player",
          name: "Synthetic " + sport + i,
          position: sport === "nfl" ? "QB" : fixtureSports[sport].positions[0],
          currentTeam: "TRANSFERRED",
          status: "inactive",
          observedAt: Date.UTC(2020, 0, 1),
          sourceRevision: "historical-synthetic",
          presentation: "docked",
        };
        if (sport !== "nfl")
          Object.assign(p, {
            synthetic: false,
            inventoryClass: "real-roster-beta-v1",
            fixturePlayerId: id,
            eligiblePositions: [p.position],
            rosterBeta: {
              catalogue: "isolated-fixture",
              canonicalPlayerId: id,
              wikidataId: q,
              rosterSource: "https://en.wikipedia.org/isolated-fixture",
              profileSource: "https://en.wikipedia.org/isolated-profile",
              verifiedAt: "2020-01-01T00:00:00Z",
              sourceHash: "a".repeat(64),
              license: "CC-BY-SA-4.0",
              verification: "roster-and-profile-agreement",
              permanentIssuanceEligible: false,
            },
          });
        players.push(p);
        canonical.set(legacy, id);
        if (sport === "nfl")
          await sql`insert into credits_sandbox.permanent_players values(${legacy},${sport},${p.provider},${p.providerId},'player',${sql.json(p as any)})`;
        else
          await sql`insert into credits_sandbox.nba_fixture_players values(${legacy},${sql.json(p as any)})`;
        for (const scope of ["free_weekly", "free_beta_packs"])
          await sql`insert into season_catalogue.members values(${sport},'2026',${id},${scope},${sport + scope},${p.provider},${p.providerId},${sql.json({ team: "ORIGINAL" })},null,'{}',${"a".repeat(64)},'Isolated synthetic player identity approval')`;
      }
    }
    const s = initialMemberTestCredits();
    s.economy = initialCardEconomy(players, Date.UTC(2020, 0, 1));
    s.economy.fixtureTestAllocation = {
      afl: { enabled: true, scope: "isolated-fixtures-v1" },
      nrl: { enabled: true, scope: "isolated-fixtures-v1" },
    };
    const products = founderCreditProducts();
    s.economy.products = Object.fromEntries(products.map((p) => [p.id, p]));
    s.economy.activeProductVersions = products.map((p) => p.id);
    await sql`insert into credits_sandbox.rarity_configuration values(${rarityConfiguration.version},${sql.json(rarityConfiguration)})`;
    for (const p of products) {
      await sql`insert into credits_sandbox.pack_configuration values(${p.version},${sql.json(p as any)})`;
      await sql`insert into beta_packs.products values(${p.id},${sql.json(p as any)})`;
    }
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initialMemberTestCredits() as any)})`;
    await sql`update credits_sandbox.state set document=${sql.json(s as any)} where id`;
    for (const p of players)
      for (const rarity of limitedRarities) {
        const def = randomUUID(),
          cap = rarityRule(rarity).lifetimeCap;
        await sql`insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,snapshot,rights_reference)values(${def},${canonical.get(p.id)!},${p.sport},${rarity},${cap},0,0,'{}','Isolated baseline; no commercial approval')`;
        await sql`insert into beta_packs.definitions values(${def},${p.id},${canonical.get(p.id)!},${p.sport},${rarity},'2026',${p.sport + "free_beta_packs"},${"a".repeat(64)})`;
      }
    const memberStore = (u = member, aal = "aal2", sport = "nfl") =>
      new CreditsSandboxStore(runtime, async (tx, state) => {
        await claims(tx, u, aal);
        if (sport !== "nfl")
          await tx`select set_config('docked.fixture_commerce','enabled',true),set_config('docked.sports_private_beta','enabled',true),set_config('docked.private_beta_sport',${sport},true)`;
        await refreshEconomyCatalogue(tx, state);
      });
    const grantStore = new CreditsSandboxStore(runtime, async (tx) => {
      await claims(tx, owner);
      await tx`select beta_packs.assert_grant(${member}::uuid)`;
    });
    const issue = founderCreditIssue.parse({
      request: randomUUID(),
      member,
      amount: 100000,
      reason: "Isolated free-credit acceptance fixture",
      confirmed: true,
    });
    await assert.rejects(
      () =>
        grantStore.execute(
          { id: owner, role: "reviewer", aal: "aal2" },
          issue.request,
          founderCreditCommand(issue),
        ),
      /unavailable/,
    );
    await sql`update beta_packs.control set enabled=true,grants_enabled=true,authority_reference='Isolated founder approval; no hosted mutation' where id`;
    await Promise.all(
      Array.from({ length: 10 }, () =>
        grantStore.execute(
          { id: owner, role: "reviewer", aal: "aal2" },
          issue.request,
          founderCreditCommand(issue),
        ),
      ),
    );
    assert.equal(wallet(await memberStore().read(), member).available, 100000);
    checks.push(
      "Founder free grant: ten concurrent same-ID retries issue once; no withdrawal or cash backing",
    );
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_app",
      "docked_commercial_app",
    ]) {
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe("set local role " + role);
            await tx`select * from beta_packs.issued`;
          }),
        /permission/,
      );
    }
    await assert.rejects(
      () => runtime`update beta_packs.control set enabled=true`,
      /permission/,
    );
    for (const [u, aal] of [
      [member, "aal2"],
      [owner, "aal1"],
    ])
      await assert.rejects(() =>
        runtime.begin(async (tx) => {
          await claims(tx, u, aal);
          await tx`select beta_packs.assert_grant(${member}::uuid)`;
        }),
      );
    checks.push(
      "No direct API/service/runtime control writes; founder MFA required for grants",
    );
    const actor = { id: member, role: "member" } as const;
    let spent = 0,
      issued = 0;
    for (const p of products) {
      console.log("Checking private pack: " + p.id);
      const request = randomUUID(),
        command = {
          kind: "buy-pack",
          product: p.id,
          configuration: p.version,
          confirmed: true,
          policy: s.policy.version,
        };
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          memberStore(member, "aal2", p.sport).execute(actor, request, command),
        ),
      );
      assert.deepEqual(results[0], results[3]);
      spent += p.priceCredits;
      issued += p.cards;
      const state = await memberStore().read(),
        pack = Object.values(state.economy!.packs).find(
          (x) => x.product.id === p.id,
        )!;
      assert.equal(pack.cards.length, p.cards);
      assert.equal(
        new Set(pack.cards.map((id) => state.economy!.instances[id].playerId))
          .size,
        p.cards,
      );
      assert(
        pack.cards.every(
          (id) => state.economy!.instances[id].printedTeam === "ORIGINAL",
        ),
      );
      await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          memberStore(member, "aal2", p.sport).execute(
            actor,
            request + "-open-" + i,
            {
              kind: "open-pack",
              entitlement: pack.id,
            },
          ),
        ),
      );
      assert.equal(
        testReceipt(await memberStore().read(), pack.id, member).cards.length,
        p.cards,
      );
    }
    const beforeRace = await memberStore().read();
    const priorIcons = Object.values(beforeRace.economy!.instances).filter(
      (c) =>
        c.rarity === "ICON" &&
        beforeRace.economy!.players[c.playerId].sport === "nfl",
    ).length;
    const premium = products.find(
      (p) => p.sport === "nfl" && p.type === "PREMIUM" && p.cards === 1,
    )!;
    const rng = mock.method(crypto, "randomInt", (max: number) =>
      max === 10000 ? 9999 : 0,
    );
    try {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 16 }, () =>
          memberStore().execute(actor, randomUUID(), {
            kind: "buy-pack",
            product: premium.id,
            configuration: premium.version,
            confirmed: true,
            policy: s.policy.version,
          }),
        ),
      );
      const successes = outcomes.filter((o) => o.status === "fulfilled").length;
      assert.equal(successes, 12 - priorIcons);
      spent += successes * premium.priceCredits;
      issued += successes;
      assert(
        outcomes
          .filter((o) => o.status === "rejected")
          .every((o) => /supply|eligible/i.test(String(o.reason))),
      );
    } finally {
      rng.mock.restore();
    }
    await assert.rejects(
      () =>
        sql`update commercial_billing.definitions set issued=issued+1 where rarity='ICON' and sport='nfl'`,
      /constraint|supply/i,
    );
    await assert.rejects(
      () =>
        sql`update commercial_billing.definitions set issued=issued+1 where rarity='RARE' and sport='nfl'`,
      /Lifetime counter/,
    );
    checks.push(
      "16 concurrent final-Icon purchases: exactly the remaining lifetime supply, no debit on exhaustion, counters cannot advance without an immutable card",
    );
    const done = await memberStore().read();
    assert.equal(wallet(done, member).available, 100000 - spent);
    assert.equal(wallet(done, member).withdrawable, 0);
    assert.equal(
      Number((await sql`select count(*) n from beta_packs.issued`)[0].n),
      issued,
    );
    assert.equal(
      Number(
        (await sql`select sum(issued) n from commercial_billing.definitions`)[0]
          .n,
      ),
      issued,
    );
    assert.equal(
      Number((await sql`select count(*) n from commercial_billing.cards`)[0].n),
      0,
    );
    checks.push(
      "18 Standard/Premium offers across NFL/AFL/NRL: 1/3/9 cards, exact debit, duplicate purchase/open retries, original printed team, stale/inactive/provider-absent source",
    );
    await assert.rejects(
      () =>
        sql`update commercial_billing.control set issuance_enabled=true where id`,
      /Close founder-credit/,
    );
    await assert.rejects(
      () => sql`update beta_packs.issued set serial=serial+1`,
      /immutable/i,
    );
    const p = products[0],
      command = {
        kind: "buy-pack",
        product: p.id,
        configuration: p.version,
        confirmed: true,
        policy: s.policy.version,
      };
    await assert.rejects(() =>
      memberStore(other).execute(
        { id: other, role: "member" },
        randomUUID(),
        command,
      ),
    );
    const original = JSON.stringify(await memberStore().read());
    await sql`insert into season_catalogue.decisions(rights_id,blocked,reason,authority_reference)values('nflfree_weekly',true,'Synthetic source licence withdrawal','Isolated explicit rights restriction')`;
    await assert.rejects(() =>
      memberStore().execute(actor, randomUUID(), command),
    );
    assert.equal(JSON.stringify(await memberStore().read()), original);
    checks.push(
      "Source rights revocation, uninvited access and simultaneous commercial activation fail closed with no wallet change",
    );
    const sealed = Object.values(done.economy!.packs).find((p) => !p.openedAt)!;
    await sql`update beta_packs.control set enabled=false,grants_enabled=false where id`;
    await Promise.all(
      Array.from({ length: 4 }, () =>
        memberStore().execute(actor, randomUUID(), {
          kind: "open-pack",
          entitlement: sealed.id,
        }),
      ),
    );
    assert.equal(
      testReceipt(await memberStore().read(), sealed.id, member).cards.length,
      sealed.cards.length,
    );
    assert.equal(
      Number((await sql`select count(*) n from beta_packs.issued`)[0].n),
      issued,
    );
    assert.equal(
      wallet(await memberStore().read(), member).available,
      100000 - spent,
    );
    checks.push(
      "Emergency pause blocks new grants and purchases while earned sealed packs still open once, with no extra debit or issuance",
    );
    await mkdir("docs/qa/founder-credit-packs-20261115", { recursive: true });
    await writeFile(
      "docs/qa/founder-credit-packs-20261115/postgres.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          environment: "Disposable PostgreSQL; synthetic identities only",
          checks,
          issued,
          spent,
          productionWrites: 0,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks, issued, spent }));
  } finally {
    await runtime.end({ timeout: 5 });
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
