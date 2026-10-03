import { test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  account,
  api,
  check,
  expect,
  fixture,
  login,
  phase,
  privateWrite,
  state,
} from "./helpers";
async function profile(
  page: import("@playwright/test").Page,
  label: "memberA" | "memberB",
) {
  const a = await account(label);
  await page.goto("/profile");
  const form = page.locator("#edit form").first();
  await form.locator('[name="handle"]').fill(a.handle);
  await form
    .locator('[name="displayName"]')
    .fill(`Preview acceptance ${label}`);
  await form
    .locator('[name="bio"]')
    .fill(
      "Isolated hosted acceptance account. No sporting or performance claims.",
    );
  await form.locator('[name="visibility"]').selectOption("members");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/community") && r.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Save profile" }).click();
  check((await response).status() === 200, "community-profile-save");
}
test("real social interactions consent private visibility and restricted API denial", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  const f = await fixture();
  check(f.capabilities.community, "root-reviewed-community-scope");
  await login(page, "memberA");
  await profile(page, "memberA");
  await page.goto("/compose");
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  const body = `PREVIEW ACCEPTANCE ${f.runId}: discussion test only; no sporting price, result or performance claim.`;
  await page.getByLabel("Your post", { exact: true }).fill(body);
  const posted = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/community") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish social post" }).click();
  const postResponse = await posted,
    postData = await postResponse.json();
  check(
    postResponse.status() === 200 &&
      typeof (postData.id ?? postData.post?.id) === "string",
    "social-post-created",
  );
  const postId = postData.id ?? postData.post.id;
  const current = await state();
  current.postId = postId;
  await privateWrite("state.json", current);
  const peer = await browser.newContext(),
    peerPage = await peer.newPage();
  await login(peerPage, "memberB");
  await profile(peerPage, "memberB");
  await peerPage.goto(`/community/posts/${postId}`);
  const card = peerPage.locator(".social-card").filter({ hasText: body });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: /reactions$/ }).click();
  await expect(
    card.getByRole("button", { name: /reactions$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Saved", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /comments$/ }).click();
  await card
    .getByLabel("Add a comment", { exact: true })
    .fill("Preview acceptance reply; no sporting claim.");
  await card.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    card.getByText("Preview acceptance reply; no sporting claim.", {
      exact: true,
    }),
  ).toBeVisible();
  await peerPage.goto(`/profile/${f.accounts.memberA.handle}`);
  await peerPage.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    peerPage.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  const consent = peerPage.getByRole("checkbox", {
    name: /Notify me about this member/,
  });
  await expect(consent).not.toBeChecked();
  await consent.click();
  await expect(consent).toBeChecked();
  await peerPage.goto("/notifications");
  await expect(
    peerPage.getByRole("checkbox", {
      name: "Future deals and marketing (separate opt-in)",
    }),
  ).not.toBeChecked();
  await peerPage.locator('[name="followedMembers"]').check();
  await peerPage.locator('[name="inApp"]').check();
  await peerPage
    .getByRole("button", { name: "Save notification preferences" })
    .click();
  await expect(peerPage.getByRole("status")).toContainText(
    "No external email or push is enabled",
  );
  await page.goto("/profile");
  const own = page.locator("#edit form").first();
  await own.locator('[name="visibility"]').selectOption("private");
  await own.getByRole("button", { name: "Save profile" }).click();
  await expect(own.getByRole("status")).toContainText("Profile saved");
  const hidden = await api(
    peerPage,
    `/api/community?view=profile&handle=${f.accounts.memberA.handle}`,
  );
  check(!hidden.json?.profile, "private-profile-withheld-cross-user");
  const ownExport = await api(
    peerPage,
    `/api/member?userId=${current.accounts.memberA!.id}`,
  );
  check(
    ownExport.json?.profile?.id === (await state()).accounts.memberB?.id,
    "cross-user-export-is-own-only",
  );
  check(
    (
      await api(peerPage, "/api/admin/benefits", {
        action: "deal_draft",
        input: {},
      })
    ).status === 403,
    "member-privilege-escalation-denied",
  );
  await own.locator('[name="visibility"]').selectOption("members");
  const restored = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/community") && r.request().method() === "POST",
  );
  await own.getByRole("button", { name: "Save profile" }).click();
  check((await restored).status() === 200, "public-member-profile-restored");
  phase("social-security-boundaries");
  const ownerProfile = (await api(page, "/api/community?view=profile")).json
    ?.profile;
  const peerProfile = (await api(peerPage, "/api/community?view=profile")).json
    ?.profile;
  check(
    ownerProfile?.id && peerProfile?.id,
    "actual-social-profile-identities",
  );
  const post = (
    await api(peerPage, `/api/community?view=post&id=${postId}`)
  ).json?.posts?.find((p: { id: string }) => p.id === postId);
  const comment = post?.comments?.find(
    (c: { author: { id: string } }) => c.author.id === peerProfile.id,
  );
  check(comment?.id, "actual-peer-comment-identity");
  check(
    (await api(peerPage, "/api/community", { action: "delete_post", postId }))
      .status === 403,
    "cross-user-post-delete-denied",
  );
  check(
    (
      await api(page, "/api/community", {
        action: "delete_comment",
        commentId: comment.id,
      })
    ).status === 403,
    "cross-user-comment-delete-denied",
  );
  for (const kind of ["official", "edge"]) {
    check(
      (
        await api(peerPage, "/api/community", {
          action: "post",
          kind,
          body: "Preview unauthorized classification probe; must never be published.",
          idempotencyKey: randomUUID(),
        })
      ).status === 403,
      "official-or-verified-post-spoof-denied",
    );
  }
  const forged = await api(peerPage, "/api/community-edges", {
    action: "submit",
    odds: 2,
    verified: true,
    selection: "UNAUTHORIZED_TEST",
    confirmedPermanent: true,
    idempotencyKey: randomUUID(),
  });
  check(
    forged.status >= 400 && !forged.json?.ok,
    "typed-odds-verified-edge-spoof-denied",
  );
  await peerPage.goto(`/profile/${f.accounts.memberA.handle}`);
  await peerPage.getByText("Member controls", { exact: true }).click();
  await peerPage.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(
    peerPage.getByRole("button", { name: "Unmute", exact: true }),
  ).toBeVisible();
  check(
    !(await api(peerPage, "/api/community?tab=latest")).json?.posts?.some(
      (p: { id: string }) => p.id === postId,
    ),
    "muted-author-absent-from-feed",
  );
  await peerPage.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect(
    peerPage.getByRole("button", { name: "Mute", exact: true }),
  ).toBeVisible();
  const blocked = peerPage.waitForResponse(
    (r) =>
      r.url().endsWith("/api/community") && r.request().method() === "POST",
  );
  await peerPage.getByRole("button", { name: "Block", exact: true }).click();
  check((await blocked).status() === 200, "block-saved");
  check(
    !(
      await api(
        peerPage,
        `/api/community?view=profile&handle=${f.accounts.memberA.handle}`,
      )
    ).json?.profile,
    "blocked-peer-hidden",
  );
  check(
    !(
      await api(
        page,
        `/api/community?view=profile&handle=${f.accounts.memberB.handle}`,
      )
    ).json?.profile,
    "block-is-bilateral",
  );
  check(
    (
      await api(peerPage, "/api/community", {
        action: "comment",
        postId,
        body: "Blocked interaction must not be stored.",
        idempotencyKey: randomUUID(),
      })
    ).status === 403,
    "blocked-comment-denied",
  );
  check(
    (
      await api(page, "/api/community", {
        action: "follow",
        profileId: peerProfile.id,
        enabled: true,
      })
    ).status === 403,
    "reverse-blocked-follow-denied",
  );
  check(
    (
      await api(peerPage, "/api/community", {
        action: "block",
        profileId: ownerProfile.id,
        enabled: false,
      })
    ).status === 200,
    "block-restored-after-test",
  );
  phase("safe-image-quarantine");
  await page.goto("/profile");
  await page.getByText("Upload an avatar for review", { exact: true }).click();
  const image = await sharp({
    create: { width: 144, height: 96, channels: 3, background: "#187b79" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Avatar image", { exact: true })
    .setInputFiles({
      name: "preview-colour-swatch.png",
      mimeType: "image/png",
      buffer: image,
    });
  await page
    .getByLabel("Image description", { exact: true })
    .fill(`Preview colour swatch ${f.runId}; no sporting evidence.`);
  const uploaded = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/community") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Upload for moderation", exact: true })
    .click();
  const uploadResponse = await uploaded;
  const upload = await uploadResponse.json();
  check(
    uploadResponse.status() === 200 &&
      upload.media?.status === "quarantine" &&
      upload.media?.url === null,
    "image-quarantined-without-public-url",
  );
  const mediaId = upload.media?.id;
  check(typeof mediaId === "string", "quarantined-media-identity");
  const mediaState = await state();
  mediaState.mediaId = mediaId;
  await privateWrite("state.json", mediaState);
  check(
    (await api(page, `/api/community?view=media&id=${mediaId}`)).status === 403,
    "quarantine-unavailable-to-owner",
  );
  check(
    (await api(peerPage, `/api/community?view=media&id=${mediaId}`)).status ===
      403,
    "quarantine-unavailable-to-peer",
  );
  check(
    (
      await api(page, "/api/community", {
        action: "post",
        kind: "discussion",
        body: "Quarantined media attachment probe; must not publish.",
        mediaIds: [mediaId],
        idempotencyKey: randomUUID(),
      })
    ).status === 403,
    "quarantined-media-cannot-attach",
  );
  await peer.close();
  const restricted = await browser.newContext(),
    restrictedPage = await restricted.newPage();
  await login(restrictedPage, "restricted");
  const denied = await api(restrictedPage, "/api/community", {
    action: "post",
    kind: "discussion",
    body: "Preview restricted-access probe; must not be stored.",
    idempotencyKey: randomUUID(),
  });
  check(denied.status === 403, "restricted-region-api-denied");
  await restrictedPage.goto("/compose");
  await expect(
    restrictedPage.getByRole("button", { name: "Publish social post" }),
  ).toHaveCount(0);
  await restricted.close();
});
