import { test } from "node:test";
import assert from "node:assert/strict";
import { assertHostedBeta } from "../../src/core/hosted-beta.mjs";
import { betaStatement, betaSql } from "../../src/server/beta-sql";
import postgres from "postgres";
import {
  messagesFor,
  productionRecipientAllowed,
} from "../../supabase/functions/docked-auth-email/mail.mjs";

test("email accepts only the exact operator-pinned beta callback and at most eleven recipients", () => {
  const origin = "https://docked-production-fixture.vercel.app";
  const payload = {
    user: { email: "support@docked.com.au" },
    email_data: {
      site_url: origin,
      redirect_to: origin + "/auth/callback?next=/app/verified",
      email_action_type: "invite",
      token_hash: "a".repeat(40),
    },
  };
  assert.throws(
    () => messagesFor(payload, { allowInvites: true }),
    /Unapproved/,
  );
  assert.equal(
    messagesFor(payload, { allowInvites: true, betaOrigin: origin }).length,
    1,
  );
  assert.throws(
    () =>
      messagesFor(
        {
          ...payload,
          email_data: {
            ...payload.email_data,
            redirect_to:
              "https://docked-production-other.vercel.app/auth/callback",
          },
        },
        { allowInvites: true, betaOrigin: origin },
      ),
    /Unapproved/,
  );
  assert.throws(
    () =>
      messagesFor(payload, {
        allowInvites: true,
        betaOrigin: origin + "@example.invalid",
      }),
    /Unapproved/,
  );
  const recipients = Array.from(
    { length: 12 },
    (_, n) => `member${n}@example.invalid`,
  );
  assert.equal(
    productionRecipientAllowed(recipients[0], {
      DOCKED_GRAPH_RECIPIENT_MODE: "approved-beta",
      DOCKED_GRAPH_BETA_RECIPIENTS: recipients.join(","),
    }),
    false,
  );
});
function env(): Record<string, string | undefined> {
  const e: Record<string, string | undefined> = {
    DOCKED_BETA_STAGING: "true",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "preview",
    VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    VERCEL_ORG_ID: "team_tf6xweKKyVCj9bTppUKttJ4l",
    VERCEL_GIT_COMMIT_REF: "codex/vercel-beta-review",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_URL: "docked-production-fixture.vercel.app",
    SITE_URL: "https://docked-production-fixture.vercel.app",
    DOCKED_HOSTED_REVIEW: "false",
    DOCKED_HOSTED_PREVIEW: "false",
    DOCKED_HOSTED_PRODUCTION: "false",
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DATABASE_RUNTIME: "serverless",
    DOCKED_RELEASE_CHANNEL: "beta",
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    DATABASE_URL:
      "postgres://docked_beta_app:test@db.pojoymtniryarxxunyvz.supabase.co:5432/postgres",
    DATABASE_CONNECTION_MODE: "direct",
  };
  for (const k of [
    "REGISTRATION_ENABLED",
    "PUBLICATION_ENABLED",
    "AUTO_PUBLISH_DOCKED_EDGES",
    "ODDS_POLLING_ENABLED",
    "MARKET_DATA_POLLING_ENABLED",
    "EDGE_SCANNER_ENABLED",
    "FORWARD_PAPER_ENABLED",
    "SENDING_ENABLED",
    "ADS_ENABLED",
    "AFFILIATES_ENABLED",
    "PAID_PLANS_ENABLED",
    "PRO_ENTITLEMENTS_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DEALS_ENABLED",
    "DEMO_MODE",
    "FANTASY_CARDS_PREVIEW",
    "BETA_ACCESS_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "DOCKED_AUTH_INVITES_READY",
    "FANTASY_FREE_PLAY_PRODUCTION",
  ])
    e[k] = "false";
  e.BETA_TESTERS_ENABLED = "false";
  return e;
}
test("beta staging accepts only its exact protected Preview and beta database role", () => {
  assert.equal(assertHostedBeta(env()), true);
  for (const change of [
    { VERCEL_ENV: "production" },
    { DATABASE_RUNTIME: "persistent" },
    { VERCEL_TARGET_ENV: "production" },
    { VERCEL_ORG_ID: "other" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { SITE_URL: "https://docked.com.au" },
    {
      DATABASE_URL: env().DATABASE_URL!.replace(
        "docked_beta_app",
        "docked_app",
      ),
    },
    {
      DATABASE_URL: env().DATABASE_URL!.replace(
        "pojoymtniryarxxunyvz",
        "bckkllmndoxzpzdqrevb",
      ),
    },
  ])
    assert.throws(() => assertHostedBeta({ ...env(), ...change }));
});
test("unapproved beta cannot enable accounts, mail, public signup, games or privileged web credentials", () => {
  for (const flag of [
    "BETA_ACCESS_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "DOCKED_AUTH_INVITES_READY",
    "FANTASY_FREE_PLAY_PRODUCTION",
    "REGISTRATION_ENABLED",
    "PUBLICATION_ENABLED",
  ])
    assert.throws(() => assertHostedBeta({ ...env(), [flag]: "true" }));
  for (const flag of [
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GRAPH_CERTIFICATE",
    "MICROSOFT_CLIENT_SECRET",
  ])
    assert.throws(() => assertHostedBeta({ ...env(), [flag]: "test" }));
});
test("SQL routing covers all three namespaces without rewriting already routed identifiers", () => {
  assert.equal(
    betaStatement(
      "select public.profiles,private.roles,fantasy.cards,auth.users,beta_fantasy.cards",
    ),
    "select beta_public.profiles,beta_private.roles,beta_fantasy.cards,auth.users,beta_fantasy.cards",
  );
});
test("SQL routing leaves bound text and JSON data intact", async () => {
  const calls: unknown[][] = [];
  const fake = Object.assign(
    (...args: unknown[]) => {
      calls.push(args);
      return args;
    },
    {
      json: (v: unknown) => v,
      unsafe: (...args: unknown[]) => {
        calls.push(args);
        return args;
      },
      begin: async (fn: (tx: unknown) => unknown) => fn(fake),
    },
  );
  const sql = betaSql(fake as unknown as ReturnType<typeof postgres>);
  const text = "private.roles fantasy.cards";
  void sql`select * from private.social_posts where body=${text}`;
  assert.equal(
    (calls[0][0] as string[])[0],
    "select * from beta_private.social_posts where body=",
  );
  assert.equal(calls[0][1], text);
  await sql.begin(async (tx) => {
    tx.unsafe("select * from fantasy.cards where id=$1", [text]);
  });
  assert.equal(calls[1][0], "select * from beta_fantasy.cards where id=$1");
  assert.deepEqual(calls[1][1], [text]);
  assert.deepEqual(sql.json({ body: text }), { body: text });
});
