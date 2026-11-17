import { test } from "node:test";
import assert from "node:assert/strict";
import { productionPhoneAdapter } from "./lib/production-phone-adapter.mjs";
test("OFF-only adapter rejects another project/window and enabling payload before any call", async () => {
  let calls = 0;
  const db = () => {
    calls++;
    throw Error("unexpected database call");
  };
  const api = productionPhoneAdapter(
    db,
    async () => {
      calls++;
    },
    { windowId: "reviewed-one-founder" },
  );
  assert.throws(() => api.config("other-project"));
  assert.throws(() =>
    api.disable("pojoymtniryarxxunyvz", {
      external_phone_enabled: true,
      hook_send_sms_enabled: true,
    }),
  );
  assert.throws(() =>
    api.disable("pojoymtniryarxxunyvz", {
      external_phone_enabled: false,
      hook_send_sms_enabled: false,
      disable_signup: false,
    }),
  );
  await assert.rejects(() => api.closeWindow("another-window"));
  await assert.rejects(() => api.window("another-window"));
  assert.equal(calls, 0);
});
test("wrong approval cannot close an unrelated budget window", async () => {
  let statements = 0;
  const tx = async () => {
    statements++;
    return [
      { id: "reviewed-one-founder", authority_reference: "b".repeat(64) },
    ];
  };
  const db = { begin: async (f) => f(tx) };
  const api = productionPhoneAdapter(db, async () => {}, {
    windowId: "reviewed-one-founder",
    approvalSha256: "a".repeat(64),
  });
  await assert.rejects(
    () => api.closeWindow("reviewed-one-founder"),
    /Unrelated authority/,
  );
  assert.equal(
    statements,
    1,
    "No UPDATE or audit INSERT after failed authority check",
  );
});
