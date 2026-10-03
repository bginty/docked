import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderOfflineShell } from "../../scripts/build-mobile-shell.mjs";
import { resolveAndroidTarget } from "../../scripts/android-preview-config.mjs";

test("native offline fallback needs no network subresources and has exact CSP hashes", () => {
  const html = renderOfflineShell(
    resolveAndroidTarget({ CAPACITOR_PREVIEW_MODE: "local" }),
  );
  const approvedImage = `data:image/png;base64,${readFileSync("public/brand/icons/docked-app-icon-1024.png").toString("base64")}`;
  const resourceTags = [...html.matchAll(/<(script|link|img)\b[^>]*>/gi)];
  let approvedImages = 0;
  for (const tag of resourceTags) {
    const attributes = [
      ...tag[0].matchAll(
        /\b(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      ),
    ];
    if (tag[1].toLowerCase() === "img") {
      assert.equal(
        attributes.length,
        1,
        "Offline image must have exactly one source attribute.",
      );
      const source = attributes[0];
      assert.equal(
        source[1].toLowerCase(),
        "src",
        "Offline image must use a src attribute.",
      );
      assert.ok(
        (source[2] ?? source[3] ?? source[4]) === approvedImage,
        "Offline image must exactly match the approved embedded PNG bytes.",
      );
      approvedImages++;
    } else {
      assert.equal(
        attributes.length,
        0,
        "Offline scripts and links cannot request subresources.",
      );
    }
  }
  assert.equal(
    approvedImages,
    1,
    "Offline shell must include one approved embedded logo.",
  );
  for (const tag of ["script", "style"]) {
    const content = html.match(
      new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`),
    )?.[1];
    assert.ok(content, `Offline ${tag} content must exist.`);
    assert.equal(content.includes("\r"), false, `Offline ${tag} must use the browser's normalised LF bytes before hashing.`);
    const hash = createHash("sha256").update(content).digest("base64");
    assert.ok(
      html.includes(`${tag}-src 'sha256-${hash}'`),
      `Offline ${tag} hash must match its CSP.`,
    );
  }
  assert.ok(
    html.includes("http://localhost:3000/app"),
    "Local shell retry must use its explicit configured target.",
  );
  assert.ok(
    !/unsafe-inline|fetch\(|localStorage|sessionStorage/.test(html),
    "Offline shell must retain its no-storage and hashed-script controls.",
  );
});

test("bundled shell cannot initiate an unconfigured connection", () => {
  const html = renderOfflineShell(resolveAndroidTarget({}));
  assert.ok(
    html.includes("const retryUrl = null"),
    "Bundled shell has no connection target.",
  );
  assert.ok(
    html.includes('type="button" disabled'),
    "Unconfigured retry must remain disabled.",
  );
  assert.ok(
    !/localhost:3000|https:\/\//.test(html),
    "Bundled shell cannot acquire a remote target.",
  );
});
