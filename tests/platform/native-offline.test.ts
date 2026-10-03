import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { renderOfflineShell } from "../../scripts/build-mobile-shell.mjs";
import { resolveAndroidTarget } from "../../scripts/android-preview-config.mjs";

test("native offline fallback needs no network subresources and has exact CSP hashes", () => {
  const html = renderOfflineShell(
    resolveAndroidTarget({ CAPACITOR_PREVIEW_MODE: "local" }),
  );
  assert.doesNotMatch(html, /<(?:script|link|img)[^>]+(?:src|href)=/i);
  for (const tag of ["script", "style"]) {
    const content = html.match(
      new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`),
    )?.[1];
    assert.ok(content);
    const hash = createHash("sha256").update(content).digest("base64");
    assert.ok(html.includes(`${tag}-src 'sha256-${hash}'`));
  }
  assert.match(html, /http:\/\/localhost:3000\/home/);
  assert.doesNotMatch(
    html,
    /unsafe-inline|fetch\(|localStorage|sessionStorage/,
  );
});

test("bundled shell cannot initiate an unconfigured connection", () => {
  const html = renderOfflineShell(resolveAndroidTarget({}));
  assert.match(html, /const retryUrl = null/);
  assert.match(html, /type="button" disabled/);
  assert.doesNotMatch(html, /localhost:3000|https:\/\//);
});
