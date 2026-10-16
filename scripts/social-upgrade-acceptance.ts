// Isolated local QA only. Called by the existing GoTrue/Next/Postgres harness.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type { Sql } from "postgres";
import { wallet, validateCredits } from "../src/core/credits-sandbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { executePrivateOffer } from "../src/core/private-card-offers";
export async function runSocialUpgrade(
  sql: Sql,
  suppliedContexts: APIRequestContext[],
) {
  let contexts = suppliedContexts.slice(0, 3);
  const candidates = await Promise.all(
    contexts.map(async (context) => {
      const response = await context.get("/api/marketplace?tab=listings");
      assert.equal(response.status(), 200);
      return {
        context,
        count: (await response.json()).state.inventory.filter(
          (c: any) => !c.listed && !c.transferReason,
        ).length,
      };
    }),
  );
  candidates.sort((a, b) => b.count - a.count);
  contexts = candidates.map((c) => c.context);
  const post = async (i: number, data: unknown) => {
    const r = await contexts[i].post("/api/community", { data });
    return { status: r.status(), body: await r.json() };
  };
  const get = async (i: number, path: string) => {
    const r = await contexts[i].get("/api/community?" + path);
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  };
  const own = await get(0, "view=hub");
  assert.equal(
    (
      await post(0, {
        action: "collection_preferences",
        visibility: "private",
        offers: "nobody",
        minimum: null,
        cards: {},
      })
    ).status,
    200,
  );
  const other = await get(1, "view=hub&handle=" + own.handle);
  assert.ok(own.cards.length, "Actual QA inventory projection");
  assert.equal(other.cards.length, 0, "Private default");
  assert.equal(other.settings, null);
  const market = await contexts[0].get("/api/marketplace?tab=listings");
  assert.equal(market.status(), 200);
  const inventory = (await market.json()).state.inventory;
  const card = own.cards.find((c: any) =>
    inventory.some(
      (m: any) => m.id === c.card.id && !m.listed && !m.transferReason,
    ),
  ).card;
  const prefs = {
    action: "collection_preferences",
    visibility: "members",
    acknowledgeVisibility: true,
    offers: "everyone",
    minimum: 50,
    cards: { [card.id]: { enabled: true, minimum: 100, asking: 150 } },
  };
  assert.equal((await post(0, prefs)).status, 200);
  const visible = await get(1, "view=hub&handle=" + own.handle);
  assert.ok(visible.cards.some((c: any) => c.card.id === card.id));
  assert.equal(visible.settings, null);
  assert.equal(
    JSON.stringify(visible).includes('"minimum"'),
    false,
    "Private minima absent from other member projection",
  );
  assert.notEqual(
    (await post(1, prefs)).status,
    200,
    "Cannot change another member card preferences",
  );
  const key = randomUUID(),
    payload = {
      action: "post",
      kind: "celebration",
      body: "Local owned-card snapshot " + key,
      sport: "nfl",
      mediaIds: [],
      cardIds: [card.id],
      idempotencyKey: key,
    };
  const shared = await post(0, payload);
  assert.equal(shared.status, 200, JSON.stringify(shared.body));
  const forged = await post(1, {
    ...payload,
    idempotencyKey: randomUUID(),
    body: "Local forged-card negative test",
  });
  assert.notEqual(forged.status, 200);
  const feed = await get(1, "view=feed&tab=latest");
  assert.equal(feed.status, "ready", feed.message);
  assert.ok(
    feed.posts.some((p: any) => p.id === shared.body.id),
    "Created post visible in latest feed",
  );
  assert.equal(
    feed.posts.find((p: any) => p.id === shared.body.id).cardSnapshots[0].id,
    card.id,
  );
  const community = randomUUID();
  const create = {
    action: "community_manage",
    id: community,
    name: "Local QA " + community,
    description: "Isolated integration community",
    rules: "Respect members. Test fixtures only.",
    sport: "nfl",
    status: "active",
  };
  assert.notEqual(
    (await post(0, create)).status,
    200,
    "Ordinary member cannot create community",
  );
  // Trusted fixture setup represents an owner-created community, not an HTTP staff-auth claim.
  await sql`insert into beta_private.social_communities(id,name,description,rules,sport,status,created_by) values(${community},${create.name},${create.description},${create.rules},'nfl','active',${own.viewer})`;
  assert.notEqual(
    (
      await post(0, {
        ...payload,
        communityId: community,
        cardIds: [],
        body: "Must join before posting",
        idempotencyKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal(
    (await post(0, { action: "community_join", community, enabled: true }))
      .status,
    200,
  );
  assert.equal(
    (
      await post(0, {
        ...payload,
        communityId: community,
        cardIds: [],
        body: "Joined local community " + key,
        idempotencyKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal(
    (await get(1, `view=feed&community=${community}`)).posts.length,
    1,
  );
  // Recover an unfinished local acceptance attempt using its original identity.
  // Do not reset the economy or bypass the real per-buyer rate limit on reruns.
  const pending = (await get(1, "view=offers")).offers.find(
    (o: any) =>
      o.card.id === card.id && o.status === "OPEN" && o.price === 1000,
  );
  const offer = pending?.id ?? randomUUID();
  const created = await post(1, {
    action: "card_offer",
    request: offer,
    command: { kind: "private-offer", card: card.id, price: 1000 },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const retry = await post(1, {
    action: "card_offer",
    request: offer,
    command: { kind: "private-offer", card: card.id, price: 1000 },
  });
  assert.equal(retry.status, 200);
  assert.equal(
    (await get(2, "view=offers")).offers.some((o: any) => o.id === offer),
    false,
    "Private inbox isolation",
  );
  const [before] =
    await sql`select document from credits_sandbox.state where id`;
  const sellerId = before.document.commerce.cards[card.id].owner;
  const [{ n: journalBefore }] =
    await sql`select count(*)::int n from credits_sandbox.journal`;
  const [{ n: historyBefore }] =
    await sql`select count(*)::int n from credits_sandbox.history`;
  const rollback = new CreditsSandboxStore(
    sql,
    undefined,
    undefined,
    async () => {
      // A separate connection cannot observe either intermediate OPEN or SOLD.
      const [outside] =
        await sql`select document from credits_sandbox.state where id`;
      assert.deepEqual(outside.document, before.document);
      throw Error("Injected local settlement failure");
    },
    (s, a, r, c, n) =>
      executePrivateOffer(s, a, r, c, n, { allowed: true, minimum: null }),
  );
  await assert.rejects(
    rollback.execute({ id: sellerId, role: "member" }, randomUUID(), {
      kind: "private-accept",
      offer,
    }),
    /Injected local settlement failure/,
  );
  assert.deepEqual(
    (await sql`select document from credits_sandbox.state where id`)[0]
      .document,
    before.document,
  );
  assert.equal(
    (await sql`select count(*)::int n from credits_sandbox.journal`)[0].n,
    journalBefore,
  );
  assert.equal(
    (await sql`select count(*)::int n from credits_sandbox.history`)[0].n,
    historyBefore,
  );
  const members =
    await sql`select user_id::text from beta_private.social_profiles where id in (${own.viewer},${(await get(1, "view=hub")).viewer}) order by user_id`;
  const request = randomUUID(),
    accept = {
      action: "card_offer",
      request,
      command: { kind: "private-accept", offer },
    };
  const [a, b] = await Promise.all([post(0, accept), post(0, accept)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const [after] =
    await sql`select document from credits_sandbox.state where id`;
  validateCredits(after.document);
  const seller = before.document.commerce.cards[card.id].owner,
    buyer = after.document.commerce.cards[card.id].owner;
  assert.notEqual(seller, buyer);
  assert.equal(
    wallet(after.document, buyer).spendable,
    wallet(before.document, buyer).spendable - 1000,
  );
  assert.equal(
    wallet(after.document, seller).spendable,
    wallet(before.document, seller).spendable + 925,
  );
  assert.equal(
    after.document.journal.length,
    before.document.journal.length + 1,
  );
  assert.equal(members.length, 2);
  const replay = await post(0, payload);
  assert.equal(
    replay.status,
    200,
    "Post retry after transfer retains snapshot",
  );
  assert.equal(replay.body.id, shared.body.id);
  const snapshot = (await get(1, "view=feed&tab=latest")).posts.find(
    (p: any) => p.id === shared.body.id,
  ).cardSnapshots[0];
  assert.equal(snapshot.serial, card.serial);
  const [fresh] =
    await sql`select document from credits_sandbox.state where id`;
  const available = Object.keys(fresh.document.cards).filter(
    (id) =>
      fresh.document.commerce.cards[id].owner === seller &&
      !Object.values(fresh.document.listings).some(
        (l: any) => l.card === id && l.status === "OPEN",
      ),
  );
  assert.ok(
    available.length >= 1,
    "One additional unlisted QA card for distinct-buyer race",
  );
  const raceCard = available[0];
  assert.equal(
    (
      await post(0, {
        ...prefs,
        cards: { [raceCard]: { enabled: true, minimum: null, asking: null } },
      })
    ).status,
    200,
  );
  const one = randomUUID(),
    two = randomUUID();
  for (const [i, id] of [
    [1, one],
    [2, two],
  ] as const)
    assert.equal(
      (
        await post(i, {
          action: "card_offer",
          request: id,
          command: { kind: "private-offer", card: raceCard, price: 100 },
        })
      ).status,
      200,
    );
  const race = await Promise.all(
    [one, two].map((id) =>
      post(0, {
        action: "card_offer",
        request: randomUUID(),
        command: { kind: "private-accept", offer: id },
      }),
    ),
  );
  assert.equal(
    race.filter((r) => r.status === 200).length,
    1,
    "Distinct buyers, actual separate HTTP/database requests, one settlement",
  );
  // Privacy revocation is authoritative immediately.
  assert.equal(
    (await post(0, { ...prefs, visibility: "private", cards: {} })).status,
    200,
  );
  assert.equal((await get(1, "view=hub&handle=" + own.handle)).cards.length, 0);
  return [
    "Authenticated private-default collection, owner-only settings and cross-account denial",
    "Owned card attachment and immutable idempotent replay after actual transfer",
    "Community membership enforced; ordinary member creation denied (owner fixture inserted directly)",
    "Authenticated private offer acceptance: exact 1,000 debit / 925 proceeds / 75 commission, one journal on concurrent duplicate",
    "Direct PostgreSQL store fault injection: intermediate listing invisible to separate connection; state, ledger and history fully roll back",
    "Two distinct buyers through separate HTTP/database requests: exactly one settles",
    "Private receipt/inbox and collection privacy revocation",
  ];
}
