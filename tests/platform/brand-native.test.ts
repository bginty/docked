import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  renderOfflineShell,
  renderPublicOfflineShell,
} from "../../scripts/build-mobile-shell.mjs";

test("platform icon exports retain the supplied master and supplied legacy sizes", () => {
  for (const size of [192, 512])
    assert.deepEqual(
      readFileSync(`public/icons/docked-${size}.png`),
      readFileSync(`public/brand/icons/docked-app-icon-${size}.png`),
    );
  assert.deepEqual(
    readFileSync("android/app/src/main/res/drawable-nodpi/docked_launcher.png"),
    readFileSync("public/brand/icons/docked-app-icon-1024.png"),
  );
  const master = readFileSync("public/brand/icons/docked-app-icon-1024.png");
  assert.equal(createHash("sha256").update(master).digest("hex"), "aa8f37eec82cef4974f5d1e5561591c2f620404c0218a1f0ffaf3cd9aefa180f", "The installed S24 master must remain unchanged.");
  assert.deepEqual(
    readFileSync("public/brand/canonical/docked-master.png"),
    master,
  );
  for (const filename of ["public/icons/docked.svg", "src/app/icon.svg"]) {
    const svg = readFileSync(filename, "utf8");
    const embedded = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)?.[1];
    assert.ok(embedded, "SVG must embed the master raster.");
    assert.ok(
      Buffer.from(embedded, "base64").equals(master),
      "SVG master bytes differ.",
    );
    assert.doesNotMatch(
      svg,
      /<(?:path|polygon|rect)/,
      "No replacement mark geometry is allowed.",
    );
  }
  const logo = readFileSync("src/components/brand-logo.tsx", "utf8");
  assert.match(logo, /src=\{brandAssets.mark\}/);
  assert.doesNotMatch(
    logo,
    /markWhite|wordmarkOnDark|docked-primary|docked-mark/,
  );
});

test("adaptive and splash raster marks stay inside platform safe areas", async () => {
  for (const [name, size, radius] of [
    ["docked_mark_raster", 432, 132],
    ["docked_splash_mark_raster", 1152, 384],
  ] as const) {
    const { data, info } = await sharp(
      `android/app/src/main/res/drawable-nodpi/${name}.png`,
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    let pixels = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] === 0) continue;
        pixels++;
        assert.ok(
          Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= radius,
          `${name}: artwork must not cross the guaranteed visible circle`,
        );
      }
    assert.ok(pixels > 1000);
  }
});

test("branded native offline shell preserves hashed CSP and has no remote asset dependency", () => {
  const html = renderOfflineShell({
    mode: "hosted",
    entryUrl: "https://preview.example.test/app",
  });
  const original = readFileSync("public/brand/icons/docked-app-icon-1024.png");
  const image = html.match(
    /src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/,
  )?.[1];
  assert.ok(image);
  assert.deepEqual(Buffer.from(image, "base64"), original);
  assert.match(html, /img-src data:/);
  assert.doesNotMatch(html, /unsafe-inline|<link|<img[^>]+src="https?:/);
  for (const tag of ["style", "script"]) {
    const content = html.match(
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`),
    )?.[1];
    assert.ok(content);
    const digest = createHash("sha256").update(content).digest("base64");
    assert.ok(html.includes(`${tag}-src 'sha256-${digest}'`));
  }
  assert.match(html, /Nothing has been submitted or queued/);
  assert.match(html, /https:\/\/preview\.example\.test\/app/);
  assert.equal(
    readFileSync("public/offline.html", "utf8"),
    renderPublicOfflineShell(),
  );
});
