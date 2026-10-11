import { test } from "node:test";
import assert from "node:assert/strict";
import { customerSignup } from "../../supabase/functions/customer-signup/handler.mjs";
import { customerVerification } from "../../src/core/customer-verification";
const input = {
  email: "friend@example.invalid",
  password: "Chosen test password only",
  invitation: "a".repeat(64),
};
test("invitation signup proves eligibility first; creates unverified identity only; retries do not reset password", async () => {
  let account: any = null,
    created = 0,
    bound = 0,
    sent = 0;
  const deps = {
    reserve: async () => "id",
    lookup: async () => account,
    create: async (id: string, email: string, password: string) => {
      assert.equal(password, input.password);
      created++;
      return (account = { id, email });
    },
    bind: async () => {
      bound++;
    },
    verify: async () => {
      sent++;
    },
  };
  assert.equal(
    (await customerSignup(input, deps)).redirect,
    "/app/check-email?type=verification",
  );
  await customerSignup(
    { ...input, password: "Different retry password" },
    deps,
  );
  assert.equal(created, 1);
  assert.equal(bound, 2);
  assert.equal(sent, 2);
  assert.equal(account.email_confirmed_at, undefined);
  account.email_confirmed_at = "2026-10-11T00:00:00Z";
  assert.equal((await customerSignup(input, deps)).redirect, "/app/login");
  assert.equal(sent, 2);
  await assert.rejects(
    () =>
      customerSignup(input, {
        ...deps,
        reserve: async () => {
          throw Error("Invite required");
        },
      }),
    /Invite required/,
  );
  assert.equal(created, 1);
});
test("uncertain account creation recovers only the exact reserved identity and never changes credentials", async () => {
  let lookups = 0;
  const deps = {
    reserve: async () => "id",
    lookup: async () =>
      ++lookups === 1 ? null : { id: "id", email: input.email },
    create: async () => {
      throw Error("network uncertain");
    },
    bind: async () => {},
    verify: async () => {},
  };
  assert.equal((await customerSignup(input, deps)).ok, true);
  await assert.rejects(
    () =>
      customerSignup(input, {
        ...deps,
        lookup: async () => ({ id: "other", email: input.email }),
      }),
    /not confirmed/,
  );
});
test("email verification GET never consumes tokens; POST origin, shape and provider outcome are enforced", async () => {
  const origin = "https://docked.com.au";
  let calls = 0;
  const deps = {
    enabled: true,
    origin,
    verify: async () => {
      calls++;
      return "confirmed" as const;
    },
  };
  const url =
    origin + "/auth/verify?type=signup&token_hash=" + input.invitation;
  assert.equal(
    (await customerVerification(new Request(url), deps)).status,
    200,
  );
  assert.equal(calls, 0);
  const post = (site = origin) =>
    new Request(origin + "/auth/verify", {
      method: "POST",
      headers: {
        origin: site,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "type=signup&token_hash=" + input.invitation,
    });
  assert.equal(
    (await customerVerification(post("https://other.invalid"), deps)).status,
    403,
  );
  assert.equal(calls, 0);
  const result = await customerVerification(post(), deps);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("Location"), origin + "/app");
  assert.equal(calls, 1);
  assert.equal(
    (
      await customerVerification(post(), {
        ...deps,
        verify: async () => "invalid",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await customerVerification(post(), {
        ...deps,
        verify: async () => {
          throw Error();
        },
      })
    ).status,
    503,
  );
});
