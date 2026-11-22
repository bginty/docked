import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import {
  officialRosterSource,
  rosterBatchCommand,
  rosterActivationCommand,
  type OwnerRosterRow,
} from "../../src/core/commercial-player-roster";
import { CommercialPlayerRosterStore } from "../../src/server/commercial-player-roster";

const owner = randomUUID();
const at = "2026-11-22T00:00:00Z";
function command() {
  return {
    request: randomUUID(),
    reference: "  Official roster review fixture  ",
    confirmed: true,
    changes: [
      {
        playerId: randomUUID(),
        sport: "afl",
        expectedRevision: null,
        registration: "DELISTED",
        availability: "UNKNOWN",
        currentClub: null,
        source: {
          url: "https://www.afl.com.au/news/fixture",
          hash: "a".repeat(64),
          observedAt: at,
          effectiveAt: at,
        },
      },
    ],
  };
}
function candidateFor(change: ReturnType<typeof command>["changes"][number]) {
  return {
    id: change.playerId,
    sport: change.sport,
    provider: "afl-official",
    providerId: "fixture-player-123",
    snapshot: {
      name: "A fictional reviewed draftee",
      team: "Fixture club",
      position: "MID",
      season: "2027",
      verifiedJerseyNumber: null,
      colour: "#123456",
      status: "active",
      synthetic: false,
    },
    eligiblePositions: ["MID"],
    source: {
      url: change.source.url,
      hash: change.source.hash,
      checkedAt: change.source.observedAt,
      license: "Fixture factual verification",
      verification: "Fixture identity and position independently reviewed",
      permanentIssuanceEligible: false,
    },
  };
}

test("roster decisions keep injury separate from registration and canonicalise exact batches", () => {
  const input = command();
  const injury = {
    ...input.changes[0],
    playerId: randomUUID(),
    registration: "ACTIVE",
    availability: "INJURED",
    currentClub: { id: "ADE", name: "Adelaide" },
  };
  const first = rosterBatchCommand.parse({
    ...input,
    changes: [...input.changes, injury],
  });
  assert.equal(first.reference, "Official roster review fixture");
  assert.equal(
    first.changes.find((row) => row.playerId === injury.playerId)?.registration,
    "ACTIVE",
  );
  assert.deepEqual(
    rosterBatchCommand.parse({ ...input, changes: [injury, ...input.changes] }),
    first,
  );
  for (const bad of [
    { ...input, actor: owner },
    { ...input, confirmed: false },
    { ...input, changes: [] },
    { ...input, changes: [input.changes[0], input.changes[0]] },
    { ...input, changes: [{ ...input.changes[0], registration: "ACTIVE" }] },
    { ...input, changes: [{ ...input.changes[0], approved: true }] },
  ])
    assert.equal(rosterBatchCommand.safeParse(bad).success, false);
});

test("source approval binds official sport domains and rejects confusing hosts or credentials", () => {
  assert.equal(
    officialRosterSource("afl", "https://www.afl.com.au/news/123"),
    true,
  );
  assert.equal(
    officialRosterSource(
      "nfl",
      "https://www.seahawks.com/team/players-roster/",
    ),
    true,
  );
  assert.equal(
    officialRosterSource(
      "nrl",
      "https://www.warriors.kiwi/teams/nrl-premiership/",
    ),
    true,
  );
  for (const url of [
    "https://afl.com.au.evil.test/news/123",
    "https://evilafl.com.au/news/123",
    "https://afl.com.au@evil.test/news/123",
    "https://person:secret@afl.com.au/news/123",
    "http://afl.com.au/news/123",
    "https://afl.com.au:8443/news/123",
    "https://www.nfl.com/news/123",
    "javascript:alert(1)",
  ]) {
    assert.equal(officialRosterSource("afl", url), false);
    const input = command();
    input.changes[0].source.url = url;
    assert.equal(rosterBatchCommand.safeParse(input).success, false);
  }
});

test("new-player definitions require the exact identity, evidence and sport position without granting rights", () => {
  const input = command();
  const candidate = candidateFor(input.changes[0]);
  const complete = {
    ...input,
    changes: [
      {
        ...input.changes[0],
        registration: "ACTIVE",
        currentClub: { id: "fixture-club", name: "Fixture club" },
        candidate,
        registerDefinitions: true,
      },
    ],
  };
  assert.equal(rosterBatchCommand.safeParse(complete).success, true);
  const changes = [
    { ...candidate, id: randomUUID() },
    { ...candidate, sport: "nfl" },
    { ...candidate, providerId: "" },
    { ...candidate, eligiblePositions: ["DEF"] },
    { ...candidate, eligiblePositions: ["MID", "QB"] },
    { ...candidate, eligiblePositions: ["MID", "MID"] },
    {
      ...candidate,
      snapshot: { ...candidate.snapshot, position: "QB" },
      eligiblePositions: ["QB"],
    },
    { ...candidate, source: { ...candidate.source, hash: "b".repeat(64) } },
    {
      ...candidate,
      source: { ...candidate.source, permanentIssuanceEligible: true },
    },
  ];
  for (const bad of changes)
    assert.equal(
      rosterBatchCommand.safeParse({
        ...complete,
        changes: [{ ...complete.changes[0], candidate: bad }],
      }).success,
      false,
    );
  assert.equal(
    rosterBatchCommand.safeParse({
      ...input,
      changes: [{ ...input.changes[0], registerDefinitions: true }],
    }).success,
    false,
  );
  for (const change of [
    { ...complete.changes[0], registration: "PENDING_RELIST" },
    {
      ...complete.changes[0],
      currentClub: { id: "another", name: "Another club" },
    },
    {
      ...complete.changes[0],
      candidate: {
        ...candidate,
        snapshot: { ...candidate.snapshot, status: "inactive" },
      },
    },
  ])
    assert.equal(
      rosterBatchCommand.safeParse({ ...complete, changes: [change] }).success,
      false,
    );
  assert.equal(
    rosterActivationCommand.safeParse({
      request: randomUUID(),
      reference: "Separately reviewed rights fixture",
      confirmed: true,
      sport: "afl",
      playerId: candidate.id,
      expectedRevision: randomUUID(),
      rightsReference: "existing-approved-rights-fixture",
    }).success,
    true,
  );
});

function row(
  name: string,
  overrides: Partial<OwnerRosterRow> = {},
): OwnerRosterRow {
  return {
    playerId: randomUUID(),
    sport: "afl",
    name,
    currentClubId: null,
    currentClubName: null,
    savedClubs: [],
    registration: "LEGACY",
    availability: "UNKNOWN",
    verification: "LEGACY",
    eligibility: true,
    eligibilityReason: "Existing approved pool; current roster unreviewed",
    observedAt: null,
    effectiveAt: null,
    reviewedAt: null,
    evidenceUrl: null,
    evidenceHash: null,
    revision: null,
    existingCards: 0,
    definitionCount: 5,
    approvedDefinitions: 5,
    lifetimeIssued: 0,
    aliases: [],
    supply: [],
    ...overrides,
  };
}
function fixtureStore(rows: OwnerRosterRow[]) {
  let authorised = 0;
  const sql = (async (strings: TemplateStringsArray) => {
    if (strings.join("").includes("owner_roster_rows")) {
      assert.ok(authorised > 0);
      return rows.map((value) => ({ value }));
    }
    return [{ at: new Date(at) }];
  }) as unknown as Sql;
  sql.begin = (async (_options: string, callback: (tx: Sql) => unknown) =>
    callback(sql)) as unknown as Sql["begin"];
  return {
    store: new CommercialPlayerRosterStore(sql),
    authorise: async () => {
      authorised += 1;
    },
  };
}

test("legacy club audit uses all saved clubs, labels them unverified and never matches reviewed rows by historic club", async () => {
  const multi = row("Zebra", { savedClubs: ["Zulu", "Adelaide / prior"] });
  const beta = row("Alpha", { savedClubs: ["Brisbane"] });
  const current = row("Reviewed", {
    registration: "ACTIVE",
    verification: "VERIFIED",
    currentClubId: "GCS",
    currentClubName: "Gold Coast",
    savedClubs: ["Adelaide / prior"],
  });
  const { store, authorise } = fixtureStore([current, beta, multi]);
  const report = await store.read(owner, authorise, {});
  assert.deepEqual(
    report.rows.map((value) => value.name),
    ["Zebra", "Alpha", "Reviewed"],
  );
  assert.equal(report.rows[0].currentClubName, null);
  const option = report.clubs.find(
    (club) => club.id === "saved:Adelaide%20%2F%20prior",
  );
  assert.equal(option?.name, "Adelaide / prior (saved card club; unverified)");
  assert.deepEqual(
    (
      await store.read(owner, authorise, {
        club: "afl:saved:Adelaide%20%2F%20prior",
      })
    ).rows.map((value) => value.playerId),
    [multi.playerId],
  );
  assert.deepEqual(
    (await store.read(owner, authorise, { club: "afl:saved:Zulu" })).rows.map(
      (value) => value.playerId,
    ),
    [multi.playerId],
  );
  assert.deepEqual(
    (await store.read(owner, authorise, { club: "afl:GCS" })).rows.map(
      (value) => value.playerId,
    ),
    [current.playerId],
  );
});

test("full audit export retains all filtered rows while the read view is capped at one hundred", async () => {
  const rows = Array.from({ length: 101 }, (_, i) =>
    row(`Player ${i}`, { savedClubs: ["Adelaide"] }),
  );
  const { store, authorise } = fixtureStore(rows);
  const first = await store.read(owner, authorise, {
    club: "afl:saved:Adelaide",
  });
  assert.equal(first.total, 101);
  assert.equal(first.rows.length, 100);
  assert.equal(first.hasMore, true);
  const last = await store.read(owner, authorise, {
    club: "afl:saved:Adelaide",
    page: 2,
  });
  assert.equal(last.rows.length, 1);
  assert.equal(last.hasMore, false);
  const all = await store.read(
    owner,
    authorise,
    { club: "afl:saved:Adelaide", page: 2 },
    { all: true },
  );
  assert.equal(all.rows.length, 101);
  assert.equal(all.summary.legacy, 101);
});
