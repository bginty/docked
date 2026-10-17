import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nflCardEligibility,
  nflCardPositions,
  mergeRosterEvidence,
  type NflRosterEvidence,
} from "../../src/core/nfl-card-eligibility";
import {
  allocateNine,
  eligibleCatalogue,
  initialCardEconomy,
  type EconomyPlayer,
  validateCardEconomy,
} from "../../src/core/card-economy";
import {
  initialMemberTestCredits,
  testReceipt,
} from "../../src/core/member-test-wallet";
import { cleanTestEconomy } from "../../src/core/nfl-test-cleanup";
import { executeCredits } from "../../src/core/credits-sandbox";
const now = Date.now();
const evidence = (id = "p"): NflRosterEvidence => ({
  policy: "official-nfl-roster-v1",
  playerId: id,
  providerId: id,
  team: "MIN",
  position: "QB",
  status: "active",
  identityVerified: true,
  sourceUrl: "https://www.vikings.com/team/players-roster/",
  sourceHash: "a".repeat(64),
  checkedAt: now,
});
const player = (id = "p"): EconomyPlayer => ({
  id,
  providerId: id,
  provider: "fixture",
  sport: "nfl",
  assetKind: "player",
  name: id,
  position: "QB",
  currentTeam: "MIN",
  status: "active",
  observedAt: now,
  sourceRevision: "test",
  presentation: "test",
  roster: evidence(id),
});
test("only actual seven-slot positions; reserve/PS/unknown/stale never masquerade as active", () => {
  assert.deepEqual([...nflCardPositions].sort(), ["QB", "RB", "TE", "WR"]);
  assert.equal(nflCardEligibility(player(), now).eligible, true);
  for (const status of [
    "reserve",
    "practice-squad",
    "released",
    "retired",
    "unknown",
  ] as const)
    assert.equal(
      nflCardEligibility(
        { ...player(), roster: { ...evidence(), status } },
        now,
      ).eligible,
      false,
    );
  for (const position of ["P", "K", "DEF", "FLEX"])
    assert.equal(
      nflCardEligibility({ ...player(), position }, now, false).eligible,
      false,
    );
  assert.equal(
    nflCardEligibility({ ...player(), roster: undefined }, now).eligible,
    false,
  );
  assert.equal(
    nflCardEligibility(player(), now + 73 * 3600000).eligible,
    false,
  );
  assert.equal(
    nflCardEligibility(
      { ...player(), roster: { ...evidence(), identityVerified: false } },
      now,
    ).eligible,
    false,
  );
});
test("trade and elevation update same identity; upstream failure retains last evidence", () => {
  const old = { p: evidence() };
  assert.deepEqual(
    mergeRosterEvidence(old, [{ ...evidence(), team: "NYJ" }], new Set()),
    old,
  );
  const traded = mergeRosterEvidence(
    old,
    [{ ...evidence(), team: "NYJ", checkedAt: now + 1 }],
    new Set(["NYJ"]),
  );
  assert.equal(traded.p.team, "NYJ");
  assert.equal(Object.keys(traded).length, 1);
  assert.equal(
    nflCardEligibility(
      { ...player(), roster: { ...evidence(), status: "active" } },
      now,
    ).eligible,
    true,
  );
  assert.throws(
    () => mergeRosterEvidence(old, [evidence(), evidence()], new Set(["MIN"])),
    /Conflicting/,
  );
});
test("preview and secure allocator share official eligibility even if product requests retired or kicker", () => {
  const e = initialCardEconomy(
    Array.from({ length: 12 }, (_, i) => player(`p${i}`)),
    now,
  );
  e.rosterPolicy = "official-nfl-roster-v1";
  e.players.p0.position = "K";
  e.players.p1.roster!.status = "practice-squad";
  e.players.p2.roster!.identityVerified = false;
  const p = e.products["standard-nine-test-v1"];
  p.eligibleStatuses = ["active", "inactive", "retired"];
  assert.equal(eligibleCatalogue(e, p, now).length, 9);
  const pack = allocateNine(e, p.id, "member", "pack", now, () => 0);
  assert.ok(
    pack.cards.every(
      (id) => !["p0", "p1", "p2"].includes(e.instances[id].playerId),
    ),
  );
});
test("test cleanup removes offers/ownership; allocation tombstones preserve scarcity and retry safety", () => {
  let s = initialMemberTestCredits();
  s.economy = initialCardEconomy(
    Array.from({ length: 12 }, (_, i) => player(`p${i}`)),
    now,
  );
  s = executeCredits(
    s,
    { id: "owner", role: "reviewer", aal: "aal2" },
    "grant",
    {
      kind: "promotion",
      member: "member",
      amount: 900,
      campaign: "test",
      reason: "Isolated cleanup regression",
      confirmed: true,
      redeemable: false,
    },
    now,
  ).state;
  s = executeCredits(
    s,
    { id: "member", role: "member" },
    "pack",
    {
      kind: "buy-pack",
      product: "standard-nine-test-v1",
      configuration: "standard-nine-test-v1",
      policy: s.policy.version,
      confirmed: true,
    },
    now,
  ).state;
  const id = Object.keys(s.economy!.instances)[0],
    pid = s.economy!.instances[id].playerId;
  s.listings.list = {
    member: "member",
    card: id,
    version: 1,
    price: 20,
    status: "OPEN",
  };
  s.swaps.swap = {
    member: "member",
    other: "peer",
    give: [id],
    take: [],
    versions: [1],
    expires: now + 100,
    status: "OPEN",
    feeEach: 0,
  };
  const approval = [
    {
      playerId: pid,
      name: pid,
      reason: "unsupported" as const,
      evidence: ["https://www.nfl.com/"],
      cards: [id],
    },
  ];
  const r = cleanTestEconomy(s, approval);
  assert.equal(r.state.cards[id], undefined);
  assert.equal(r.state.listings.list, undefined);
  assert.equal(r.state.swaps.swap, undefined);
  assert.deepEqual(r.state.journal, s.journal);
  assert.deepEqual(r.state.economy!.definitions, s.economy!.definitions);
  validateCardEconomy(r.state.economy!);
  assert.deepEqual(cleanTestEconomy(r.state, approval).state, r.state);
  assert.throws(
    () => cleanTestEconomy(s, [{ ...approval[0], playerId: "wrong" }]),
    /identity/,
  );
  assert.ok(s.cards[id]);
  assert.throws(
    () => cleanTestEconomy(r.state, [{ ...approval[0], playerId: "wrong" }]),
    /identity/,
  );
  const packId = s.economy!.instances[id].source;
  // A purchased entitlement is preserved when a player becomes ineligible
  // before opening. No reroll, charge or partial opening.
  const held = structuredClone(s);
  held.economy!.rosterPolicy = "official-nfl-roster-v1";
  held.economy!.players[pid].roster!.status = "practice-squad";
  const preimage = structuredClone(held);
  assert.throws(
    () =>
      executeCredits(
        held,
        { id: "member", role: "member" },
        "blocked-open",
        {
          kind: "open-pack",
          entitlement: packId,
        },
        now,
      ),
    /entitlement is preserved/,
  );
  assert.deepEqual(held, preimage);
  const opened = executeCredits(
    r.state,
    { id: "member", role: "member" },
    "open-retained",
    {
      kind: "open-pack",
      entitlement: packId,
    },
    now,
  ).state;
  const receipt = testReceipt(opened, packId, "member");
  assert.equal(receipt.cards.length, 8);
  assert.ok(receipt.cards.every((c) => c.id !== id));
  assert.match(receipt.notice!, /no replacements or credits/);
  assert.equal(opened.economy!.packs[packId].cards.length, 9);
  assert.deepEqual(opened.journal, s.journal);
});
