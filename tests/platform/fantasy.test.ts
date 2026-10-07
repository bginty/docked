import { test } from "node:test";
import assert from "node:assert/strict";
import { fantasyRetry } from "../../src/core/fantasy-request";
import { fantasyEnabled, fantasyAction } from "../../src/core/fantasy";
test("lost committed response retry retains exact idempotency key", () => {
  let generated = 0;
  const uuid = () => String(++generated);
  const payload = { user_id: "member", amount: 1000 };
  const first = fantasyRetry(null, "admin_credit", payload, uuid);
  const retry = fantasyRetry(first, "admin_credit", { ...payload }, uuid);
  assert.deepEqual(first, retry);
  assert.equal(generated, 1);
  assert.throws(
    () =>
      fantasyRetry(first, "admin_credit", { ...payload, amount: 1001 }, uuid),
    /pending/,
  );
});
test("fantasy feature remains disabled in production and by default", () => {
  assert.equal(fantasyEnabled({}), false);
  assert.equal(
    fantasyEnabled({
      FANTASY_CARDS_PREVIEW: "true",
      APP_ENV: "production",
      SUPABASE_ENV: "preview",
    }),
    false,
  );
  assert.equal(
    fantasyEnabled({
      FANTASY_CARDS_PREVIEW: "true",
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      VERCEL_ENV: "production",
    }),
    false,
  );
});
test("fantasy commands reject client ownership or unexpected admin fields", () => {
  assert.equal(
    fantasyAction.safeParse({
      action: "mint",
      request_id: crypto.randomUUID(),
      payload: {},
    }).success,
    false,
  );
  assert.equal(
    fantasyAction.safeParse({
      action: "list",
      request_id: crypto.randomUUID(),
      payload: {
        card_id: crypto.randomUUID(),
        price: 100,
        owner_id: crypto.randomUUID(),
      },
    }).success,
    false,
  );
});
