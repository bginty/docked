import assert from "node:assert/strict";
import sharp from "sharp";
import { expect, type APIRequestContext, type Browser } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

/** Isolated local users; real API, MFA moderation and private image retrieval. */
export async function verifySocialAvatars(
  contexts: APIRequestContext[],
  browser: Browser,
  origin: string,
  root = "docs/qa/social-visual-preview",
) {
  assert.equal(origin, "http://127.0.0.1:3033");
  const post = async (i: number, data: unknown) =>
    contexts[i].post("/api/community", { data });
  const picture = await sharp({
    create: { width: 480, height: 320, channels: 3, background: "#1769b7" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="480" height="320"><circle cx="240" cy="110" r="60" fill="#e5c59e"/><ellipse cx="240" cy="290" rx="115" ry="100" fill="#12213a"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  const upload = await contexts[1].post("/api/community", {
    multipart: {
      action: "avatar_upload",
      file: {
        name: "local-avatar.png",
        mimeType: "image/png",
        buffer: picture,
      },
      alt: "Isolated illustrated QA avatar",
      crop: JSON.stringify({ x: 0.5, y: 0.5, zoom: 1 }),
    },
  });
  assert.equal(upload.status(), 200, await upload.text());
  const media = (await upload.json()).media;
  const target = "/api/community?view=media&id=" + media.id + "&variant=avatar";
  if (media.status !== "approved") {
    assert.notEqual((await contexts[2].get(target)).status(), 200);
    assert.notEqual(
      (await post(1, { action: "avatar", mediaId: media.id })).status(),
      200,
    );
  }
  const approval = {
    action: "moderate",
    targetType: "media",
    targetId: media.id,
    decision: "approve",
    reason: "Reviewed synthetic local avatar fixture only",
  };
  assert.notEqual((await post(1, approval)).status(), 200);
  const approved = await post(3, approval);
  assert.equal(approved.status(), 200, await approved.text());
  assert.notEqual(
    (await post(2, { action: "avatar", mediaId: media.id })).status(),
    200,
  );
  assert.equal(
    (await post(1, { action: "avatar", mediaId: media.id })).status(),
    200,
  );
  const image = await contexts[2].get(target);
  assert.equal(image.status(), 200);
  assert.match(image.headers()["cache-control"], /no-store/);
  const metadata = await sharp(await image.body()).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.exif, undefined);
  assert.notEqual((await fetch(origin + target)).status, 200);
  const profile = await contexts[1].get("/api/community?view=profile");
  assert.equal(profile.status(), 200);
  assert.match((await profile.json()).profile.avatarUrl, new RegExp(media.id));
  const context = await browser.newContext({
    storageState: await contexts[1].storageState(),
    viewport: { width: 412, height: 815 },
  });
  const page = await context.newPage();
  try {
    await page.goto(origin + "/profile?tab=about", {
      // The authenticated local harness starts a cold Next development server.
      // Compilation is not an avatar-network timeout or a hosted performance claim.
      timeout: 120000,
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".profile-top .member-photo img")).toBeVisible({
      timeout: 30000,
    });
    await page.reload();
    await expect(page.locator(".profile-top .member-photo img")).toBeVisible({
      timeout: 30000,
    });
    await page.locator("#edit").scrollIntoViewIfNeeded();
    await page.getByLabel("Choose a photo").setInputFiles({
      name: "crop-fixture.png",
      mimeType: "image/png",
      buffer: picture,
    });
    await expect(page.getByLabel("Profile photo crop preview")).toBeVisible({
      timeout: 30000,
    });
    await page
      .getByRole("slider", { name: "Zoom", exact: true })
      .press("ArrowRight");
    await page
      .getByRole("slider", { name: "Horizontal position" })
      .press("ArrowRight");
    await mkdir(root, { recursive: true });
    await page
      .getByLabel("Profile photo crop preview")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${root}/avatar-crop-mobile.png`,
    });
    await page.getByRole("button", { name: "Cancel crop" }).click();
    await page.getByRole("button", { name: "Remove profile picture" }).click();
    await expect(page.getByText("Profile picture removed.")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator(".profile-top .member-photo img")).toHaveCount(
      0,
      { timeout: 30000 },
    );
    await page
      .getByRole("button", {
        name: "Use photo: Isolated illustrated QA avatar",
      })
      .click();
    await expect(page.getByText("Profile picture saved.")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator(".profile-top .member-photo img")).toBeVisible({
      timeout: 30000,
    });
    await page.route("**/api/community?view=media&**", (r) => r.abort());
    await page.reload();
    await page.locator(".profile-top").scrollIntoViewIfNeeded();
    await expect(page.locator(".profile-top .member-photo > span")).toHaveText(
      "L",
    );
  } catch (error) {
    // Failed diagnostics must not replace the actual acceptance failure, e.g.
    // when navigation fails before the editor exists or an artifact is locked.
    await Promise.allSettled([
      page.screenshot({
        path: `${root}/avatar-failed.png`,
        fullPage: true,
        timeout: 10000,
      }),
      page
        .locator(".avatar-editor")
        .innerText({ timeout: 5000 })
        .then((body) => writeFile("tmp/avatar-failed.txt", body)),
    ]);
    throw error;
  } finally {
    await context.close();
  }
  return [
    "Private avatar upload/crop, pending approval enforcement, real owner MFA moderation, cross-account selection denied, authenticated no-store 256px retrieval, anonymous denial",
    "Mobile crop preview and reposition, save/remove/reselect/reload persistence, broken-photo initials fallback",
  ];
}
