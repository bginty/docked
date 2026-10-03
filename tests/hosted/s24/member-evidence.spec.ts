import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  accounts,
  check,
  executionGuard,
  ORIGIN,
  PROJECT,
  publicEvidence,
} from "./guard";
import { guardBrowser, login, publicCapture, readyImages } from "./helpers";

test("optional real member: six mobile app views and accessibility evidence", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.DOCKED_HTTPS_AUTH_ACCEPTANCE !== PROJECT,
    "BLOCKED: disposable authenticated acceptance not enabled",
  );
  test.setTimeout(300000);
  executionGuard();
  const member = accounts().memberA;
  const assertOrigins = await guardBrowser(context);
  await login(page, member);
  const results = [];
  await mkdir(publicEvidence, { recursive: true });
  const views = [
    "/home",
    "/community",
    "/compose",
    "/profile",
    "/notifications",
    "/dashboard",
  ].map((route) => ({ route, width: 390 }));
  views.push({ route: "/home", width: 320 });
  for (const { route, width } of views) {
    const view = await context.newPage();
    await view.setViewportSize({ width, height: 844 });
    const name = `member-${route.slice(1)}-${width === 390 ? "mobile" : "320"}`;
    const capture = await publicCapture(view, name);
    let consoleErrors = 0,
      pageErrors = 0;
    view.on("console", (message) => {
      if (message.type() === "error") consoleErrors++;
    });
    view.on("pageerror", () => pageErrors++);
    const response = await view.goto(`${ORIGIN}${route}`, {
      waitUntil: "domcontentloaded",
    });
    check(
      response?.status() === 200 &&
        new URL(view.url()).origin === ORIGIN &&
        new URL(view.url()).pathname === route,
      "member-view-status-origin",
    );
    await view.locator("h1").waitFor({ state: "visible" });
    check(
      (await view.locator("h1").count()) === 1,
      "member-view-single-heading",
    );
    if (route !== "/dashboard") {
      check(
        (await view.locator('[data-authenticated="true"]').count()) === 1,
        "member-app-shell-authenticated",
      );
      check(
        (await view.locator(".app-preview-label").isVisible()) &&
          (await view.locator(".app-preview-label").innerText()).trim() ===
            "PREVIEW",
        "member-mobile-preview-label-visible",
      );
    } else
      check(
        await view
          .getByRole("heading", { name: "Follow the evidence.", exact: true })
          .isVisible(),
        "private-dashboard-content",
      );
    check(
      await view.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "member-view-no-overflow",
    );
    await readyImages(view);
    const result = await new AxeBuilder({ page: view })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await view.screenshot({
      path: path.join(publicEvidence, `${name}.png`),
      fullPage: true,
      mask: [view.locator('input[type="password"]')],
    });
    const artifacts = await capture();
    results.push({
      route,
      screenshot: `${name}.png`,
      status: response.status(),
      width,
      consoleErrors,
      pageErrors,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
      })),
      artifacts,
    });
    await writeFile(
      path.join(publicEvidence, "member-views.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin: ORIGIN,
          projectRef: PROJECT,
          authenticated: true,
          accountKind: "disposable operator-provisioned QA",
          fixtureInjection: false,
          results,
        },
        null,
        2,
      ),
    );
    check(result.violations.length === 0, "member-view-accessibility");
    check(consoleErrors === 0 && pageErrors === 0, "member-view-console-clean");
    await view.close();
  }
  assertOrigins();
});
