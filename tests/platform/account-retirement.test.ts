import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  retireContainedAccount,
  type RetirementCheckpoint,
} from "../../src/core/account-retirement";
const email = "synthetic@retirement.invalid";
const checkpoint: RetirementCheckpoint = {
  userId: "synthetic",
  kind: "customer",
  phase: "access_blocked",
  emailSha256: createHash("sha256").update(email).digest("hex"),
};
for (const kind of ["owner", "system"] as const)
  test(`${kind} cannot be retired`, async () => {
    await assert.rejects(
      retireContainedAccount({
        checkpoint: { ...checkpoint, kind },
        admin: {
          getUserById: async () => {
            throw Error("must not call");
          },
          deleteUser: async () => {
            throw Error("must not call");
          },
        },
        recordAttempt: async () => {},
        verifyAndRecord: async () => {},
      }),
      /Only a contained/,
    );
  });
test("timeout after provider commit is recovered without another deletion", async () => {
  let deleted = false,
    calls = 0,
    attempts = 0,
    verified = 0;
  const input = {
    checkpoint,
    admin: {
      getUserById: async () => ({
        data: {
          user: {
            id: "synthetic",
            email: deleted ? "tombstone" : email,
            ...(deleted ? { deleted_at: "2026-11-17" } : {}),
          },
        },
        error: null,
      }),
      deleteUser: async (_id: string, soft: true) => {
        assert.equal(soft, true);
        calls++;
        deleted = true;
        return { data: { user: null }, error: Error("lost response") };
      },
    },
    recordAttempt: async () => {
      attempts++;
    },
    verifyAndRecord: async () => {
      verified++;
    },
  };
  await assert.rejects(retireContainedAccount(input), /uncertain/);
  assert.equal(verified, 0);
  await retireContainedAccount(input);
  assert.equal(calls, 1);
  assert.equal(attempts, 1);
  assert.equal(verified, 1);
});
test("pre-provider checkpoint failure cannot delete Auth", async () => {
  let called = false;
  await assert.rejects(
    retireContainedAccount({
      checkpoint,
      admin: {
        getUserById: async () => ({
          data: { user: { id: "synthetic", email } },
          error: null,
        }),
        deleteUser: async () => {
          called = true;
          throw Error("unexpected");
        },
      },
      recordAttempt: async () => {
        throw Error("checkpoint failed");
      },
      verifyAndRecord: async () => {},
    }),
    /checkpoint failed/,
  );
  assert.equal(called, false);
});
test("missing Auth row and email drift fail closed", async () => {
  for (const user of [null, { id: "synthetic", email: "someone-else@invalid" }])
    await assert.rejects(
      retireContainedAccount({
        checkpoint,
        admin: {
          getUserById: async () => ({ data: { user }, error: null }),
          deleteUser: async () => {
            throw Error("unexpected deletion");
          },
        },
        recordAttempt: async () => {},
        verifyAndRecord: async () => {},
      }),
      /readback|identity drift/,
    );
});
test("post-provider database failure remains blocked and retry verifies without deletion", async () => {
  let deletes = 0,
    checks = 0;
  const input = {
    checkpoint,
    admin: {
      getUserById: async () => ({
        data: {
          user: {
            id: "synthetic",
            email: "tombstone",
            deleted_at: "2026-11-17",
          },
        },
        error: null,
      }),
      deleteUser: async () => {
        deletes++;
        throw Error("unexpected");
      },
    },
    recordAttempt: async () => {},
    verifyAndRecord: async () => {
      if (++checks === 1) throw Error("DB unavailable");
    },
  };
  await assert.rejects(retireContainedAccount(input), /DB unavailable/);
  await retireContainedAccount(input);
  assert.equal(deletes, 0);
  assert.equal(checks, 2);
});
test("completed checkpoint with reactivated identity is rejected", async () => {
  await assert.rejects(
    retireContainedAccount({
      checkpoint: { ...checkpoint, phase: "auth_retired" },
      admin: {
        getUserById: async () => ({
          data: { user: { id: "synthetic", email } },
          error: null,
        }),
        deleteUser: async () => {
          throw Error("unexpected");
        },
      },
      recordAttempt: async () => {},
      verifyAndRecord: async () => {},
    }),
    /became active/,
  );
});
