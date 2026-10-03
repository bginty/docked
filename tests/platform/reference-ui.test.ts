import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("reference cards distinguish current availability, fair estimate and immutable threshold; missing reference never falls back to bookmaker odds", () => {
  const html = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-reference-ui.ts"],
      { encoding: "utf8" },
    ),
  );
  assert.match(html.ready, /TAKE 1\.94\+/);
  assert.match(html.ready, /CURRENT MARKET/);
  assert.match(html.ready, />2\.02</);
  assert.match(html.ready, /Docked fair price/);
  assert.match(html.ready, /1\.8519/);
  assert.match(html.ready, /Market reference at publication/);
  assert.match(html.ready, /2\.08 decimal/);
  assert.match(html.ready, /UNVALIDATED/);
  assert.doesNotMatch(html.ready, /9\.99|Legacy field must not be displayed/);
  assert.match(html.missing, /Unavailable/);
  assert.doesNotMatch(html.missing, /9\.99/);
  assert.match(html.legacy, /Original bookmaker methodology/);
  assert.match(html.legacy, /Legacy field must not be displayed/);
  assert.doesNotMatch(html.legacy, /CURRENT MARKET|TAKE 1\.94/);
});
