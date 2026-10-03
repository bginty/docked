import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  trialMetric,
  trialRequestDescription,
  trialEvidenceUrl,
} from "../../src/core/provider-trial-health";
import { ProviderTrialHealthPanel } from "../../src/components/data-health-panel";
import { trialHealthFixture } from "../fixtures/provider-trial-health";
import { ScannerDataOnly } from "../../src/components/scanner-data-only";

test("missing quota and unmeasured quality never become zero or a successful trial", () => {
  for (const value of [null, undefined, NaN, Infinity, -1])
    assert.equal(trialMetric(value), "Unknown");
  assert.equal(trialMetric(0), "0");
  const absent = trialHealthFixture("unavailable");
  assert.match(trialRequestDescription(absent), /history unavailable/);
  assert.doesNotMatch(
    trialRequestDescription(absent),
    /No request is recorded/,
  );
  const html = renderToStaticMarkup(
    createElement(ProviderTrialHealthPanel, { trial: absent }),
  );
  assert.match(html, /No completed data-quality observation/);
  assert.match(html, /Provider balance remaining<\/dt><dd>Unknown/);
  assert.match(html, /Account access status<\/dt><dd>UNKNOWN/);
});

test("review approval without a fetch remains manual and leaves account entitlement unknown", () => {
  const html = renderToStaticMarkup(
    createElement(ProviderTrialHealthPanel, {
      trial: trialHealthFixture("approved"),
    }),
  );
  assert.match(html, /APPROVED_FOR_PREVIEW_TRIAL/);
  assert.match(html, /Continuous polling<\/dt><dd>Off/);
  assert.match(html, /No request is recorded in the trial ledger/);
  assert.match(html, /Provider balance remaining<\/dt><dd>Unknown/);
  assert.match(html, /Not approved by this trial/);
  assert.match(html, /NOT_TESTED/);
});

test("measured zero, reserved charges and reported charges remain distinct; unavailable reference hides a price", () => {
  const trial = trialHealthFixture("measured");
  trial.references.diagnostics[0].availabilityPrice = "999.99";
  const html = renderToStaticMarkup(
    createElement(ProviderTrialHealthPanel, { trial }),
  );
  assert.match(html, /Mapping failures<\/dt><dd>0/);
  assert.match(html, /Timestamp anomalies<\/dt><dd>Unknown/);
  assert.match(html, /Trial credits reserved<\/dt><dd>4/);
  assert.match(html, /Trial charges reported by provider<\/dt><dd>2/);
  assert.match(html, /Provider balance remaining<\/dt><dd>0/);
  assert.match(html, /Reference unavailable/);
  assert.doesNotMatch(html, /999\.99/);
});

test("data-ready dry run does not imply an approved model or populate estimates", () => {
  const html = renderToStaticMarkup(
    createElement(ScannerDataOnly, {
      data: {
        status: "MARKET_DATA_READY",
        modelStatus: "MODEL_PROBABILITY_UNAVAILABLE",
        observedAt: "2026-10-04T00:15:00Z",
        marketsEvaluated: 0,
      },
    }),
  );
  assert.match(html, /MARKET_DATA_READY/);
  assert.match(html, /MODEL_PROBABILITY_UNAVAILABLE/);
  assert.match(html, /Markets evaluated: 0/);
  assert.match(html, /creates no candidate/);
  assert.doesNotMatch(html, /Estimated EV|Docked fair odds/);
});

test("rights evidence links cannot expose provider credentials or unsafe destinations", () => {
  assert.equal(
    trialEvidenceUrl("https://the-odds-api.com/terms-and-conditions.html"),
    "https://the-odds-api.com/terms-and-conditions.html",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://api.the-odds-api.com/v4/sports?apiKey=fictional",
    "https://secret@the-odds-api.com/terms",
    "https://the-odds-api.com/terms?key=fictional",
    "https://unrelated.example/terms",
  ])
    assert.equal(trialEvidenceUrl(value), null);
});
