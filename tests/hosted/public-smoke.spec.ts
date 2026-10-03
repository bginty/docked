import { test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const project = "bckkllmndoxzpzdqrevb";
const evidence = path.resolve("docs/qa/phase4/hosted-public");
function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`Hosted public check failed: ${code}`);
}
test.beforeEach(async () => {
  check(
    process.env.DOCKED_HOSTED_PUBLIC === project,
    "explicit-read-only-hosted-guard",
  );
  check(!process.env.DEBUG && !process.env.PWDEBUG, "debug-output-disabled");
  await mkdir(evidence, { recursive: true });
});
test("read-only hosted public API health and anonymous privacy boundary", async ({
  request,
}) => {
  const statusResponse = await request.get("/api/status");
  check(statusResponse.status() === 200, "status-http-success");
  check(
    statusResponse.headers()["cache-control"]?.includes("no-store"),
    "status-no-store",
  );
  const status = await statusResponse.json();
  check(status.database === true, "genuine-preview-database-connected");
  check(
    status.oddsProviderStatus === "NOT_CONFIGURED" &&
      status.resultsProviderStatus === "NOT_CONFIGURED",
    "unconfigured-provider-state",
  );
  check(
    status.feed === false &&
      status.strategy === false &&
      status.publication === false,
    "publication-fails-closed",
  );
  const edgesResponse = await request.get("/api/edges");
  const edges = await edgesResponse.json();
  check(
    edgesResponse.status() === 200 &&
      Array.isArray(edges.tips) &&
      edges.tips.length === 0,
    "anonymous-no-invented-edges",
  );
  check(
    edgesResponse.headers()["cache-control"]?.includes("private") &&
      edgesResponse.headers()["cache-control"]?.includes("no-store"),
    "edges-private-no-store",
  );
  const member = await request.get("/api/member");
  check(member.status() === 401, "anonymous-private-export-denied");
  const admin = await request.get("/api/admin/benefits");
  check(admin.status() === 403, "anonymous-admin-denied");
  await writeFile(
    path.join(evidence, "public-api-status.json"),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        projectRef: project,
        database: status.database,
        oddsProviderStatus: status.oddsProviderStatus,
        resultsProviderStatus: status.resultsProviderStatus,
        feed: status.feed,
        strategy: status.strategy,
        publication: status.publication,
        anonymousEdgeCount: edges.tips.length,
        anonymousMemberStatus: member.status(),
        anonymousAdminStatus: admin.status(),
        note: "Read-only APIRequestContext requests; expected401/403 denial probes do not execute in the page and therefore do not pollute browser console counts.",
      },
      null,
      2,
    ),
  );
});
const routes = [
  { name: "homepage", url: "/" },
  { name: "edges-unconfigured", url: "/edges" },
  { name: "results-empty", url: "/results" },
  { name: "methodology", url: "/methodology" },
  { name: "article-educational-draft", url: "/learn/minimum-odds" },
  { name: "signup-unsubmitted", url: "/join" },
  { name: "member-anonymous-gate", url: "/dashboard" },
  { name: "admin-anonymous-gate", url: "/admin" },
];
async function readyImages(page: Page) {
  return page.locator("img").evaluateAll(async (images) => {
    for (const image of images) (image as HTMLImageElement).loading = "eager";
    return (
      await Promise.all(
        images.map(async (image) => {
          try {
            await (image as HTMLImageElement).decode();
            return (image as HTMLImageElement).naturalWidth > 0;
          } catch {
            return false;
          }
        }),
      )
    ).every(Boolean);
  });
}
for (const width of [390, 1366])
  test(`genuine hosted public desktop-mobile accessibility and captures at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let consoleErrors = 0,
      pageErrors = 0;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors++;
    });
    page.on("pageerror", () => pageErrors++);
    const results = [];
    for (const route of routes) {
      const beforeConsole = consoleErrors,
        beforePage = pageErrors;
      const response = await page.goto(route.url, { waitUntil: "networkidle" });
      check(response?.status() === 200, `${route.name}-http-success`);
      check(await readyImages(page), `${route.name}-images-decode`);
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route.name}-no-horizontal-overflow`,
      );
      check(
        (await page.getByRole("heading", { level: 1 }).count()) === 1,
        `${route.name}-single-main-heading`,
      );
      if (route.name === "signup-unsubmitted")
        for (const name of ["digest", "education", "edgeAlerts", "analytics"])
          check(
            !(await page.locator(`[name="${name}"]`).isChecked()),
            "optional-consent-unselected",
          );
      if (route.name === "member-anonymous-gate")
        check(
          await page
            .getByRole("heading", { name: "Sign in to your verified account" })
            .isVisible(),
          "member-gate-visible",
        );
      if (route.name === "admin-anonymous-gate")
        check(
          await page
            .getByRole("heading", { name: "Verified access required." })
            .isVisible(),
          "admin-gate-visible",
        );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const screenshot = `${route.name}-${width}.png`;
      await page.screenshot({
        path: path.join(evidence, screenshot),
        fullPage: true,
      });
      results.push({
        route: route.url,
        screenshot,
        status: response?.status(),
        width,
        axeViolations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
        consoleErrors: consoleErrors - beforeConsole,
        pageErrors: pageErrors - beforePage,
      });
      await writeFile(
        path.join(evidence, `public-routes-${width}.json`),
        JSON.stringify(
          {
            recordedAt: new Date().toISOString(),
            projectRef: project,
            authenticated: false,
            fixtureInjection: false,
            results,
          },
          null,
          2,
        ),
      );
      check(
        axe.violations.length === 0,
        `${route.name}-automated-accessibility`,
      );
      check(
        consoleErrors === beforeConsole && pageErrors === beforePage,
        `${route.name}-browser-console-clean`,
      );
    }
  });
