import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { resolveAndroidTarget } from "./android-preview-config.mjs";

// Also called by Gradle, so a direct assemblePreview cannot package stale local assets.
try {
  const target = resolveAndroidTarget({ CAPACITOR_PREVIEW_MODE: "hosted" });
  const config = JSON.parse(
    readFileSync("android/app/src/main/assets/capacitor.config.json", "utf8"),
  );
  const packaged = JSON.parse(
    readFileSync(
      "android/app/src/main/assets/public/preview-environment.json",
      "utf8",
    ),
  );
  assert.equal(config.server?.url, target.entryUrl);
  assert.equal(config.server?.cleartext, false);
  assert.equal(config.android?.webContentsDebuggingEnabled, false);
  assert.equal(config.android?.allowMixedContent, false);
  assert.equal(config.loggingBehavior, "none");
  assert.equal(config.server?.allowNavigation, undefined);
  assert.deepEqual(packaged, target.manifest);
  const allowedFiles = new Set([
    "index.html",
    "offline.html",
    "shell.css",
    "preview-environment.json",
    "cordova.js",
    "cordova_plugins.js",
  ]);
  for (const file of readdirSync("android/app/src/main/assets/public")) {
    assert.ok(allowedFiles.has(file));
    const content = readFileSync(
      `android/app/src/main/assets/public/${file}`,
      "utf8",
    );
    assert.doesNotMatch(
      content,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/[^\s"<>]+:[^\s"<>]+@/,
    );
  }
  for (const file of ["index.html", "offline.html"]) {
    const html = readFileSync(
      `android/app/src/main/assets/public/${file}`,
      "utf8",
    );
    assert.ok(html.includes(target.entryUrl));
    assert.doesNotMatch(
      html,
      /localhost:3000|ADB|Connect the reviewed preview|reverse port/i,
    );
  }
  console.log(
    "Verified exact HTTPS preview assets; inspection and cleartext disabled.",
  );
} catch {
  console.error(
    "Hosted preview refused: verify the approved manifest and synchronise matching HTTPS assets.",
  );
  process.exitCode = 1;
}
