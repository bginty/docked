import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  accounts,
  check,
  executionGuard,
  ORIGIN,
  PROJECT,
  publicEvidence,
} from "./guard";
import { api, guardBrowser, login, publicCapture } from "./helpers";

test("optional real member: populated post, comment and in-app timestamps hydrate across timezones", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.DOCKED_HTTPS_AUTH_ACCEPTANCE !== PROJECT,
    "BLOCKED: disposable authenticated acceptance not enabled",
  );
  test.setTimeout(180000);
  executionGuard();
  const member = accounts().memberA;
  const origins = await guardBrowser(context);
  const browserIssues: Array<{ type: string; reactCode: string | null }> = [];
  const results: Array<Record<string, unknown>> = [];
  let postId: string | undefined, commentId: string | undefined;
  context.on("page", monitor);
  function monitor(view: typeof page) {
    view.on("console", (message) => {
      if (message.type() === "error")
        browserIssues.push({
          type: "console",
          reactCode:
            message.text().match(/Minified React error #(\d+)/)?.[1] ?? null,
        });
    });
    view.on("pageerror", (error) =>
      browserIssues.push({
        type: "pageerror",
        reactCode:
          error.message.match(/Minified React error #(\d+)/)?.[1] ?? null,
      }),
    );
  }
  monitor(page);
  try {
    await login(page, member);
    const created = await api(page.request, "/api/community", {
      action: "post",
      kind: "discussion",
      body: `HTTPS PREVIEW timestamp acceptance ${randomUUID()}. Disposable QA discussion only; no sports, wagering or performance claim.`,
      promotional: false,
      mediaIds: [],
      idempotencyKey: randomUUID(),
    });
    const post = await created.json();
    check(
      created.status() === 200 && typeof post.id === "string",
      "timezone-qa-post-created",
    );
    postId = post.id;
    const capturePost = await publicCapture(page, "timestamp-post-sydney");
    await page.goto(`/community/posts/${postId}`, { waitUntil: "load" });
    await page.getByRole("button", { name: "0 comments", exact: true }).click();
    const comments = page.getByRole("region", {
      name: "Comments",
      exact: true,
    });
    const commentBody = `HTTPS PREVIEW comment timestamp acceptance ${randomUUID()}. Disposable QA commentary.`;
    await comments
      .getByLabel("Add a comment", { exact: true })
      .fill(commentBody);
    const submitted = page.waitForResponse(
      (r) =>
        r.url() === `${ORIGIN}/api/community` &&
        r.request().method() === "POST",
    );
    await comments
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    const response = await submitted,
      comment = await response.json();
    check(
      response.status() === 200 && typeof comment.id === "string",
      "timezone-qa-comment-created-through-ui",
    );
    commentId = comment.id;
    await expect(
      comments.getByText(commentBody, { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".social-card time")).toHaveCount(2);
    await inspect(page, "timestamp-post-comment-sydney", capturePost);

    const notificationData = await api(page.request, "/api/notifications"),
      notifications = await notificationData.json();
    check(
      notificationData.status() === 200 && notifications.items?.length > 0,
      "timezone-notifications-genuinely-populated",
    );
    const notice = notifications.items.find(
      (item: { type: string; title: string }) =>
        item.type === "system" && item.title.startsWith("QA ONLY:"),
    );
    const notificationPage = await context.newPage();
    const captureNotifications = await publicCapture(
      notificationPage,
      "timestamp-notifications-sydney",
    );
    await notificationPage.goto("/notifications", { waitUntil: "load" });
    await expect(
      notificationPage.locator(".notification-item time").first(),
    ).toBeVisible();
    await inspect(
      notificationPage,
      "timestamp-notifications-sydney",
      captureNotifications,
    );
    results.push({
      notificationItems: notifications.items.length,
      notificationEvidence: notice
        ? "Explicit operator QA system notice via normal in-app enqueue; no invented member activity"
        : "Existing genuine in-app notification",
    });
    check(
      browserIssues.length === 0,
      "populated-timestamps-browser-console-clean",
    );
    origins();
  } finally {
    if (commentId)
      check(
        (
          await api(page.request, "/api/community", {
            action: "delete_comment",
            commentId,
          })
        ).status() === 200,
        "timezone-qa-comment-removed",
      );
    if (postId)
      check(
        (
          await api(page.request, "/api/community", {
            action: "delete_post",
            postId,
          })
        ).status() === 200,
        "timezone-qa-post-removed",
      );
    await writeFile(
      path.join(publicEvidence, "timezone-evidence.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin: ORIGIN,
          projectRef: PROJECT,
          timezone: "Australia/Sydney",
          locale: "en-AU",
          browserIssues,
          results,
          qaCommentaryRemoved: !!postId,
        },
        null,
        2,
      ),
    );
  }
  async function inspect(
    view: typeof page,
    name: string,
    capture: Awaited<ReturnType<typeof publicCapture>>,
  ) {
    const times = view.locator("time[datetime]");
    check((await times.count()) > 0, "timezone-real-instant-present");
    for (let i = 0; i < (await times.count()); i++) {
      const element = times.nth(i),
        instant = await element.getAttribute("datetime");
      check(
        !!instant && Number.isFinite(Date.parse(instant)),
        "timezone-valid-machine-readable-instant",
      );
      const expected = await view.evaluate(
        (value) =>
          new Date(value).toLocaleString(undefined, { timeZoneName: "short" }),
        instant!,
      );
      await expect(element).toHaveText(expected);
    }
    check(
      await view.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "timezone-mobile-no-overflow",
    );
    const axe = await new AxeBuilder({ page: view })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    check(axe.violations.length === 0, "timezone-populated-page-accessibility");
    await view.screenshot({
      path: path.join(publicEvidence, `${name}.png`),
      fullPage: true,
    });
    results.push({
      view: name,
      timeCount: await times.count(),
      violations: [],
      artifacts: await capture(),
    });
  }
});
