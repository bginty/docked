import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeCard } from "../../src/components/edge-card";
import { CommunityEdgeCard } from "../../src/components/community-performance";
import {
  EdgeBoardHeader,
  edgeBoardHref,
} from "../../src/components/edge-board-header";
import { referenceTip, referenceReview } from "../fixtures/reference-ui";
import type { CommunityEdge } from "../../src/core/community-edge";

// Fictional display fixtures only: never imported by routes or persisted.
const now = Date.parse("2026-10-03T12:01:15Z");
const text = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("compact official card keeps current reference, captured benchmark and minimum distinct", () => {
  const original = JSON.stringify(referenceTip);
  const html = renderToStaticMarkup(
    createElement(EdgeCard, { tip: referenceTip, now, compact: true }),
  );
  const visible = text(html);
  assert.match(visible, /TAKE 1\.94\+/);
  assert.match(visible, /CURRENT MARKET 2\.02/);
  assert.match(visible, /Publication market reference: 2\.08 decimal/);
  assert.match(visible, /Estimated EV at publication 12\.32%/);
  assert.match(visible, /UNVALIDATED/);
  assert.doesNotMatch(visible, /9\.99|Legacy field must not be displayed/);
  assert.equal(JSON.stringify(referenceTip), original);
});

test("compact official card fails closed for missing or aged current data; full detail stays available", () => {
  const missing = renderToStaticMarkup(
    createElement(EdgeCard, {
      tip: {
        ...referenceTip,
        current_market_reference: null,
        display_status: "suspended",
      },
      now,
      compact: true,
    }),
  );
  assert.match(text(missing), /CURRENT MARKET Unavailable/);
  assert.match(text(missing), /SUSPENDED/);
  assert.match(text(missing), /Archived record; not an active instruction/);
  const stale = renderToStaticMarkup(
    createElement(EdgeCard, {
      tip: referenceTip,
      now: now + 240000,
      compact: true,
    }),
  );
  assert.match(text(stale), /SUSPENDED/);
  const detail = renderToStaticMarkup(
    createElement(EdgeCard, {
      tip: referenceTip,
      now,
      compact: true,
      detail: true,
    }),
  );
  assert.match(detail, /Why it qualified at publication/);
  assert.doesNotMatch(detail, /compact-edge-card/);
});

test("compact community record retains losses, corrections and captured odds when a personal price differs", () => {
  const edge: CommunityEdge = {
    ...referenceReview,
    id: "00000000-0000-4000-8000-000000000777",
    profileId: "00000000-0000-4000-8000-000000000888",
    handle: "record-hidden",
    displayName: "Community member",
    submittedAt: "2026-10-03T12:01:20Z",
    units: "1.00",
    result: "LOST",
    settledAt: "2026-10-03T18:00:00Z",
    corrections: 2,
    integrity: "REVIEW",
    interactionsAllowed: false,
    personalPrice: "5.50",
    personalBookmaker: "DEMO personal",
    personalPromotional: true,
  };
  const original = JSON.stringify(edge);
  const html = renderToStaticMarkup(
    createElement(CommunityEdgeCard, { edge, compact: true }),
  );
  const visible = text(html);
  assert.match(visible, /LOST/);
  assert.match(visible, /Submission market reference 2\.02/);
  assert.match(visible, /Fixed benchmark 1\.00 unit/);
  assert.match(
    visible,
    /5\.50 · promotional.*Unverified; excluded from grading/,
  );
  assert.match(visible, /INTEGRITY REVIEW · Not ranked/);
  assert.match(visible, /2 visible corrections/);
  assert.doesNotMatch(html, /href="\/profile\//);
  assert.equal(JSON.stringify(edge), original);
});

test("edge presentation filters preserve source and safely encode competition and cursor", () => {
  const target = new URL(
    edgeBoardHref(
      { sport: "football", competition: "DEMO&A=1" },
      "following",
      "recent",
      { cursor: "2026-10-03T12:00:00Z:a+b" },
    ),
    "https://example.invalid",
  );
  assert.equal(target.searchParams.get("tab"), "following");
  assert.equal(target.searchParams.get("view"), "recent");
  assert.equal(target.searchParams.get("competition"), "DEMO&A=1");
  assert.equal(target.searchParams.get("cursor"), "2026-10-03T12:00:00Z:a+b");
  assert.equal(target.searchParams.has("A"), false);
  const html = renderToStaticMarkup(
    createElement(EdgeBoardHeader, {
      query: {},
      tab: "docked",
      view: "featured",
      status: { strategy: false, feed: false, publication: false },
    }),
  );
  assert.match(text(html), /Research validation pending/);
  assert.match(text(html), /New publications are paused/);
  assert.match(text(html), /Featured Upcoming Recent/);
  assert.match(text(html), /Docked Community Following Settled/);
});
