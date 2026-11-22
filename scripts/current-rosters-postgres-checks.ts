/** Native PostgreSQL checks composed into the paid/free pack regression fixture. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialPlayerRosterStore } from "../src/server/commercial-player-roster";
import { limitedRarities, rarityRule } from "../src/core/card-rarity";
import { dormantCommercialPool } from "../src/core/commercial-pool-plan";
import {
  rosterBatchCommand,
  type RosterBatchCommand,
} from "../src/core/commercial-player-roster";
import { digest } from "../src/core/scoring-engine";
import type {
  OwnerPackAwardCommand,
  OwnerPackAwardReceipt,
} from "../src/core/owner-pack-awards";
import {
  commercialPack,
  commercialPolicyVersion,
  type CommercialSport,
} from "../src/core/commercial-billing";
import { ownerPackAwardCommand } from "../src/core/owner-pack-awards";

type Authorize = (tx: Sql) => Promise<void>;
type Fixture = {
  admin: Sql;
  runtime: Sql;
  ledger: CommercialLedger;
  owner: string;
  ownerSession: string;
  recipient: string;
  other: string;
  versions: { terms: string; privacy: string };
  authorise: (actor?: string, session?: string, aal?: string) => Authorize;
  identity: (id: string, role?: string, session?: string) => Promise<void>;
  funded: (id: string) => Promise<unknown>;
  fingerprint: (financialOnly?: boolean) => Promise<Record<string, string>>;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
  zeroDraw: <T>(run: () => Promise<T>) => Promise<T>;
  award: (command: OwnerPackAwardCommand) => Promise<OwnerPackAwardReceipt>;
  command: (
    overrides?: Partial<OwnerPackAwardCommand>,
  ) => OwnerPackAwardCommand;
  line: (
    sport: CommercialSport,
    family: "STANDARD" | "PREMIUM",
    size: 1 | 3 | 9,
    quantity?: number,
  ) => OwnerPackAwardCommand["lines"][number];
  noAuthorisation: Authorize;
};

export async function currentRosterPostgresChecks(f: Fixture) {
  const { admin, runtime, ledger, owner, recipient, other, check } = f;
  const store = new CommercialPlayerRosterStore(runtime);
  const player = randomUUID();
  const held = randomUUID();
  const observed = new Date(Date.now() - 60_000).toISOString();
  const source = {
    url: "https://www.afl.com.au/news/isolated-roster-fixture",
    hash: "a".repeat(64),
    observedAt: observed,
    effectiveAt: observed,
  };
  type Change = RosterBatchCommand["changes"][number];
  const change = (overrides: Partial<Change> = {}): Change => ({
    playerId: player,
    sport: "afl",
    expectedRevision: null,
    registration: "RETIRED",
    availability: "UNKNOWN",
    currentClub: null,
    source,
    relistConfirmed: false,
    registerDefinitions: false,
    aliases: [],
    ...overrides,
  });
  const batch = (changes: Change[]): RosterBatchCommand => ({
    request: randomUUID(),
    reference: "Fictional local roster acceptance",
    confirmed: true,
    changes,
  });
  const apply = (changes: Change[]) =>
    store.apply(owner, batch(changes), f.authorise());
  const revision = async (id = player) => {
    const [row] =
      await admin`select id from commercial_billing.current_player_roster where sport='afl' and player_id=${id}`;
    return row?.id ?? null;
  };
  const definitions = async (
    id: string,
    name: string,
    approved: boolean,
    prior: number,
  ) => {
    for (const rarity of limitedRarities) {
      const n =
        rarity === "RARE" ? prior : rarity === "ICON" && !approved ? 1 : 0;
      await admin`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot) values(${id},'afl',${rarity},${rarityRule(rarity).lifetimeCap!},${n},${n},${approved},'FICTIONAL LOCAL RIGHTS ONLY',${admin.json({ name, team: "Old Fixture Club", position: "MID", season: "ISOLATED", status: "active", synthetic: true, colour: "#16345A", verifiedJerseyNumber: null, provider: "isolated-roster-fixture", providerId: id })})`;
    }
  };
  await definitions(player, "Fictional Returning Player", true, 7);
  await definitions(held, "Fictional Held Player", false, 0);
  const freeCommand = () =>
    f.command({ lines: [f.line("afl", "STANDARD", 1)] });
  const paidInput = {
    ...f.line("afl", "STANDARD", 1),
    confirmed: true as const,
  };
  let sealed: OwnerPackAwardReceipt;
  let permanentCard: Record<string, unknown>;
  let definitionBaseline: unknown;

  await check(
    "roster legacy report preserves all rows and current decision distinguishes saved club from current club",
    async () => {
      const initial = await store.read(
        owner,
        f.authorise(),
        { sport: "afl" },
        { all: true },
      );
      assert.equal(initial.total, 2);
      const row = initial.rows.find((p) => p.playerId === player)!;
      assert.equal(row.registration, "LEGACY");
      assert.equal(row.eligibility, true);
      assert.equal(row.currentClubName, null);
      assert.deepEqual(row.savedClubs, ["Old Fixture Club"]);
      assert.equal(row.lifetimeIssued, 7);
      const filtered = await store.read(
        owner,
        f.authorise(),
        { sport: "afl", club: "afl:saved:Old%20Fixture%20Club" },
        { all: true },
      );
      assert.equal(filtered.total, 2);
      sealed = await f.zeroDraw(() => f.award(freeCommand()));
      const [card] =
        await admin`select * from commercial_billing.cards where pack=${sealed.packs[0].id}`;
      permanentCard = { ...card };
      assert.equal(card.serial, 8);
      definitionBaseline =
        await admin`select * from commercial_billing.definitions where player_id=${player} order by id`;
    },
  );

  await check(
    "retirement blocks new paid/free/direct issuance while sealed cards reveal unchanged and remain tradable",
    async () => {
      const before = await f.fingerprint();
      await apply([change()]);
      assert.deepEqual(await f.fingerprint(), before);
      const row = (
        await store.read(owner, f.authorise(), {
          sport: "afl",
          status: "RETIRED",
        })
      ).rows[0];
      assert.equal(row.playerId, player);
      assert.equal(row.eligibility, false);
      assert.equal(row.existingCards, 1);
      assert.deepEqual(row.savedClubs, ["Old Fixture Club"]);
      await assert.rejects(f.award(freeCommand()), /supply|available/i);
      await assert.rejects(
        ledger.buyPack(other, randomUUID(), paidInput, f.noAuthorisation),
        /supply|available/i,
      );
      await assert.rejects(
        runtime`insert into commercial_billing.cards(definition,serial,owner_id,pack,slot) values(${permanentCard.definition as string},9,${recipient},${sealed.packs[0].id},1)`,
        /excluded from new pack issuance/,
      );
      assert.deepEqual(await f.fingerprint(), before);
      const revealed = await ledger.openPack(
        recipient,
        sealed.packs[0].id,
        f.noAuthorisation,
      );
      assert.deepEqual(
        await ledger.openPack(recipient, sealed.packs[0].id, f.noAuthorisation),
        revealed,
      );
      assert.equal(revealed.cards[0].id, permanentCard.id);
      assert.equal(revealed.cards[0].serial, 8);
      const buyer = randomUUID();
      await f.identity(buyer);
      await f.funded(buyer);
      await admin`update commercial_billing.control set transfers_enabled=true`;
      const listing = await ledger.list(
        recipient,
        permanentCard.id as string,
        100,
        f.noAuthorisation,
      );
      const sale = await ledger.buyListing(
        buyer,
        listing.id,
        100,
        1,
        f.noAuthorisation,
      );
      assert.equal(sale.price, 100);
      const [after] =
        await admin`select * from commercial_billing.cards where id=${permanentCard.id as string}`;
      assert.equal(after.owner_id, buyer);
      assert.deepEqual(
        { ...after, owner_id: permanentCard.owner_id },
        permanentCard,
      );
      assert.deepEqual(
        await admin`select * from commercial_billing.definitions where player_id=${player} order by id`,
        definitionBaseline,
      );
      await admin`update commercial_billing.control set transfers_enabled=false`;
    },
  );

  await check(
    "all non-active states stay excluded and verified return preserves identity, legacy supply and existing holds",
    async () => {
      for (const registration of [
        "DELISTED",
        "UNSIGNED",
        "UNKNOWN",
        "PENDING_RELIST",
      ] as const) {
        await apply([
          change({ expectedRevision: await revision(), registration }),
        ]);
        const [allowed] =
          await runtime`select commercial_billing.roster_can_issue('afl',${player}::uuid) value`;
        assert.equal(allowed.value, false);
      }
      const returning = change({
        expectedRevision: await revision(),
        registration: "ACTIVE",
        availability: "INJURED",
        currentClub: { id: "fixture-new-club", name: "New Fixture Club" },
      });
      await assert.rejects(apply([returning]), /relist|return/i);
      await apply([{ ...returning, relistConfirmed: true }]);
      assert.deepEqual(
        await admin`select * from commercial_billing.definitions where player_id=${player} order by id`,
        definitionBaseline,
      );
      const gained = await f.zeroDraw(() => f.award(freeCommand()));
      const [card] =
        await admin`select c.definition,c.serial,d.player_id from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where c.pack=${gained.packs[0].id}`;
      assert.equal(card.player_id, player);
      assert.equal(card.definition, permanentCard.definition);
      assert.equal(card.serial, 9);
      await apply([
        change({
          playerId: held,
          registration: "ACTIVE",
          currentClub: { id: "fixture-new-club", name: "New Fixture Club" },
          relistConfirmed: true,
        }),
      ]);
      const holdRow = (
        await store.read(owner, f.authorise(), { sport: "afl", q: held })
      ).rows[0];
      assert.equal(holdRow.registration, "ACTIVE");
      assert.equal(holdRow.approvedDefinitions, 0);
      assert.equal(holdRow.eligibility, false);
      await assert.rejects(
        store.activate(
          owner,
          {
            request: randomUUID(),
            confirmed: true,
            reference: "Forbidden legacy reapproval",
            sport: "afl",
            playerId: held,
            expectedRevision: await revision(held),
            rightsReference: "ISOLATED LOOPBACK FIXTURE ONLY",
          },
          f.authorise(),
        ),
        /newly registered dormant/,
      );
      const current = await store.read(
        owner,
        f.authorise(),
        { sport: "afl", club: "afl:fixture-new-club" },
        { all: true },
      );
      assert.equal(current.total, 2);
      assert.equal(
        (
          await store.read(owner, f.authorise(), {
            sport: "afl",
            club: "afl:saved:Old%20Fixture%20Club",
          })
        ).total,
        0,
      );
    },
  );

  await check(
    "roster batches replay once, reject stale/future evidence, and roll back every earlier decision on later failure",
    async () => {
      const same = batch([
        change({
          expectedRevision: await revision(),
          registration: "ACTIVE",
          availability: "SUSPENDED",
          currentClub: { id: "fixture-new-club", name: "New Fixture Club" },
        }),
      ]);
      const [left, right] = await Promise.all([
        store.apply(owner, same, f.authorise()),
        store.apply(owner, same, f.authorise()),
      ]);
      assert.deepEqual(left, right);
      const before = await rosterFingerprint();
      await assert.rejects(
        store.apply(
          owner,
          { ...same, reference: "Conflicting retry" },
          f.authorise(),
        ),
        /conflict/,
      );
      await assert.rejects(
        apply([change({ expectedRevision: null })]),
        /revision/,
      );
      const future = new Date(Date.now() + 86_400_000).toISOString();
      await assert.rejects(
        apply([
          change({
            expectedRevision: await revision(),
            source: { ...source, effectiveAt: future },
          }),
        ]),
        /Future/,
      );
      const older = new Date(Date.now() - 86_400_000).toISOString();
      await assert.rejects(
        apply([
          change({
            expectedRevision: await revision(),
            source: { ...source, observedAt: older, effectiveAt: older },
          }),
        ]),
        /Older/,
      );
      const ordered = [player, held].sort();
      await assert.rejects(
        apply(
          ordered.map((id, index) =>
            change({
              playerId: id,
              expectedRevision:
                index === 0
                  ? id === player
                    ? same.changes[0].expectedRevision
                    : null
                  : randomUUID(),
            }),
          ),
        ),
        /revision/,
      );
      // A valid first item must not survive an invalid later item.
      const validFirst = change({
        playerId: ordered[0],
        expectedRevision: await revision(ordered[0]),
      });
      await assert.rejects(
        apply([
          validFirst,
          change({ playerId: ordered[1], expectedRevision: randomUUID() }),
        ]),
        /revision/,
      );
      assert.deepEqual(await rosterFingerprint(), before);
      assert.equal(
        (
          await runtime`select commercial_billing.roster_can_issue('afl',${player}::uuid) value`
        )[0].value,
        true,
      );
    },
  );

  await check(
    "native concurrent import serializes before both paid and free allocation without a post-removal card",
    async () => {
      const input = rosterBatchCommand.parse(
        batch([change({ expectedRevision: await revision() })]),
      );
      let release!: () => void;
      let entered!: () => void;
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const importer = runtime.begin(async (raw) => {
        const tx = raw as unknown as Sql;
        await f.authorise()(tx);
        await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(input)},${digest(input)},'[]'::jsonb)`;
        entered();
        await gate;
      });
      await ready;
      const before = await f.fingerprint();
      const paid = ledger.buyPack(
        other,
        randomUUID(),
        paidInput,
        f.noAuthorisation,
      );
      const free = f.award(freeCommand());
      const attempts = Promise.allSettled([paid, free]);
      try {
        await waitForAdvisory(2);
      } finally {
        release();
      }
      await importer;
      const outcomes = await attempts;
      assert(outcomes.every((outcome) => outcome.status === "rejected"));
      assert.deepEqual(await f.fingerprint(), before);
    },
  );

  await check(
    "an already-locked paid allocation commits before removal and every subsequent draw observes exclusion",
    async () => {
      await apply([
        change({
          expectedRevision: await revision(),
          registration: "ACTIVE",
          currentClub: { id: "fixture-new-club", name: "New Fixture Club" },
          relistConfirmed: true,
        }),
      ]);
      let release!: () => void;
      let entered!: () => void;
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const paid = f.zeroDraw(() =>
        ledger.buyPack(other, randomUUID(), paidInput, async (tx) => {
          await tx`select commercial_billing.lock_roster_issuance()`;
          entered();
          await gate;
        }),
      );
      await ready;
      const removal = apply([change({ expectedRevision: await revision() })]);
      try {
        await waitForAdvisory(1);
      } finally {
        release();
      }
      const bought = await paid;
      await removal;
      const [card] =
        await admin`select c.serial,d.player_id from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where c.pack=${bought.id}`;
      assert.equal(card.player_id, player);
      assert.equal(card.serial, 10);
      await assert.rejects(f.award(freeCommand()), /supply|available/i);
      await assert.rejects(
        ledger.buyPack(other, randomUUID(), paidInput, f.noAuthorisation),
        /supply|available/i,
      );
    },
  );

  await check(
    "stale repeatable-read snapshots cannot mint after a separately committed removal or overwrite current facts",
    async () => {
      await apply([
        change({
          expectedRevision: await revision(),
          registration: "ACTIVE",
          currentClub: { id: "fixture-new-club", name: "New Fixture Club" },
          relistConfirmed: true,
        }),
      ]);
      const before = await f.fingerprint();
      await assert.rejects(
        runtime.begin("isolation level repeatable read", async (raw) => {
          const tx = raw as unknown as Sql;
          await f.authorise()(tx);
          assert.equal(
            (
              await tx`select commercial_billing.roster_can_issue('afl',${player}::uuid) value`
            )[0].value,
            true,
          );
          const input = ownerPackAwardCommand.parse(freeCommand());
          const product = commercialPack("afl", "STANDARD", 1);
          const [grant] =
            await tx`select * from commercial_billing.create_pack_award(${owner}::uuid,${tx.json(input)},${digest(input)},${tx.json([product])},${f.versions.terms},${f.versions.privacy})`;
          const [pack] =
            await tx`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version,award_id,award_index) values(${recipient},${randomUUID()},${tx.json(product)},0,'[]'::jsonb,'[{"rarity":"RARE"}]'::jsonb,${commercialPolicyVersion},${grant.id},0) returning id`;
          const [definition] =
            await tx`select id,issued from commercial_billing.definitions where player_id=${player} and rarity='RARE'`;
          await apply([change({ expectedRevision: await revision() })]);
          // Establish that this connection really still sees its former ACTIVE
          // snapshot, then exercise the actual direct-runtime INSERT boundary.
          assert.equal(
            (
              await tx`select commercial_billing.roster_can_issue('afl',${player}::uuid) value`
            )[0].value,
            true,
          );
          await tx`insert into commercial_billing.cards(definition,serial,owner_id,pack,slot) values(${definition.id},${Number(definition.issued) + 1},${recipient},${pack.id},0)`;
        }),
        /READ COMMITTED/i,
      );
      assert.deepEqual(await f.fingerprint(), before);
      await assert.rejects(
        runtime.begin("isolation level repeatable read", async (raw) => {
          const tx = raw as unknown as Sql;
          await f.authorise()(tx);
          const [prior] =
            await tx`select id from commercial_billing.current_player_roster where player_id=${player}`;
          await apply([change({ expectedRevision: prior.id })]);
          const input = rosterBatchCommand.parse(
            batch([
              change({
                expectedRevision: prior.id,
                registration: "ACTIVE",
                currentClub: {
                  id: "fixture-new-club",
                  name: "New Fixture Club",
                },
                relistConfirmed: true,
              }),
            ]),
          );
          await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(input)},${digest(input)},'[]'::jsonb)`;
        }),
        /READ COMMITTED/i,
      );
      assert.equal(
        (
          await runtime`select commercial_billing.roster_can_issue('afl',${player}::uuid) value`
        )[0].value,
        false,
      );
    },
  );

  await check(
    "staged prospect accepts newer completed-draft evidence without changing identity or history and activates only with exact authority",
    async () => {
      const draftId = randomUUID();
      const draft = {
        id: draftId,
        sport: "afl" as const,
        provider: "isolated-official-fixture",
        providerId: "fictional-prospect-1",
        snapshot: {
          name: "Fictional New Draft Player",
          team: "Draft Fixture Club",
          position: "MID",
          season: "ISOLATED",
          status: "active" as const,
          synthetic: false as const,
          colour: "#16345A",
          verifiedJerseyNumber: null,
        },
        eligiblePositions: ["MID"],
        source: {
          url: source.url,
          hash: source.hash,
          checkedAt: source.observedAt,
          license: "ISOLATED FIXTURE DATA ONLY",
          verification: "Fictional local acceptance source and identity",
          permanentIssuanceEligible: false as const,
        },
      };
      const input = rosterBatchCommand.parse(
        batch([
          change({
            playerId: draftId,
            registration: "ACTIVE",
            currentClub: { id: "fixture-draft", name: "Draft Fixture Club" },
            candidate: draft,
            registerDefinitions: true,
          }),
        ]),
      );
      const planned = dormantCommercialPool([draft]);
      const before = await rosterFingerprint();
      for (const bad of [
        { ...planned[0], id: randomUUID() },
        { ...planned[0], lifetime_cap: planned[0].lifetime_cap + 1 },
        {
          ...planned[0],
          snapshot: { ...planned[0].snapshot, team: "Forged Team" },
        },
      ]) {
        await assert.rejects(
          runtime.begin(async (raw) => {
            const tx = raw as unknown as Sql;
            await f.authorise()(tx);
            await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(input)},${digest(input)},${tx.json([bad, ...planned.slice(1)])})`;
          }),
          /Canonical|definition|snapshot|identity/i,
        );
      }
      for (const property of [
        "position",
        "name",
        "team",
        "season",
        "colour",
        "status",
        "verifiedJerseyNumber",
      ]) {
        const malformed = JSON.parse(JSON.stringify(input));
        const malformedDefinitions = JSON.parse(JSON.stringify(planned));
        delete malformed.changes[0].candidate.snapshot[property];
        for (const definition of malformedDefinitions)
          delete definition.snapshot[property];
        await assert.rejects(
          runtime.begin(async (raw) => {
            const tx = raw as unknown as Sql;
            await f.authorise()(tx);
            await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(malformed)},${digest(malformed)},${tx.json(malformedDefinitions)})`;
          }),
          /snapshot|identity|position|source/i,
        );
      }
      for (const [property, value] of [
        ["colour", "not-a-colour"],
        ["status", "unknown-status"],
      ]) {
        const malformed = JSON.parse(JSON.stringify(input));
        const malformedDefinitions = JSON.parse(JSON.stringify(planned));
        malformed.changes[0].candidate.snapshot[property] = value;
        for (const definition of malformedDefinitions)
          definition.snapshot[property] = value;
        await assert.rejects(
          runtime.begin(async (raw) => {
            const tx = raw as unknown as Sql;
            await f.authorise()(tx);
            await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(malformed)},${digest(malformed)},${tx.json(malformedDefinitions)})`;
          }),
          /snapshot|identity|position|source/i,
        );
      }
      for (const property of ["license", "verification"]) {
        const malformed = JSON.parse(JSON.stringify(input));
        const malformedDefinitions = JSON.parse(JSON.stringify(planned));
        malformed.changes[0].candidate.source[property] = 123456789012345;
        for (const definition of malformedDefinitions) {
          definition.snapshot.source[property] = 123456789012345;
          if (property === "license")
            definition.rights_reference = `owner-confirmed-player-names-20261102; factual-source:123456789012345:${source.hash}; permanent-issuance-pending`;
        }
        await assert.rejects(
          runtime.begin(async (raw) => {
            const tx = raw as unknown as Sql;
            await f.authorise()(tx);
            await tx`select commercial_billing.apply_roster_batch(${owner}::uuid,${tx.json(malformed)},${digest(malformed)},${tx.json(malformedDefinitions)})`;
          }),
          /snapshot|identity|position|source/i,
        );
      }
      assert.deepEqual(await rosterFingerprint(), before);
      const earlierTime = new Date(Date.parse(observed) - 60_000).toISOString();
      const earlierSource = {
        ...source,
        url: "https://www.afl.com.au/news/isolated-prospect-fixture",
        hash: "b".repeat(64),
        observedAt: earlierTime,
        effectiveAt: earlierTime,
      };
      const staged = await store.apply(
        owner,
        {
          ...input,
          request: randomUUID(),
          changes: [
            {
              ...input.changes[0],
              registration: "UNKNOWN",
              currentClub: null,
              source: earlierSource,
              candidate: {
                ...draft,
                snapshot: {
                  ...draft.snapshot,
                  team: "Junior Fixture Club",
                  position: "FWD",
                },
                eligiblePositions: ["FWD"],
                source: {
                  ...draft.source,
                  url: earlierSource.url,
                  hash: earlierSource.hash,
                  checkedAt: earlierTime,
                },
              },
              registerDefinitions: false,
            },
          ],
        },
        f.authorise(),
      );
      assert.equal(staged.newDefinitions, 0);
      const earlierAudit =
        await admin`select * from commercial_billing.roster_batches where id=${staged.id}`;
      const initialCandidate =
        await admin`select * from commercial_billing.roster_candidates where player_id=${draftId}`;
      const stagingRow = (
        await store.read(owner, f.authorise(), { sport: "afl", q: draftId })
      ).rows[0];
      assert.equal(stagingRow.registration, "UNKNOWN");
      assert.equal(stagingRow.definitionCount, 0);
      assert.equal(stagingRow.eligibility, false);
      assert.deepEqual(stagingRow.savedClubs, []);
      input.changes[0].expectedRevision = stagingRow.revision;
      input.changes[0].relistConfirmed = true;
      const stagedFingerprint = await rosterFingerprint();
      for (const corrupted of [
        { ...draft, provider: "different-provider" },
        { ...draft, providerId: "different-person-id" },
        {
          ...draft,
          snapshot: { ...draft.snapshot, name: "Different Fictional Person" },
        },
      ]) {
        await assert.rejects(
          store.apply(
            owner,
            {
              ...input,
              request: randomUUID(),
              changes: [{ ...input.changes[0], candidate: corrupted }],
            },
            f.authorise(),
          ),
          /identity|canonical|anchor/i,
        );
      }
      assert.deepEqual(await rosterFingerprint(), stagedFingerprint);
      const receipt = await store.apply(owner, input, f.authorise());
      assert.equal(receipt.newDefinitions, 5);
      assert.deepEqual(await store.apply(owner, input, f.authorise()), receipt);
      assert.deepEqual(
        await admin`select * from commercial_billing.roster_batches where id=${staged.id}`,
        earlierAudit,
      );
      assert.deepEqual(
        await admin`select * from commercial_billing.roster_candidates where player_id=${draftId}`,
        initialCandidate,
      );
      const registered =
        await admin`select id,snapshot from commercial_billing.definitions where player_id=${draftId} order by id`;
      assert.deepEqual(
        registered.map((row) => row.id),
        planned.map((row) => row.id).sort(),
      );
      for (const row of registered) {
        assert.equal(row.snapshot.team, "Draft Fixture Club");
        assert.equal(row.snapshot.position, "MID");
        assert.equal(row.snapshot.source.url, source.url);
        assert.equal(row.snapshot.source.hash, source.hash);
      }
      const dormant = (
        await store.read(owner, f.authorise(), { sport: "afl", q: draftId })
      ).rows[0];
      assert.equal(dormant.definitionCount, 5);
      assert.equal(dormant.approvedDefinitions, 0);
      assert.equal(dormant.lifetimeIssued, 0);
      assert.equal(dormant.eligibility, false);
      assert(dormant.aliases.some((a) => a.providerId === draft.providerId));
      await assert.rejects(f.award(freeCommand()), /supply|available/i);
      const activation = {
        request: randomUUID(),
        reference: "Explicit local draft activation",
        confirmed: true,
        sport: "afl",
        playerId: draftId,
        expectedRevision: dormant.revision,
        rightsReference: "ISOLATED LOOPBACK FIXTURE ONLY",
      };
      await assert.rejects(
        runtime.begin("isolation level repeatable read", async (raw) => {
          const tx = raw as unknown as Sql;
          await f.authorise()(tx);
          await tx`select id from commercial_billing.current_player_roster where player_id=${draftId}`;
          await tx`select commercial_billing.activate_roster_candidate(${owner}::uuid,${tx.json(activation)})`;
        }),
        /READ COMMITTED/i,
      );
      await assert.rejects(
        store.activate(
          owner,
          { ...activation, rightsReference: "Unrelated fictional rights" },
          f.authorise(),
        ),
        /rights|approval/i,
      );
      await admin`update commercial_billing.control set approvals=jsonb_set(approvals,'{validUntil}',to_jsonb((clock_timestamp()-interval '1 second')::text))`;
      await assert.rejects(
        store.activate(owner, activation, f.authorise()),
        /rights|approval/i,
      );
      await admin`update commercial_billing.control set approvals=jsonb_set(approvals,'{validUntil}','"2099-01-01T00:00:00Z"'::jsonb)`;
      const [active, replayedActive] = await Promise.all([
        store.activate(owner, activation, f.authorise()),
        store.activate(owner, activation, f.authorise()),
      ]);
      assert.deepEqual(active, replayedActive);
      assert.equal(active.activatedDefinitions, 5);
      assert.deepEqual(
        await store.activate(owner, activation, f.authorise()),
        active,
      );
      const awarded = await f.zeroDraw(() => f.award(freeCommand()));
      const [newCard] =
        await admin`select c.serial,d.player_id from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where c.pack=${awarded.packs[0].id}`;
      assert.equal(newCard.player_id, draftId);
      assert.equal(newCard.serial, 1);
      await assert.rejects(
        apply([
          change({
            playerId: randomUUID(),
            registration: "ACTIVE",
            currentClub: { id: "fixture-draft", name: "Draft Fixture Club" },
            candidate: { ...draft, id: randomUUID() },
            registerDefinitions: true,
          }),
        ]),
      );
      const duplicateId = randomUUID();
      const duplicate = {
        ...draft,
        id: duplicateId,
        snapshot: { ...draft.snapshot, name: "Fictional conflicting alias" },
      };
      await assert.rejects(
        apply([
          change({
            playerId: duplicateId,
            registration: "ACTIVE",
            currentClub: { id: "fixture-draft", name: "Draft Fixture Club" },
            candidate: duplicate,
            registerDefinitions: true,
          }),
        ]),
        /alias conflicts/i,
      );
    },
  );

  await check(
    "roster owner session/MFA, immutable events, RLS and narrow definer grants remain database-enforced",
    async () => {
      const input = batch([change({ expectedRevision: await revision() })]);
      const before = await rosterFingerprint();
      await assert.rejects(
        store.apply(owner, input, f.authorise(owner, f.ownerSession, "aal1")),
        /Owner|owner|MFA/,
      );
      await assert.rejects(
        store.read(owner, f.authorise(owner, randomUUID()), {}),
        /Owner|owner|MFA/,
      );
      await admin`update private.roles set role='admin' where user_id=${owner}`;
      await assert.rejects(
        store.apply(owner, input, f.authorise()),
        /Owner|owner|MFA/,
      );
      await admin`update private.roles set role='owner' where user_id=${owner}`;
      assert.deepEqual(await rosterFingerprint(), before);
      await assert.rejects(
        admin`update commercial_billing.player_roster_events set registration='ACTIVE' where player_id=${player}`,
        /Immutable/,
      );
      await assert.rejects(
        admin`delete from commercial_billing.roster_batches`,
        /Immutable/,
      );
      for (const table of [
        "roster_batches",
        "roster_candidates",
        "player_roster_events",
        "roster_definition_registrations",
        "roster_activation_events",
      ]) {
        const [acl] =
          await runtime`select has_table_privilege(current_user,${`commercial_billing.${table}`},'INSERT') ins,has_table_privilege(current_user,${`commercial_billing.${table}`},'UPDATE') upd,has_table_privilege(current_user,${`commercial_billing.${table}`},'DELETE') del`;
        assert.deepEqual(acl, { ins: false, upd: false, del: false });
        assert.equal(
          (
            await admin`select relrowsecurity from pg_class where oid=${`commercial_billing.${table}`}::regclass`
          )[0].relrowsecurity,
          true,
        );
      }
      const funcs =
        await admin`select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='commercial_billing' and p.proname in('roster_can_issue','lock_roster_issuance','guard_roster_issuance','apply_roster_batch','owner_roster_rows','activate_roster_candidate')`;
      assert.equal(funcs.length, 6);
      for (const fn of funcs) {
        assert.equal(fn.prosecdef, true);
        assert(
          fn.proconfig.some((v: string) => /^search_path=(?:""|)$/.test(v)),
        );
        assert.equal(fn.anon, false);
        assert.equal(fn.authenticated, false);
        assert.equal(fn.service, false);
      }
    },
  );

  async function rosterFingerprint() {
    const [row] =
      await admin`select md5(coalesce(string_agg(t::text,',' order by t::text),'')) h from(select to_jsonb(x) t from commercial_billing.player_roster_events x union all select to_jsonb(x) from commercial_billing.roster_batches x union all select to_jsonb(x) from commercial_billing.roster_candidates x union all select to_jsonb(x) from sports_feed.player_aliases x)s`;
    return { ...(await f.fingerprint()), roster: row.h };
  }
  async function waitForAdvisory(minimum: number) {
    for (let i = 0; i < 80; i++) {
      const [row] =
        await admin`select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and wait_event='advisory'`;
      if (row.n >= minimum) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw Error(`Expected ${minimum} actual concurrent advisory-lock waiters`);
  }
}
