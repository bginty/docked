import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runCommunityMaintenance,
  type CommunityMaintenancePorts,
  type DeletionJob,
} from "../../src/core/community-maintenance";
import {
  authSessionsRelation,
  authUsersRelation,
} from "../../src/core/auth-relations";
import { readFile } from "node:fs/promises";

const userId = "00000000-0000-4000-8000-000000000901";
function harness(jobs: DeletionJob[]) {
  const events: string[] = [];
  const finished: boolean[] = [];
  const ports: CommunityMaintenancePorts = {
    recoverExhausted: async () => {
      events.push("recover");
    },
    leaseDeletion: async () => jobs.shift() ?? null,
    deleteAccount: async () => {
      events.push("delete");
    },
    finishDeletion: async (_job, _elapsed, failed) => {
      finished.push(failed);
    },
    purgeRetention: async () => {
      events.push("retention");
    },
    fanout: async () => {
      events.push("fanout");
      return { processed: 4, queued: 2 };
    },
    incident: async (kind) => {
      events.push(kind);
    },
  };
  return { ports, events, finished };
}
test("production Auth projections are fixed and Preview retains its existing schema", () => {
  for (const env of [
    {},
    { APP_ENV: "preview" },
    { APP_ENV: "local", DATABASE_URL: "untrusted input" },
  ]) {
    assert.equal(authUsersRelation(env), "auth.users");
    assert.equal(authSessionsRelation(env), "auth.sessions");
  }
  assert.equal(
    authUsersRelation({ APP_ENV: "production" }),
    "private.runtime_auth_users",
  );
  assert.equal(
    authSessionsRelation({ APP_ENV: "production" }),
    "private.runtime_auth_sessions",
  );
});
test("community maintenance drains bounded deletion jobs before independent retention and in-app work", async () => {
  const h = harness(
    Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      leaseToken: "token",
      userId,
    })),
  );
  const result = await runCommunityMaintenance(h.ports);
  assert.equal(result.deletionJobs, 10);
  assert.equal(result.deleted, 10);
  assert.equal(result.notifications, 2);
  assert.equal(result.errors, 0);
  assert.deepEqual(h.events.slice(-2), ["retention", "fanout"]);
  assert.ok(h.finished.every((x) => !x));
});
test("remote erasure failure records retry outcome but cannot strand the next account or in-app work", async () => {
  const h = harness([
    { id: "one", leaseToken: "a", userId },
    { id: "two", leaseToken: "b", userId },
  ]);
  let attempts = 0;
  h.ports.deleteAccount = async () => {
    if (++attempts === 1)
      throw Error("Sensitive provider text must not escape");
  };
  h.ports.purgeRetention = async () => {
    throw Error("Private retention details");
  };
  const result = await runCommunityMaintenance(h.ports);
  assert.deepEqual(h.finished, [true, false]);
  assert.equal(result.deleted, 1);
  assert.equal(result.deletionFailures, 1);
  assert.equal(result.errors, 2);
  assert.equal(result.notifications, 2);
  assert.equal(JSON.stringify(result).includes("Sensitive"), false);
});
test("malformed deletion identity never invokes Auth and unacknowledged jobs do not claim success", async () => {
  const h = harness([{ id: "one", leaseToken: "a", userId: "not-a-uuid" }]);
  const result = await runCommunityMaintenance(h.ports);
  assert.equal(result.deleted, 0);
  assert.equal(h.events.includes("delete"), false);
  assert.deepEqual(h.finished, [true]);
  const lost = harness([{ id: "two", leaseToken: "b", userId }]);
  lost.ports.finishDeletion = async () => {
    throw Error("Acknowledgement unavailable");
  };
  await assert.rejects(runCommunityMaintenance(lost.ports), /Acknowledgement/);
  assert.equal(lost.events.includes("fanout"), false);
  await assert.rejects(
    runCommunityMaintenance(h.ports, 11),
    /Invalid maintenance limit/,
  );
});
test("all runners exclude retired publication records from social fanout", async () => {
  const source = await readFile("src/server/community-social.ts", "utf8");
  assert.match(
    source,
    /options: \{ previewOnly\?: boolean; communityOnly\?: boolean \} = \{\}/,
  );
  assert.match(
    source,
    /p\.official_tip_id is null and p\.community_edge_id is null and p\.kind in \('discussion','analysis','question','celebration'\) and not author\.is_official/,
  );
  const runner = await readFile("scripts/community-maintenance.ts", "utf8");
  assert.match(
    runner,
    /processCommunityNotifications\(\{ communityOnly: true \}\)/,
  );
  assert.doesNotMatch(
    runner,
    /ResendEmail|leaseOutbox|collectObservations|processLeaderboardNotifications|scheduleEdgeScans/,
  );
});
