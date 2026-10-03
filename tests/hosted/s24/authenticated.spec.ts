import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  accounts,
  check,
  executionGuard,
  ORIGIN,
  PROJECT,
  privateEvidence,
  type Account,
} from "./guard";
import { api, guardBrowser, login } from "./helpers";

test("optional disposable members: login, social consent, privacy, export and revocation", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.DOCKED_HTTPS_AUTH_ACCEPTANCE !== PROJECT,
    "BLOCKED: disposable authenticated acceptance not enabled",
  );
  test.setTimeout(300000);
  executionGuard();
  const members = accounts();
  const originsA = await guardBrowser(page.context());
  const peer = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: false,
  });
  const originsB = await guardBrowser(peer),
    peerPage = await peer.newPage();
  let consoleErrors = 0,
    pageErrors = 0;
  const browserIssues: Array<{ type: string; reactCode: string | null }> = [];
  for (const target of [page, peerPage]) {
    target.on("console", (m) => {
      if (m.type() === "error") {
        consoleErrors++;
        browserIssues.push({
          type: "console",
          reactCode: m.text().match(/Minified React error #(\d+)/)?.[1] ?? null,
        });
      }
    });
    target.on("pageerror", (error) => {
      pageErrors++;
      browserIssues.push({
        type: "pageerror",
        reactCode:
          error.message.match(/Minified React error #(\d+)/)?.[1] ?? null,
      });
    });
  }
  let postId: string | undefined;
  const phase: string[] = [];
  const record = (name: string) => phase.push(name);
  async function profile(target: typeof page, a: Account, label: string) {
    const current = await api(target.request, "/api/community?view=profile"),
      currentBody = await current.json();
    check(
      current.status() === 200 && currentBody.status === "ready",
      "allowlisted-social-account-ready",
    );
    if (!currentBody.profile) {
      await target.goto("/profile");
      const form = target.locator("#edit form").first();
      await form
        .locator('[name="handle"]')
        .fill(`qa_${a.id.replaceAll("-", "").slice(0, 16)}`);
      await form
        .locator('[name="displayName"]')
        .fill(`Preview acceptance ${label}`);
      await form
        .locator('[name="bio"]')
        .fill(
          "Disposable HTTPS acceptance account. No sporting or performance claims.",
        );
      await form.locator('[name="visibility"]').selectOption("members");
      const saved = target.waitForResponse(
        (r) =>
          r.url() === `${ORIGIN}/api/community` &&
          r.request().method() === "POST",
      );
      await form
        .getByRole("button", { name: "Save profile", exact: true })
        .click();
      check((await saved).status() === 200, "genuine-profile-saved");
    }
    const result = await api(target.request, "/api/community?view=profile"),
      value = await result.json();
    check(value.profile?.isOwn && value.profile?.id, "owned-social-profile");
    return value.profile as { id: string; handle: string };
  }
  try {
    await login(page, members.memberA);
    record("member-a-login");
    await page.reload({ waitUntil: "domcontentloaded" });
    check(
      (await api(page.request, "/api/member")).status() === 200,
      "session-persists-after-reload",
    );
    const a = await profile(page, members.memberA, "A");
    await login(peerPage, members.memberB);
    record("member-b-login");
    await profile(peerPage, members.memberB, "B");
    const nav = page.getByRole("navigation", { name: "Mobile app navigation" });
    check(await nav.isVisible(), "authenticated-mobile-app-navigation");
    for (const label of ["Home", "Edges", "Post", "Community", "Profile"])
      check(
        (await nav.getByRole("link", { name: label, exact: true }).count()) ===
          1,
        "five-native-app-destinations",
      );
    const edges = await api(page.request, "/api/edges"),
      quotes = await api(page.request, "/api/community-edges?view=options"),
      board = await api(page.request, "/api/top-docked");
    check(
      (await edges.json()).tips?.length === 0 &&
        (await quotes.json()).options?.length === 0,
      "no-official-or-community-provider-opportunities",
    );
    const boardData = await board.json();
    check(
      boardData.status === "RESTRICTED" && boardData.rows.length === 0,
      "tester-grants-no-leaderboard-rights",
    );
    check(
      (await api(page.request, "/api/admin/benefits")).status() === 403,
      "member-admin-denied",
    );
    const restricted = await api(page.request, "/api/community-edges", {
      action: "review",
      marketId: randomUUID(),
      selection: "Unsupported acceptance selection",
    });
    check(
      restricted.status() >= 400 && restricted.status() < 500,
      "direct-edge-submission-denied",
    );
    const cross = await api(
        peerPage.request,
        `/api/member?userId=${members.memberA.id}`,
      ),
      own = await cross.json();
    check(
      cross.status() === 200 && own.profile?.id === members.memberB.id,
      "export-never-follows-other-user-id",
    );
    record("direct-api-and-export-boundaries");
    for (const action of ["signup", "recover"]) {
      const blocked = await api(page.request, "/api/auth", {
        action,
        email: "docked-preview-https-blocked@example.invalid",
        password: randomUUID(),
        country: "AU",
        state: "NSW",
        age: true,
        terms: true,
      });
      check(blocked.status() === 503, "external-auth-email-remains-disabled");
    }
    await peerPage.goto("/notifications");
    check(
      !(await peerPage.locator('[name="dealsMarketing"]').isChecked()),
      "marketing-not-preselected",
    );
    for (const name of [
      "officialEdges",
      "leaderboard",
      "competitions",
      "dealsMarketing",
    ])
      await peerPage.locator(`[name="${name}"]`).uncheck();
    for (const name of ["followedMembers", "social", "inApp"])
      await peerPage.locator(`[name="${name}"]`).check();
    const prefs = peerPage.waitForResponse(
      (r) =>
        r.url() === `${ORIGIN}/api/notifications` &&
        r.request().method() === "POST",
    );
    await peerPage
      .getByRole("button", {
        name: "Save notification preferences",
        exact: true,
      })
      .click();
    check((await prefs).status() === 200, "in-app-only-preferences-saved");
    const follow = await api(peerPage.request, "/api/community", {
      action: "follow",
      profileId: a.id,
      enabled: true,
      notifications: true,
    });
    check(follow.status() === 200, "explicit-follow-notification-consent");
    // Wait past the ten-second batch rate window after profile creation/follow.
    await page.waitForTimeout(11000);
    const body = `HTTPS PREVIEW ACCEPTANCE ${randomUUID()}: discussion test only; no sporting price, result or performance claim.`;
    await page.goto("/compose");
    await page
      .getByRole("button", { name: "Create post", exact: true })
      .click();
    await page.getByLabel("Your post", { exact: true }).fill(body);
    const posted = page.waitForResponse(
      (r) =>
        r.url() === `${ORIGIN}/api/community` &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Publish social post", exact: true })
      .click();
    const created = await posted,
      createdBody = await created.json();
    check(
      created.status() === 200 && typeof createdBody.id === "string",
      "genuine-social-post-published",
    );
    postId = createdBody.id;
    await peerPage.goto(`/community/posts/${postId}`);
    check(
      (await peerPage.getByText(body, { exact: true }).count()) === 1,
      "peer-sees-real-social-post",
    );
    let delivered = false;
    for (let i = 0; i < 6; i++) {
      const notifications = await api(peerPage.request, "/api/notifications"),
        value = await notifications.json();
      delivered =
        value.items?.some(
          (n: { type: string; href: string }) =>
            n.type === "followed_post" &&
            n.href === `/community/posts/${postId}`,
        ) === true;
      if (delivered) break;
      await peerPage.waitForTimeout(11000);
    }
    check(delivered, "genuine-in-app-fanout-without-worker");
    record("social-post-and-in-app-fanout");
    const privateExport = await api(page.request, "/api/member");
    check(
      privateExport.status() === 200 &&
        privateExport.headers()["cache-control"]?.includes("no-store"),
      "private-export-no-store",
    );
    check(
      (await privateExport.json()).profile?.id === members.memberA.id,
      "account-export-own-record",
    );
    // Authenticate persistence in a new page within the existing context; never save cookies to a report.
    const second = await page.context().newPage();
    await second.goto(`${ORIGIN}/home`);
    check(
      (await second.locator('[data-authenticated="true"]').count()) === 1,
      "session-persists-in-new-page",
    );
    await second.close();
    const removed = await api(page.request, "/api/community", {
      action: "delete_post",
      postId,
    });
    check(removed.status() === 200, "qa-commentary-removed");
    postId = undefined;
    const logout = await api(page.request, "/api/auth", { action: "logout" });
    check(logout.status() === 200, "global-logout-success");
    check(
      (await api(page.request, "/api/member")).status() === 401,
      "logout-revokes-protected-api",
    );
    record("export-persistence-and-logout");
    await login(page, members.memberA);
    record("login-again-after-logout");
    if (process.env.DOCKED_HTTPS_DELETE_MEMBER_B === PROJECT) {
      const before = await api(peerPage.request, "/api/member"),
        payload = await before.json();
      check(
        members.memberB.disposable === true &&
          payload.profile?.id === members.memberB.id &&
          members.memberB.id !== members.memberA.id,
        "delete-exact-disposable-member-b-only",
      );
      const deletion = await api(peerPage.request, "/api/member", {
        action: "delete",
        confirm: "DELETE",
      });
      check(
        deletion.status() === 200,
        "disposable-account-erasure-completed-not-queued",
      );
      check(
        (await api(peerPage.request, "/api/member")).status() === 401,
        "deleted-account-access-revoked",
      );
      record("disposable-member-b-deleted");
    } else record("member-b-deletion-not-authorised-not-run");
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    check(axe.violations.length === 0, "authenticated-home-accessibility");
    check(
      consoleErrors === 0 && pageErrors === 0,
      "authenticated-browser-console-clean",
    );
    originsA();
    originsB();
  } finally {
    if (postId) {
      try {
        await api(page.request, "/api/community", {
          action: "delete_post",
          postId,
        });
      } catch {
        /* Root teardown remains required after a failed journey. */
      }
    }
    await mkdir(privateEvidence, { recursive: true });
    await writeFile(
      path.join(privateEvidence, "authenticated-checkpoints.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin: ORIGIN,
          projectRef: PROJECT,
          checkpoints: phase,
          browserIssues,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await peer.close();
  }
});
