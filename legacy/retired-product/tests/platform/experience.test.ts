import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeCard } from "../../src/components/edge-card";
import { NoEdge } from "../../src/components/no-edge";
import {
  sourceAge,
  timeBoundStatus,
  type TipPresentation,
} from "../../src/core/tip-presentation";
import {
  articleStructuredData,
  educationalDrafts,
  editorialVisible,
  safeJsonLd,
} from "../../src/content/editorial";
import { editorialRead } from "../../src/core/editorial-access";
const at = "2026-10-02T06:00:00Z";
const tip: TipPresentation = {
  id: "fixture-only",
  participants: ["FICTIONAL A", "FICTIONAL B"],
  selection: "FICTIONAL A",
  start_at: "2026-10-02T08:00:00Z",
  odds: "2.00",
  minimum_odds: "1.88",
  probability: "0.55",
  estimated_ev: "0.10",
  market_rules: {
    market: "nba_moneyline",
    settlement: "full_game_including_overtime",
  },
  publication_payload: {
    fairOdds: "1.8182",
    offer: { bookmaker: "FICTIONAL BOOK", sourceAt: at },
  },
  result: "pending",
  display_status: "suspended",
  current_odds: null,
  current_source_at: null,
  current_observed_at: null,
};
test("a missing current quote never falls back to publication odds or an active claim", () => {
  const html = renderToStaticMarkup(
    createElement(EdgeCard, { tip, now: Date.parse(at), detail: true }),
  );
  assert.match(html, /Current observed price<\/span><strong>Unavailable/);
  assert.match(html, /Source time unavailable/);
  assert.match(html, /SUSPENDED/);
  assert.match(html, /Publication odds/);
  assert.match(html, /Estimated EV is not guaranteed profit/);
  assert.doesNotMatch(html, />ACTIVE</);
});
test("edge card distinguishes measured current odds from the immutable publication and shows local time", () => {
  const html = renderToStaticMarkup(
    createElement(EdgeCard, {
      tip: {
        ...tip,
        display_status: "active",
        current_odds: "1.95",
        current_source_at: at,
        current_observed_at: at,
      },
      timezone: "America/New_York",
      now: Date.parse(at) + 60000,
      detail: true,
    }),
  );
  assert.match(html, /Current observed price<\/span><strong>1.95/);
  assert.match(html, /2.00<!-- --> decimal|2.00 decimal/);
  assert.match(html, /America\/New_York/);
  assert.match(html, /1 minute old/);
});
test("no-edge and unavailable-feed experiences do not invent coverage, events or completed results", () => {
  const props = {
    state: { code: "no_edge", title: "old", detail: "old" },
    monitoring: { available: false, markets: [], events: [] },
    latest: educationalDrafts()[0],
  };
  const noEdge = renderToStaticMarkup(createElement(NoEdge, props));
  assert.match(noEdge, /No qualifying edge right now\./);
  assert.match(noEdge, /No verified monitoring coverage/);
  assert.match(noEdge, /No completed live publications/);
  assert.match(noEdge, /Weekly performance/);
  const unavailable = renderToStaticMarkup(
    createElement(NoEdge, {
      ...props,
      state: {
        code: "feed_unavailable",
        title: "Data feed unavailable",
        detail: "No scan was verified.",
      },
    }),
  );
  assert.match(unavailable, /Data feed unavailable/);
  assert.doesNotMatch(unavailable, /No qualifying edge right now/);
});
test("an already open card becomes suspended or expired with time and never promotes a blocked status", () => {
  const now = Date.parse(at);
  assert.equal(
    timeBoundStatus("active", at, "2026-10-02T08:00:00Z", now),
    "active",
  );
  assert.equal(
    timeBoundStatus("active", at, "2026-10-02T08:00:00Z", now + 181000),
    "suspended",
  );
  assert.equal(
    timeBoundStatus("active", at, "2026-10-02T06:10:00Z", now),
    "expired",
  );
  assert.equal(
    timeBoundStatus("suspended", at, "2026-10-02T08:00:00Z", now),
    "suspended",
  );
});
test("CMS visibility rejects draft, withdrawn, expired and future-dated publications", () => {
  const base = { status: "published", publishedAt: at, expiresAt: null },
    now = Date.parse(at) + 1000;
  assert.equal(editorialVisible(base, now), true);
  for (const status of ["draft", "archived", "scheduled", "approved"])
    assert.equal(editorialVisible({ ...base, status }, now), false);
  assert.equal(editorialVisible({ ...base, expiresAt: at }, now), false);
  assert.equal(
    editorialVisible({ ...base, publishedAt: "2027-01-01" }, now),
    false,
  );
  assert.equal(editorialVisible({ ...base, publishedAt: null }, now), false);
});
test("a CMS outage stays distinguishable from a missing article and cannot disclose the backend error", async () => {
  assert.equal(await editorialRead(async () => null), null);
  await assert.rejects(
    editorialRead(async () => {
      throw new Error(
        "postgres://user:secret@private-host / unpublished content",
      );
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        "Editorial service temporarily unavailable. Please try again later.",
      );
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(
        error.stack ?? "",
        /private-host|unpublished content/,
      );
      return true;
    },
  );
});
test("educational drafts do not claim published Article provenance; structured data cannot terminate script", () => {
  const draft = educationalDrafts()[0],
    data = articleStructuredData(draft, "https://preview.example");
  assert.equal(data["@type"], "WebPage");
  assert.equal(data.datePublished, undefined);
  const real = articleStructuredData(
    {
      ...draft,
      published: true,
      publishedAt: at,
      corrections: [{ at, reason: "Corrected arithmetic" }],
    },
    "https://preview.example",
  );
  assert.equal(real["@type"], "Article");
  assert.equal(real.datePublished, at);
  assert.equal(real.correction?.length, 1);
  assert.ok(
    !safeJsonLd({ title: "</script><script>alert(1)</script>" }).includes("<"),
  );
  assert.equal(
    sourceAge("2027-01-01", Date.parse(at)),
    "Source time unverified",
  );
});
