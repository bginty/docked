import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewedOpenFootballSources,
  OPENFOOTBALL_REVIEWED_REVISION,
} from "../../src/core/research-source-catalogue";
import { sourceUseDecision } from "../../src/core/research-engine";

test("Reviewed OpenFootball catalogue has pinned, evidenced, bounded CC0 research scopes", () => {
  const sources = reviewedOpenFootballSources();
  assert.equal(sources.length, 2);
  for (const source of sources) {
    assert.ok(source.endpoint.includes(OPENFOOTBALL_REVIEWED_REVISION));
    assert.equal(source.etiquette.maximumRequestsPerDay, 1);
    assert.equal(
      sourceUseDecision(source, {
        purpose: "AUTOMATED_FETCH",
        asOfTime: "2026-10-04T03:00:00Z",
        jurisdiction: "AU:NSW",
      }).allowed,
      true,
    );
    assert.equal(
      sourceUseDecision(source, {
        purpose: "AUTOMATED_FETCH",
        asOfTime: "2026-11-04T00:00:00Z",
        jurisdiction: "AU:NSW",
      }).allowed,
      false,
    );
    assert.equal(
      sourceUseDecision(source, {
        purpose: "DISPLAY",
        asOfTime: "2026-10-04T03:00:00Z",
        jurisdiction: "AU:VIC",
      }).allowed,
      false,
    );
  }
});
