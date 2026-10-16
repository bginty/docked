import test from "node:test";
import assert from "node:assert/strict";
import { nativeListenerScope } from "../../src/core/native-listener-scope";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("failed sibling registration cannot orphan successful native listeners", async () => {
  const scope = nativeListenerScope();
  let removed = 0;
  await assert.rejects(
    Promise.all([
      scope.track(
        Promise.resolve({
          remove: async () => {
            removed++;
          },
        }),
      ),
      scope.track(Promise.reject(new Error("plugin unavailable"))),
      scope.track(
        Promise.resolve({
          remove: async () => {
            removed++;
          },
        }),
      ),
    ]),
  );
  scope.close();
  scope.close();
  await flush();
  assert.equal(removed, 2);
});

test("listeners arriving after unmount are removed and teardown failure is isolated", async () => {
  const scope = nativeListenerScope();
  let resolve!: (value: { remove(): Promise<void> }) => void;
  const registration = scope.track(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let removed = 0;
  await scope.track(
    Promise.resolve({
      remove: async () => {
        throw Error("already gone");
      },
    }),
  );
  await scope.track(
    Promise.resolve({
      remove: async () => {
        removed++;
      },
    }),
  );
  scope.close();
  resolve({
    remove: async () => {
      removed++;
    },
  });
  await registration;
  await flush();
  assert.equal(removed, 2);
});

test("repeated native mounts own only their own handles", async () => {
  let removed = 0;
  for (let i = 0; i < 20; i++) {
    const scope = nativeListenerScope();
    await scope.track(
      Promise.resolve({
        remove: async () => {
          removed++;
        },
      }),
    );
    scope.close();
  }
  await flush();
  assert.equal(removed, 20);
});
