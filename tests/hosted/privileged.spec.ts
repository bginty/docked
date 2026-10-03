import { test } from "@playwright/test";
import {
  api,
  check,
  expect,
  fixture,
  login,
  mfa,
  state,
  phase,
} from "./helpers";
for (const label of ["analyst", "editor", "admin", "auditor"] as const)
  test(`genuine MFA and staff boundary: ${label}`, async ({ page }) => {
    test.setTimeout(480000);
    const f = await fixture();
    check(f.capabilities.privileged, "root-granted-actual-user-roles");
    await login(page, label);
    await page.goto("/profile");
    const own = page.locator("#edit form").first();
    await own.locator('[name="handle"]').fill(f.accounts[label].handle);
    await own
      .locator('[name="displayName"]')
      .fill(
        `Preview reviewer ${["analyst", "editor", "admin", "auditor"].indexOf(label) + 1}`,
      );
    await own
      .locator('[name="bio"]')
      .fill("Isolated acceptance review account; no sporting claims.");
    await own.locator('[name="visibility"]').selectOption("members");
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/community") && r.request().method() === "POST",
    );
    await own.getByRole("button", { name: "Save profile" }).click();
    check(
      (await created).status() === 200,
      "actual-staff-social-profile-created",
    );
    check(
      (await api(page, "/api/admin/benefits")).status === 403,
      "aal1-staff-denied",
    );
    await mfa(page, label);
    await expect(
      page.getByRole("heading", {
        name: "Evidence. Controls. Accountability.",
      }),
    ).toBeVisible();
    const read = await api(page, "/api/admin/benefits");
    check(
      read.status === (["admin", "auditor"].includes(label) ? 200 : 403),
      "staff-read-matrix",
    );
    if (label !== "admin")
      check(
        (
          await api(page, "/api/admin/benefits", {
            action: "deal_draft",
            input: {},
          })
        ).status === 403,
        "read-role-cannot-write",
      );
    await page.goto("/admin/community/reports");
    if (label === "analyst")
      await expect(
        page.getByRole("heading", { name: "Verified staff access required." }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "Verified staff access required." }),
      ).toHaveCount(0);
    const mediaId = (await state()).mediaId;
    check(mediaId, "real-quarantine-created-before-staff-review");
    if (label === "analyst")
      check(
        (await api(page, `/api/community?view=media&id=${mediaId}`)).status ===
          403,
        "analyst-quarantine-read-denied",
      );
    if (label === "admin") {
      phase("admin-mfa-quarantine-review");
      const review = page.locator("section.app-panel").filter({
        has: page.locator(`input[name="targetId"][value="${mediaId}"]`),
      });
      await expect(review).toHaveCount(1);
      await expect(review.getByRole("img")).toBeVisible();
      await review
        .getByLabel("Media action", { exact: true })
        .selectOption("approve");
      await review
        .getByLabel("Review reason", { exact: true })
        .fill(
          "Reviewed preview colour swatch only. Contains no personal identifiers or sporting evidence.",
        );
      const confirmed = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/community") && r.request().method() === "POST",
      );
      await review
        .getByRole("button", { name: "Record image decision", exact: true })
        .click();
      check(
        (await confirmed).status() === 200,
        "administrator-image-review-recorded",
      );
    }
    if (label === "auditor")
      check(
        (
          await api(page, "/api/community", {
            action: "moderate",
            targetType: "media",
            targetId: mediaId,
            decision: "reject",
            reason:
              "Unauthorized auditor write probe must not change the approved image.",
          })
        ).status === 403,
        "auditor-cannot-moderate",
      );
  });
