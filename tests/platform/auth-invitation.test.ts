import { test } from "node:test";
import assert from "node:assert/strict";
import {
  invitationRequest,
  productionInvitationsEnabled,
} from "../../src/core/auth-invitation";
import {
  messagesFor,
  productionRecipientAllowed,
} from "../../supabase/functions/docked-auth-email/mail.mjs";
import { queueJobs } from "../../supabase/functions/docked-auth-email/queue.mjs";

const origin = "https://docked-production.netlify.app";
const token = "a".repeat(64);
test("production recipient policy defaults closed, support tests cannot email friends, beta requires exact list", () => {
  assert.equal(productionRecipientAllowed("support@docked.com.au", {}), false);
  assert.equal(
    productionRecipientAllowed("support@docked.com.au", {
      DOCKED_GRAPH_RECIPIENT_MODE: "support-test",
    }),
    true,
  );
  assert.equal(
    productionRecipientAllowed("friend@example.test", {
      DOCKED_GRAPH_RECIPIENT_MODE: "support-test",
    }),
    false,
  );
  const env = {
    DOCKED_GRAPH_RECIPIENT_MODE: "approved-beta",
    DOCKED_GRAPH_BETA_RECIPIENTS: "support@docked.com.au,friend@example.test",
  };
  assert.equal(productionRecipientAllowed("friend@example.test", env), true);
  assert.equal(productionRecipientAllowed("other@example.test", env), false);
  for (const list of [
    "",
    "*",
    "friend@example.test,friend@example.test",
    Array.from({ length: 21 }, (_, n) => `f${n}@example.test`).join(","),
  ])
    assert.equal(
      productionRecipientAllowed("friend@example.test", {
        ...env,
        DOCKED_GRAPH_BETA_RECIPIENTS: list,
      }),
      false,
    );
});
const link = origin + "/auth/invite?type=invite&token_hash=" + token;
function post(
  body = new URLSearchParams({ type: "invite", token_hash: token }),
  from = origin,
) {
  return new Request(origin + "/auth/invite", {
    method: "POST",
    headers: { Origin: from },
    body,
  });
}
test("invitation GET and mail scanner requests cannot consume a token", async () => {
  let calls = 0;
  const deps = {
    enabled: true,
    siteUrl: origin,
    verify: async () => {
      calls++;
      return "confirmed" as const;
    },
  };
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const response = await invitationRequest(
      new Request(link, { method }),
      deps,
    );
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.match(
      response.headers.get("content-security-policy")!,
      /default-src 'none'/,
    );
    if (method === "GET") {
      assert.equal(response.status, 200);
      assert.match(await response.text(), /method="post"/);
    } else assert.equal(response.status, 405);
  }
  assert.equal(calls, 0);
});
test("confirmation rejects forged origins, malformed/duplicate fields and oversize bodies before Auth", async () => {
  let calls = 0;
  const deps = {
    enabled: true,
    siteUrl: origin,
    verify: async () => {
      calls++;
      return "confirmed" as const;
    },
  };
  const bad = [
    post(undefined, "https://attacker.invalid"),
    new Request(link, { method: "POST", body: "token_hash=" + token }),
    post(
      new URLSearchParams(
        "type=invite&token_hash=" + token + "&token_hash=" + token,
      ),
    ),
    post(new URLSearchParams({ type: "recovery", token_hash: token })),
    post(
      new URLSearchParams({
        type: "invite",
        token_hash: "<script>alert(1)</script>",
      }),
    ),
    post(new URLSearchParams({ type: "invite", token_hash: "a".repeat(4000) })),
  ];
  for (const request of bad)
    assert.ok((await invitationRequest(request, deps)).status >= 400);
  assert.equal(calls, 0);
});
test("only confirmed invite gets fixed password destination; invalid and uncertain outcomes stay distinct", async () => {
  for (const outcome of ["confirmed", "invalid", "unavailable"] as const) {
    const response = await invitationRequest(post(), {
      enabled: true,
      siteUrl: origin,
      verify: async (input) => {
        assert.equal(input, token);
        return outcome;
      },
    });
    assert.equal(
      response.status,
      outcome === "confirmed" ? 303 : outcome === "invalid" ? 400 : 503,
    );
    assert.equal(
      response.headers.get("location"),
      outcome === "confirmed" ? origin + "/app/reset-password" : null,
    );
    if (outcome !== "confirmed")
      assert.ok(!(await response.text()).includes(token));
  }
  const thrown = await invitationRequest(post(), {
    enabled: true,
    siteUrl: origin,
    verify: async () => {
      throw Error("private-provider-error");
    },
  });
  assert.equal(thrown.status, 503);
  assert.doesNotMatch(await thrown.text(), /private-provider-error/);
});
test("invites require exact production identity and both new and existing activation gates", async () => {
  const env = {
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DOCKED_AUTH_INVITES_READY: "true",
    AUTH_EMAIL_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    SITE_URL: origin,
  };
  assert.equal(productionInvitationsEnabled(env), true);
  for (const key of Object.keys(env))
    assert.equal(
      productionInvitationsEnabled({ ...env, [key]: undefined }),
      false,
    );
  assert.equal(
    productionInvitationsEnabled({ ...env, APP_ENV: "preview" }),
    false,
  );
  assert.equal(
    productionInvitationsEnabled({ ...env, SITE_URL: "https://evil.invalid" }),
    false,
  );
  const response = await invitationRequest(post(), {
    enabled: false,
    siteUrl: origin,
    verify: async () => {
      throw Error("must not run");
    },
  });
  assert.equal(response.status, 503);
});
test("invite messages use gated browser confirmation and encrypted stable queue identities", async () => {
  const payload = {
    user: { email: "support@docked.com.au" },
    email_data: {
      site_url: origin,
      redirect_to: origin + "/auth/callback",
      email_action_type: "invite",
      token_hash: token,
    },
  };
  assert.throws(() => messagesFor(payload));
  assert.throws(() =>
    messagesFor(
      {
        ...payload,
        email_data: {
          ...payload.email_data,
          redirect_to: "https://docked.com.au/auth/callback",
        },
      },
      { allowInvites: true },
    ),
  );
  const messages = messagesFor(payload, { allowInvites: true });
  const url = new URL(
    messages[0].body.content
      .split("\n")
      .find((s: string) => s.startsWith("https://"))!,
  );
  assert.equal(url.pathname, "/auth/invite");
  assert.equal(url.origin, origin);
  assert.equal(url.searchParams.get("token_hash"), token);
  assert.equal(url.searchParams.get("type"), "invite");
  assert.equal(url.searchParams.has("redirect_to"), false);
  const secret = "v1,whsec_" + Buffer.alloc(32, 8).toString("base64");
  const a = await queueJobs(messages, secret, "controlled"),
    b = await queueJobs(messages, secret, "controlled");
  assert.equal(a[0].id, b[0].id);
  assert.doesNotMatch(JSON.stringify(a), /support@|token_hash=/);
});

test("alternate invitation host is rejected before rendering or verifying", async () => {
  let calls = 0;
  const response = await invitationRequest(
    new Request(link.replace(origin, "https://docked.com.au")),
    {
      enabled: true,
      siteUrl: origin,
      verify: async () => {
        calls++;
        return "confirmed";
      },
    },
  );
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
  assert.doesNotMatch(await response.text(), new RegExp(token));
});
