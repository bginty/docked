import test from "node:test";
import assert from "node:assert/strict";
import { mobileSportCapabilities } from "../../src/core/mobile-capabilities";

test("ordinary public members receive the public sports without beta allowlisting", async () => {
  const result = await mobileSportCapabilities({
    publicMode: true,
    publicSports: async () => ["nrl", "afl", "nfl", "basketball", "nbl"],
    betaSports: async () => {
      throw Error("must not read beta admission");
    },
  });
  assert.deepEqual(result, ["nfl", "afl", "nrl"]);
});
test("denied public eligibility never defaults to NFL or private beta", async () => {
  const deps = {
    publicMode: true,
    publicSports: async (): Promise<string[]> => [],
    betaSports: async () => ["afl", "nrl"],
  };
  assert.deepEqual(await mobileSportCapabilities(deps), []);
  await assert.rejects(
    mobileSportCapabilities({
      ...deps,
      publicSports: async () => {
        throw Error("session expired");
      },
    }),
  );
});
test("private beta retains NFL and only eligible visible sports", async () => {
  assert.deepEqual(
    await mobileSportCapabilities({
      publicMode: false,
      publicSports: async () => {
        throw Error("public programme is disabled");
      },
      betaSports: async () => ["nrl", "basketball"],
    }),
    ["nfl", "nrl"],
  );
});
