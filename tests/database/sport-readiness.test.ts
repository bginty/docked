import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { pgliteSql } from "../fixtures/pglite-sql";
import { SportReadinessStore } from "../../src/server/sport-readiness-store";
import { fixturePackage, readinessNow } from "../fixtures/readiness-package";
import { sportEventRules } from "../../src/core/sport-event-rules";
import { digest } from "../../src/core/scoring-engine";
test("durable stable identities, transfers, duplicate conflicts and owner release decisions remain isolated", async () => {
  const db = await multiSportDatabase();
  try {
    const store = new SportReadinessStore(pgliteSql(db.pg));
    const policy = {
      sport: "afl",
      season: "2099",
      provider: "qa-provider",
      rightsEvidence: "https://example.invalid/qa",
      rightsExpiresAt: "2099-02-01T00:00:00Z",
      rosterUse: true,
      storage: true,
      fantasyUse: true,
      maxAgeHours: 24,
      permittedRegistrations: ["active"],
    };
    const player = {
      sport: "afl",
      season: "2099",
      provider: policy.provider,
      playerId: "stable-one",
      providerPlayerId: "source-one",
      name: "Fictional Same Name",
      teamId: "qa:a",
      teamName: "QA A",
      identityVerified: true,
      registration: "active",
      availability: "injured",
      positions: ["MID"],
      positionsVerified: true,
      jerseyNumber: null,
      jerseyVerified: false,
      evidence: {
        url: "https://example.invalid/roster",
        sha256: "a".repeat(64),
        observedAt: readinessNow,
      },
    };
    const first = await store.stageRoster(
      [player],
      policy,
      ["qa:a"],
      readinessNow,
    );
    assert.equal(first.rows[0].status, "ready-for-review");
    assert.equal(
      (await store.stageRoster([player], policy, ["qa:a"], readinessNow))
        .replay,
      true,
    );
    await store.stageRoster(
      [
        {
          ...player,
          teamId: "qa:b",
          teamName: "QA B",
          availability: "suspended",
        },
      ],
      policy,
      ["qa:b"],
      readinessNow,
    );
    assert.equal(
      (
        await db.q("select count(*)::int n from sports_feed.player_identities")
      )[0].n,
      1,
    );
    const conflict = await store.stageRoster(
      [{ ...player, playerId: "wrong-new-id" }],
      policy,
      ["qa:a"],
      readinessNow,
    );
    assert.equal(conflict.rows[0].status, "quarantined");
    assert.match(conflict.rows[0].reasons.join(), /identity conflict/);
    assert.equal(
      (await db.q("select player_id from sports_feed.player_aliases"))[0]
        .player_id,
      "stable-one",
    );
    await store.stageRoster(
      [
        {
          ...player,
          playerId: "different-person",
          providerPlayerId: "source-two",
        },
      ],
      policy,
      ["qa:a"],
      readinessNow,
    );
    assert.equal(
      (
        await db.q("select count(*)::int n from sports_feed.player_identities")
      )[0].n,
      2,
    );
    await assert.rejects(
      db.q(
        "update sports_feed.player_aliases set player_id='different-person'",
      ),
      /Append only/,
    );
    const p = fixturePackage(),
      staged = await store.stagePackage(p, readinessNow);
    assert.equal(staged.activated, false);
    await assert.rejects(
      db.q(
        "select beta_private.sport_readiness_decide($1,'approve','QA acceptance only',$2)",
        [staged.hash, randomUUID()],
      ),
      /Owner MFA/,
    );
    // Explicit isolated owner fixture, not a production role assignment.
    await db.q(
      "insert into beta_private.roles(user_id,role) values($1,'owner')",
      [db.user],
    );
    await db.q(
      "create or replace function beta_private.owner_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$",
    );
    await db.pg.exec(
      "do $$declare r record;begin for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='beta_private' and p.proname like 'sport_readiness_%' and p.prokind='f' loop execute replace(pg_get_functiondef(r.oid),'clock_timestamp()','qa.now()');end loop;end$$;",
    );
    await db.q("select set_config('qa.now',$1,false)", [readinessNow]);
    // multiSportDatabase replaces clock_timestamp only on functions installed at setup.
    const id = randomUUID();
    await db.q(
      "select beta_private.sport_readiness_decide($1,'approve','QA acceptance only',$2)",
      [staged.hash, id],
    );
    await db.q(
      "select beta_private.sport_readiness_decide($1,'approve','QA acceptance only',$2)",
      [staged.hash, id],
    );
    assert.equal(
      (
        await db.q(
          "select count(*)::int n from sports_feed.activation_decisions",
        )
      )[0].n,
      1,
    );
    await assert.rejects(
      db.q(
        "select beta_private.sport_readiness_decide($1,'suspend','QA acceptance only',$2)",
        [staged.hash, id],
      ),
      /idempotency/,
    );
    const bad = structuredClone(p);
    bad.evidence[0].expiresAt = readinessNow;
    const blocked = await store.stagePackage(bad, readinessNow);
    await assert.rejects(
      db.q(
        "select beta_private.sport_readiness_decide($1,'approve','QA acceptance only',$2)",
        [blocked.hash, randomUUID()],
      ),
      /expired/,
    );
    const [r] = await db.q("select beta_private.sport_readiness_report() r");
    assert.equal(r.r.activatedByThisSystem, false);
    const rules = sportEventRules("afl"),
      approved = fixturePackage();
    approved.rulesHash = digest(rules);
    approved.evidence.forEach((e) => {
      e.rulesHash = approved.rulesHash;
    });
    const ready = await store.stagePackage(approved, readinessNow);
    const period = {
      id: "beta-real:afl:qa-preparation",
      sport: "afl" as const,
      season: approved.season,
      label: "Fictional unpublished",
      locksAt: "2099-01-03T00:00:00Z",
      rules,
      lineupVersion: approved.formatVersion,
      competitionMode: "OPEN" as const,
      fixtures: [
        {
          id: "qa:fixture",
          scheduledAt: "2099-01-03T00:00:00Z",
          playerIds: ["stable-one"],
        },
      ],
    };
    await assert.rejects(
      store.prepareApprovedPeriod(ready.hash, period, readinessNow),
      /gates/,
    );
    await db.q(
      "select beta_private.sport_readiness_decide($1,'approve','QA gate acceptance only',$2)",
      [ready.hash, randomUUID()],
    );
    assert.deepEqual(
      await store.prepareApprovedPeriod(ready.hash, period, readinessNow),
      { streamId: period.id, published: false, issuedCards: 0 },
    );
    await assert.rejects(
      store.prepareApprovedPeriod(
        ready.hash,
        { ...period, id: "beta-real:afl:wrong-season", season: "2100" },
        readinessNow,
      ),
      /differs/,
    );
    await db.q(
      "select beta_private.sport_readiness_decide($1,'suspend','QA suspend acceptance only',$2)",
      [ready.hash, randomUUID()],
    );
    await assert.rejects(
      store.prepareApprovedPeriod(
        ready.hash,
        { ...period, id: "beta-real:afl:next" },
        readinessNow,
      ),
      /gates/,
    );
    for (const role of ["anon", "authenticated", "docked_beta_app"]) {
      assert.equal(
        (
          await db.q(
            "select has_table_privilege($1,'sports_feed.player_aliases','UPDATE') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
      assert.equal(
        (
          await db.q(
            "select has_table_privilege($1,'sports_feed.activation_packages','INSERT') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
    }
    await db.q("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: db.user,
        aal: "aal1",
        session_id: db.sessions[db.user],
      }),
    ]);
    await assert.rejects(
      db.q("select beta_private.sport_readiness_report()"),
      /Owner MFA/,
    );
  } finally {
    await db.pg.close();
  }
});
