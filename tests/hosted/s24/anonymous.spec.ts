import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  check,
  executionGuard,
  ORIGIN,
  PROJECT,
  publicEvidence,
  privateEvidence,
} from "./guard";
import { api, guardBrowser, publicCapture, readyImages } from "./helpers";

test.beforeEach(() => executionGuard());

test("actual database and provider status remain closed; anonymous APIs protect private records", async ({
  request,
}, info) => {
  const response = await api(request, "/api/status");
  check(response.status() === 200, "status-http-success");
  check(
    response.headers()["cache-control"]?.includes("no-store"),
    "status-no-store",
  );
  const status = await response.json();
  check(status.database === true, "actual-preview-database-connected");
  check(
    status.oddsProviderStatus === "NOT_CONFIGURED" &&
      status.resultsProviderStatus === "NOT_CONFIGURED",
    "providers-not-configured",
  );
  check(
    status.feed === false &&
      status.strategy === false &&
      status.publication === false,
    "publication-and-strategy-closed",
  );
  const edges = await api(request, "/api/edges"),
    edgesBody = await edges.json();
  check(
    edges.status() === 200 &&
      Array.isArray(edgesBody.tips) &&
      edgesBody.tips.length === 0,
    "no-invented-official-tips",
  );
  const options = await api(request, "/api/community-edges?view=options"),
    optionsBody = await options.json();
  check(
    options.status() === 200 &&
      optionsBody.status === "NOT_CONFIGURED" &&
      optionsBody.options?.length === 0,
    "no-invented-market-references",
  );
  const board = await api(request, "/api/top-docked"),
    boardBody = await board.json();
  check(
    board.status() === 200 &&
      boardBody.status === "RESTRICTED" &&
      boardBody.rows?.length === 0,
    "no-anonymous-rankings",
  );
  const member = await api(request, "/api/member"),
    admin = await api(request, "/api/admin/benefits");
  check(
    member.status() === 401 && admin.status() === 403,
    "private-export-and-admin-denied",
  );
  await mkdir(publicEvidence, { recursive: true });
  await writeFile(
    path.join(publicEvidence, `api-${info.project.name}.json`),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        projectRef: PROJECT,
        origin: ORIGIN,
        database: status.database,
        oddsProviderStatus: status.oddsProviderStatus,
        resultsProviderStatus: status.resultsProviderStatus,
        feed: status.feed,
        strategy: status.strategy,
        publication: status.publication,
        anonymousTips: edgesBody.tips.length,
        anonymousMemberStatus: member.status(),
        anonymousAdminStatus: admin.status(),
        fixtureInjection: false,
      },
      null,
      2,
    ),
  );
});

const routes = [
  { name: "homepage", url: "/" },
  { name: "app-home", url: "/home", gate: true },
  { name: "edges", url: "/edges" },
  { name: "post", url: "/compose", gate: true },
  { name: "community", url: "/community", gate: true },
  {
    name: "top-docked",
    url: "/top-docked",
    empty: "Leaderboard not available",
  },
  { name: "profile", url: "/profile", gate: true },
  { name: "notifications", url: "/notifications", gate: true },
  { name: "dashboard", url: "/dashboard", gate: true },
  { name: "signup-closed", url: "/join" },
  { name: "login", url: "/login" },
  { name: "results", url: "/results" },
  { name: "methodology", url: "/methodology" },
  { name: "article", url: "/learn/minimum-odds" },
] as const;

for (const route of routes)
  test(`anonymous ${route.name}: real HTTPS page, access, accessibility and assets`, async ({
    page,
    context,
    request,
  }, info) => {
    const assertOrigins = await guardBrowser(context);
    const name = `${route.name}-${info.project.name}`;
    const saveCapture = await publicCapture(page, name);
    let consoleErrors = 0,
      pageErrors = 0;
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors++;
    });
    page.on("pageerror", () => pageErrors++);
    const response = await page.goto(route.url, {
      waitUntil: "domcontentloaded",
    });
    check(response?.status() === 200, "page-http-success");
    check(
      new URL(page.url()).origin === ORIGIN &&
        new URL(page.url()).pathname === route.url,
      "no-production-or-unexpected-redirect",
    );
    await page.locator("h1").waitFor({ state: "visible" });
    check(
      await page.locator(".preview-banner").isVisible(),
      "visible-preview-state",
    );
    await readyImages(page);
    check((await page.locator("h1").count()) === 1, "one-page-heading");
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "mobile-no-horizontal-overflow",
    );
    if ("gate" in route)
      check(
        await page
          .getByRole("heading", {
            name: "Sign in to your verified account",
            exact: true,
          })
          .isVisible(),
        "anonymous-sign-in-gate",
      );
    if ("empty" in route)
      check(
        await page
          .getByRole("heading", { name: route.empty, exact: true })
          .isVisible(),
        "honest-restricted-empty-state",
      );
    if (route.name === "signup-closed") {
      check(
        await page
          .getByText(/This preview does not collect registrations/)
          .isVisible(),
        "registration-closed-notice",
      );
      check(
        await page
          .locator("form button[type=submit],form button:not([type])")
          .first()
          .isDisabled(),
        "signup-submit-disabled",
      );
      for (const consent of ["digest", "education", "edgeAlerts", "analytics"])
        check(
          !(await page.locator(`[name="${consent}"]`).isChecked()),
          "optional-consent-not-preselected",
        );
    }
    if (route.name === "app-home") {
      check(
        (await page.locator('a[href="/login"]').count()) > 0,
        "anonymous-sign-in-navigation",
      );
      const destinations = await page
        .locator("nav a[href]")
        .evaluateAll((links) =>
          links.map((a) => (a as HTMLAnchorElement).href),
        );
      check(
        destinations.every((href) => new URL(href).origin === ORIGIN),
        "navigation-stays-in-preview",
      );
    }
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await mkdir(publicEvidence, { recursive: true });
    await page.screenshot({
      path: path.join(publicEvidence, `${name}.png`),
      fullPage: true,
    });
    const capture = await saveCapture();
    // Genuine RSC response, kept with HTML and public bundles in ignored storage.
    const rsc = await request.get(`${ORIGIN}${route.url}`, {
      headers: { RSC: "1" },
      maxRedirects: 0,
    });
    check(
      rsc.status() === 200 && new URL(rsc.url()).origin === ORIGIN,
      "rsc-response-origin",
    );
    check(
      rsc.headers()["content-type"]?.includes("text/x-component"),
      "actual-rsc-content-type",
    );
    await writeFile(
      path.join(privateEvidence, "public-responses", name, "direct.rsc"),
      await rsc.body(),
      { mode: 0o600 },
    );
    const violations = accessibility.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
    }));
    await writeFile(
      path.join(publicEvidence, `${name}.json`),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin: ORIGIN,
          route: route.url,
          width: page.viewportSize()?.width,
          status: response.status(),
          fixtureInjection: false,
          screenshot: `${name}.png`,
          consoleErrors,
          pageErrors,
          violations,
          publicArtifacts: capture,
        },
        null,
        2,
      ),
    );
    assertOrigins();
    check(violations.length === 0, "automated-accessibility");
    check(consoleErrors === 0 && pageErrors === 0, "browser-console-clean");
  });
