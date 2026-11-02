import test from "node:test";
import assert from "node:assert/strict";
import { eraseAuthRetainingReferences } from "../../src/server/auth-erasure";
const id = "22ad9073-9086-47bf-a0d8-7c7349e32750";
test("account erasure retains record keys and requires confirmed provider erasure", async () => {
  const calls: unknown[] = [];
  await eraseAuthRetainingReferences(
    {
      deleteUser: async (...args) => {
        calls.push(args);
        return {
          data: { user: { id, deleted_at: "2026-11-02T00:00:00Z" } },
          error: null,
        };
      },
      getUserById: async () => ({
        data: { user: { id, deleted_at: "2026-11-02T00:00:00Z" } },
        error: null,
      }),
    },
    id,
  );
  assert.deepEqual(calls, [[id, true]]);
});
test("missing identity is retry-safe; outages and unconfirmed erasure do not complete", async () => {
  await eraseAuthRetainingReferences(
    {
      deleteUser: async () => ({
        data: { user: null },
        error: { code: "user_not_found" },
      }),
      getUserById: async () => {
        throw Error("Missing identity needs no second request");
      },
    },
    id,
  );
  for (const result of [
    { data: { user: null }, error: { code: "unexpected_failure" } },
    { data: { user: { id } }, error: null },
    {
      data: { user: { id: "different", deleted_at: "2026-11-02T00:00:00Z" } },
      error: null,
    },
    { data: { user: { id, deleted_at: "invalid" } }, error: null },
  ])
    await assert.rejects(
      eraseAuthRetainingReferences(
        {
          deleteUser: async () => ({ data: { user: null }, error: null }),
          getUserById: async () => result,
        },
        id,
      ),
      /Remote Auth erasure pending/,
    );
});
