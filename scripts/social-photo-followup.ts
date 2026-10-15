import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { request, chromium, expect } from "@playwright/test";
import { captureSocialUpgrade } from "./social-upgrade-browser";
async function main() {
  const origin = "http://127.0.0.1:3033";
  const qa = JSON.parse(
    await readFile("tmp/marketplace-auth/fixtures.private.json", "utf8"),
  );
  const client = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    const login = await client.post("/api/auth", {
      data: {
        action: "login",
        email: qa.users[1].email,
        password: qa.password,
        app: true,
      },
    });
    assert.equal(login.status(), 200);
    const data = await (await client.get("/api/community?view=profile")).json();
    assert.ok(data.profile.avatarUrl, "Avatar persists after fresh sign-in");
    const browser = await chromium.launch({ channel: "msedge" });
    try {
      const context = await browser.newContext({
        storageState: await client.storageState(),
        viewport: { width: 1440, height: 960 },
      });
      const page = await context.newPage();
      await page.goto(origin + "/profile?tab=about", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator(".profile-top .member-photo img")).toBeVisible({
        timeout: 30000,
      });
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLImageElement>(
            ".profile-top .member-photo img",
          )?.naturalWidth,
      );
      await page.screenshot({
        path: "docs/qa/social-visual-preview/profile-photo-desktop.png",
      });
      await page.setViewportSize({ width: 412, height: 815 });
      await page.screenshot({
        path: "docs/qa/social-visual-preview/profile-photo-mobile.png",
      });
      await context.close();
      await captureSocialUpgrade(
        browser,
        [client, client],
        origin,
        "docs/qa/social-visual-preview",
      );
    } finally {
      await browser.close();
    }
    const denied = await request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
    try {
      const r = await denied.post("/api/community", {
        multipart: {
          action: "avatar_upload",
          alt: "Anonymous forbidden photo",
          crop: '{"x":0.5,"y":0.5,"zoom":1}',
          file: {
            name: "invalid.png",
            mimeType: "image/png",
            buffer: Buffer.from("invalid"),
          },
        },
      });
      assert.notEqual(r.status(), 200);
    } finally {
      await denied.dispose();
    }
    const invalid = await client.post("/api/community", {
      multipart: {
        action: "avatar_upload",
        alt: "Malformed local image fixture",
        crop: '{"x":0.5,"y":0.5,"zoom":1}',
        file: {
          name: "invalid.png",
          mimeType: "image/png",
          buffer: Buffer.from("<svg></svg>"),
        },
      },
    });
    assert.notEqual(invalid.status(), 200);
    const unchanged = await (
      await client.get("/api/community?view=profile")
    ).json();
    assert.equal(unchanged.profile.avatarUrl, data.profile.avatarUrl);
    const report = {
      at: new Date().toISOString(),
      passed: true,
      scope: "Isolated local Auth and real HTTP",
      checks: [
        "Fresh independent sign-in retains saved avatar",
        "Profile avatar visible at desktop and mobile",
        "Anonymous upload denied",
        "Disguised SVG upload denied without changing avatar",
      ],
    };
    await writeFile(
      "docs/qa/social-visual-preview/photo-followup.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await client.dispose();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Local photo verification failed",
  );
  process.exitCode = 1;
});
