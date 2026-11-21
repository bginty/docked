import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import {
  accountDeletionPendingMessage,
  exportWithdrawalAccount,
  withdrawalAccountDeletionStatus,
  withdrawalAccountExportSchema,
} from "../../src/server/commercial-withdrawal-account";

const member = randomUUID();
const identity = { member, sessionId: randomUUID(), aal: "aal1" };
test("legacy and beta account controls do not require an installed withdrawal module", async () => {
  let reads = 0;
  const missing = (async () => {
    reads++;
    return [{ installed: false, exporter: false, deletion: false }];
  }) as unknown as Sql;
  assert.equal(await exportWithdrawalAccount(missing, identity, {}), null);
  assert.equal(
    await withdrawalAccountDeletionStatus(missing, member, {}),
    null,
  );
  assert.equal(reads, 2);
  assert.equal(
    await exportWithdrawalAccount(missing, identity, {
      DOCKED_BETA_STAGING: "true",
    }),
    null,
  );
  assert.equal(reads, 2);
});

test("a partial cash migration or service error cannot report cleanup complete", async () => {
  const partial = (async () => [
    { installed: true, exporter: false, deletion: false },
  ]) as unknown as Sql;
  await assert.rejects(
    withdrawalAccountDeletionStatus(partial, member, {}),
    /migration is incomplete/,
  );
  const unavailable = (async () => {
    throw Error("database unavailable");
  }) as unknown as Sql;
  await assert.rejects(
    withdrawalAccountDeletionStatus(unavailable, member, {}),
    /database unavailable/,
  );
  assert.match(
    accountDeletionPendingMessage("withdrawal"),
    /review remains pending/,
  );
  assert.match(
    accountDeletionPendingMessage("withdrawal"),
    /balances are preserved/,
  );
});

test("withdrawal export rejects unexpected identity and bank payload fields", () => {
  const clean = {
    identity: null,
    withdrawals: [],
    destinations: [],
    accountClosure: null,
  };
  assert.equal(withdrawalAccountExportSchema.safeParse(clean).success, true);
  for (const key of [
    "ciphertext",
    "legalNameHash",
    "providerPayload",
    "identityDocument",
  ])
    assert.equal(
      withdrawalAccountExportSchema.safeParse({
        ...clean,
        [key]: "must-not-leak",
      }).success,
      false,
    );
});
