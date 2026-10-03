import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

test("native offline fallback needs no network subresources and has exact CSP hashes", () => {
  const html = readFileSync("mobile/www/offline.html", "utf8");
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
