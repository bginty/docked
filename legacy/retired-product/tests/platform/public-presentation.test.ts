import test from "node:test";
import assert from "node:assert/strict";
import {
  activeHomepageTips,
  publicBoardState,
} from "../../src/core/public-presentation";
import { operatorPresentation } from "../../src/core/operator-presentation";
import robots from "../../src/app/robots";
import manifest from "../../src/app/manifest";

test("homepage selection uses current derived eligibility and cutoff, never original active state", () => {
  const now = Date.parse("2026-10-04T00:00:00Z");
  const tip = { availability: "active", start_at: "2026-10-04T02:00:00Z" };
  const rows = [
    "active",
    "price_below_minimum",
    "expired",
    "suspended",
    "settled",
  ].map((display_status) => ({ ...tip, display_status }));
  rows.push({
    ...tip,
    display_status: "active",
    start_at: "2026-10-04T00:10:00Z",
  });
  rows.push({ ...tip, display_status: "active", start_at: "invalid" });
  assert.deepEqual(activeHomepageTips(rows, now), [rows[0]]);
});

test("anonymous jurisdiction is unknown while signed-in restrictions and research gates remain visible", () => {
  const gates = {
    strategy: true,
    feed: true,
    publication: true,
    region: false,
  };
  assert.equal(publicBoardState(gates, false).code, "sign_in_required");
  assert.equal(publicBoardState(gates, true).code, "restricted");
  assert.equal(
    publicBoardState({ ...gates, strategy: false }, false).code,
    "research_pending",
  );
  assert.equal(
    publicBoardState({ ...gates, feed: false }, false).code,
    "feed_unavailable",
  );
});

test("operator facts require explicit input and safe public destinations", () => {
  assert.deepEqual(operatorPresentation({}), {
    legalName: null,
    abn: null,
    supportEmail: null,
    supportUrl: null,
  });
  const supplied = operatorPresentation({
    DOCKED_LEGAL_NAME: "Fixture operator",
    DOCKED_ABN: "12 345 678 901",
    DOCKED_SUPPORT_EMAIL: "support@example.invalid",
    DOCKED_SUPPORT_URL: "https://support.example.invalid/contact",
  });
  assert.equal(supplied.legalName, "Fixture operator");
  assert.equal(supplied.supportUrl, "https://support.example.invalid/contact");
  for (const url of [
    "javascript:alert(1)",
    "http://example.invalid",
    "https://user:password@example.invalid",
  ])
    assert.equal(
      operatorPresentation({ DOCKED_SUPPORT_URL: url }).supportUrl,
      null,
    );
  assert.equal(
    operatorPresentation({
      DOCKED_SUPPORT_EMAIL:
        "support@example.invalid\r\nBcc:other@example.invalid",
      DOCKED_ABN: "pending",
    }).supportEmail,
    null,
  );
});

test("production robots use the configured canonical origin and exclude private routes; preview stays unindexed", () => {
  const oldEnvironment = process.env.APP_ENV,
    oldSite = process.env.SITE_URL;
  try {
    process.env.APP_ENV = "production";
    process.env.SITE_URL = "https://docked.com.au";
    const production = robots();
    assert.equal(production.sitemap, "https://docked.com.au/sitemap.xml");
    assert.ok(!Array.isArray(production.rules));
    const rules = production.rules as { allow: string; disallow: string[] };
    assert.equal(rules.allow, "/");
    for (const route of [
      "/app",
      "/admin",
      "/api/",
      "/profile",
      "/feed",
      "/compose",
    ])
      assert.ok(rules.disallow.includes(route));
    process.env.APP_ENV = "preview";
    assert.equal((robots().rules as { disallow: string }).disallow, "/");
    assert.equal(manifest().start_url, "/app");
    assert.equal(
      manifest().id,
      "/home",
      "Installed PWA identity remains stable",
    );
  } finally {
    if (oldEnvironment === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = oldEnvironment;
    if (oldSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = oldSite;
  }
});
