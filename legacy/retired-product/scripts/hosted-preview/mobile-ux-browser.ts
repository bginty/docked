// Operator-only real HTTPS acceptance. No mocked identity/data, trace, video, HTML or login captures.
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  allowedRequest,
  check,
  CheckpointFailure,
  loadFixture,
  origin,
  projectRef,
  type MobileUxFixture,
} from "../../tests/hosted/mobile-ux/guard";

const routes = [
  { path: "/edges", label: "Edges" },
  { path: "/feed", label: "Feed" },
  { path: "/following", label: "Following" },
  { path: "/points", label: "Points" },
  { path: "/my-edge", label: "My Edge" },
] as const;
const viewports = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1366, height: 900 },
];
type Result = {
  path: string;
  width: number;
  status: number;
  refreshed: boolean;
  axeViolations: {
    id: string;
    impact: string | null | undefined;
    nodes: number;
    selectors: string[];
  }[];
  consoleErrors: number;
  pageErrors: number;
  screenshot: string;
};

async function api(context: BrowserContext, path: string) {
  check(path.startsWith("/api/") && !path.includes("//"), "known-api-path");
  const result = await context.request.get(`${origin}${path}`, {
    maxRedirects: 0,
  });
  check(new URL(result.url()).origin === origin, "same-origin-api-response");
  return result;
}

async function login(page: Page, fixture: MobileUxFixture) {
  const response = await page.goto(`${origin}/login`, {
    waitUntil: "domcontentloaded",
  });
  check(response?.status() === 200, "login-page-ready");
  const form = page
    .locator('form[action="/api/auth"]')
    .filter({ has: page.locator('[name="password"]') });
  check(
    (await form.getAttribute("method")) === "post",
    "safe-native-form-method",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('form[action="/api/auth"]')
        ?.getAttribute("data-api-ready") === "true",
  );
  await form.locator('[name="email"]').fill(fixture.member.email);
  await form.locator('[name="password"]').fill(fixture.member.password);
  const pending = page.waitForResponse(
    (r) => r.url() === `${origin}/api/auth` && r.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Log in", exact: true }).click();
  const accepted = await pending;
  const result = await accepted.json();
  check(
    accepted.status() === 200 &&
      result.ok === true &&
      result.redirect === "/dashboard",
    "genuine-password-login",
  );
  await page.waitForURL(`${origin}/dashboard`);
  const cookies = (await page.context().cookies()).filter((c) =>
    c.name.startsWith(`sb-${projectRef}-auth-token`),
  );
  check(
    cookies.length > 0 &&
      cookies.every((c) => c.secure && c.httpOnly && c.sameSite === "Lax"),
    "secure-session-cookie-policy",
  );
  const own = await api(page.context(), "/api/member");
  check(
    own.status() === 200 &&
      (await own.json()).profile?.id === fixture.member.id,
    "genuine-disposable-session",
  );
}

async function ready(page: Page, path: string) {
  check(
    new URL(page.url()).origin === origin &&
      new URL(page.url()).pathname === path,
    "canonical-route",
  );
  // Authenticated streaming fallback has the same shell but intentionally no h1.
  // Wait for the real destination body before checking headings or capturing it.
  const bodies: Record<string, string> = {
    "/edges": ".mobile-edge-board",
    "/feed": ".feed-screen",
    "/following": ".following-screen",
    "/points": ".points-screen",
    "/my-edge": ".my-edge-screen",
  };
  check(!!bodies[path], "known-destination-body");
  await page.waitForFunction((selector) => {
    const visible = [...document.querySelectorAll(selector)].filter(
      (node) => node.getClientRects().length > 0,
    );
    return (
      visible.length === 1 &&
      document.querySelectorAll(".app-screen-loading").length === 0 &&
      document.querySelectorAll("h1").length === 1
    );
  }, bodies[path]);
  check(
    (await page.locator('[data-authenticated="true"]:visible').count()) === 1,
    "one-ready-authenticated-shell",
  );
  // My Edge deliberately keeps one accessible, visually hidden h1.
  check(
    (await page.locator("h1").count()) === 1,
    "single-accessible-page-heading",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  check(
    await page.evaluate(() => document.fonts.check('16px "Sora"')),
    "brand-font-loaded",
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "no-horizontal-overflow",
  );
  const decoded = await page.locator("img").evaluateAll(async (images) => {
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
  check(decoded, "actual-images-decode");
}

async function truth(page: Page, path: string) {
  if (path === "/edges") {
    check(
      (await page
        .getByRole("heading", {
          name: "Official Edges require approved regional access",
          exact: true,
        })
        .count()) === 1,
      "official-region-restriction-is-visible",
    );
    check(
      (await page.locator(".edge-card").count()) === 0,
      "no-actionable-fixture-edges",
    );
  }
  if (path === "/feed") {
    check(
      (await page
        .getByRole("heading", { name: "A little quieter here.", exact: true })
        .count()) === 1,
      "honest-empty-feed",
    );
    check(
      (await page.locator(".social-card").count()) === 0,
      "no-manufactured-posts",
    );
  }
  if (path === "/following") {
    check(
      (await page
        .getByRole("heading", {
          name: "Follow people, sports and sources",
          exact: true,
        })
        .count()) === 1,
      "honest-no-following-state",
    );
    check(
      (await page
        .getByRole("heading", { name: "Nothing new here yet.", exact: true })
        .count()) === 0,
      "no-duplicate-empty-panel",
    );
  }
  if (path === "/points") {
    const cards = page.locator(".member-points-summary .member-metric");
    check(
      (await cards.count()) === 2 &&
        (await cards.filter({ hasText: "Not enabled" }).count()) === 2,
      "monthly-lifetime-points-not-fabricated",
    );
    check(
      (await page.locator(".member-metrics .member-unavailable").count()) === 6,
      "restricted-performance-not-zero",
    );
    check(
      (await page.locator(".member-leaderboard li").count()) === 0,
      "no-fabricated-ranking",
    );
  }
  if (path === "/my-edge") {
    check(
      (await page
        .getByRole("heading", { name: "QA Mobile Preview", exact: true })
        .count()) === 1,
      "actual-disposable-profile",
    );
    check(
      (await page.locator(".member-metrics .member-unavailable").count()) === 3,
      "missing-own-performance-not-zero",
    );
    const counts = await page.locator(".profile-counts").innerText();
    check(
      /0\s+followers/.test(counts) && /0\s+following/.test(counts),
      "real-empty-relationship-counts",
    );
  }
}

async function main() {
  if (process.argv[2] === "--help" && process.argv.length === 3) {
    console.log(
      "Read-only UI acceptance: set DOCKED_MOBILE_UX_ACCEPTANCE to the exact Docked Preview ref, then --run. Uses only private-data/mobile-app-ux/acceptance.json; five tabs at 390/412/1366; genuine login/logout; no posts, follows, profile edits, owner account, trace or login screenshot.",
    );
    return;
  }
  let stage = "guard",
    width = 0,
    path = "",
    browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let failedCheckpoint: string | undefined;
  let failedErrorKind: string | undefined;
  let failureDom: Record<string, number | string | boolean> | undefined;
  const results: Result[] = [];
  const checks: { width: number; checkpoint: string }[] = [];
  const cycles: { width: number; consoleErrors: number; pageErrors: number }[] =
    [];
  const directory = resolve(
    "docs/qa/mobile-app-ux/hosted",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  async function save(status: "PASS" | "FAIL" | "RUNNING") {
    await writeFile(
      resolve(directory, "results.json"),
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          origin,
          projectRef,
          status,
          accountKind: "one disposable operator-provisioned QA account",
          genuinePasswordSession: checks.some(
            (item) => item.checkpoint === "genuine-login-own-id-secure-cookies",
          ),
          fixtureInjection: false,
          mutations: "ordinary login/logout only",
          ownerUsed: false,
          trace: false,
          loginScreenshots: false,
          completedViews: results.length,
          expectedViews: 15,
          checks,
          cycles,
          results,
          ...(status === "FAIL"
            ? {
                failedStage: stage,
                failedWidth: width,
                failedRoute: path,
                failedCheckpoint,
                failedErrorKind,
                failureDom,
              }
            : {}),
        },
        null,
        2,
      ) + "\n",
    );
  }
  try {
    check(
      process.argv.length === 3 && process.argv[2] === "--run",
      "explicit-run-mode",
    );
    const fixture = await loadFixture();
    await mkdir(directory, { recursive: true });
    stage = "launch";
    browser = await chromium.launch({ headless: true });
    for (const viewport of viewports) {
      width = viewport.width;
      path = "/login";
      const context = await browser.newContext({
        viewport,
        isMobile: width < 768,
        hasTouch: width < 768,
        timezoneId: "Australia/Sydney",
        locale: "en-AU",
        ignoreHTTPSErrors: false,
        serviceWorkers: "block",
      });
      context.setDefaultTimeout(30000);
      context.setDefaultNavigationTimeout(60000);
      let forbiddenRequests = 0;
      await context.route("**/*", async (route) => {
        const r = route.request();
        let exactAuth = true;
        if (r.method() === "POST") {
          try {
            const submitted = JSON.parse(r.postData() ?? "");
            exactAuth =
              submitted.action === "logout" ||
              (submitted.action === "login" &&
                submitted.email === fixture.member.email &&
                submitted.password === fixture.member.password);
          } catch {
            exactAuth = false;
          }
        }
        const safeUrl = ![fixture.member.email, fixture.member.password].some(
          (value) =>
            r.url().includes(value) ||
            r.url().includes(encodeURIComponent(value)),
        );
        if (
          !safeUrl ||
          !exactAuth ||
          !allowedRequest(r.url(), r.method(), r.postData())
        ) {
          forbiddenRequests++;
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      const page = await context.newPage();
      try {
        let totalConsoleErrors = 0,
          totalPageErrors = 0;
        page.on("console", (event) => {
          if (event.type() === "error") totalConsoleErrors++;
        });
        page.on("pageerror", () => {
          totalPageErrors++;
        });
        stage = "genuine-login";
        await login(page, fixture);
        checks.push({
          width,
          checkpoint: "genuine-login-own-id-secure-cookies",
        });
        stage = "protected-read-gates";
        const edges = await api(context, "/api/edges");
        check(
          edges.status() === 200 && (await edges.json()).tips?.length === 0,
          "no-official-sporting-data",
        );
        const options = await api(context, "/api/community-edges?view=options");
        check(
          options.status() === 200 &&
            (await options.json()).options?.length === 0,
          "no-provider-options",
        );
        const board = await api(context, "/api/top-docked");
        const ranking = await board.json();
        check(
          board.status() === 200 &&
            ranking.status === "RESTRICTED" &&
            ranking.rows?.length === 0,
          "leaderboard-remains-restricted",
        );
        check(
          (await api(context, "/api/admin/benefits")).status() === 403,
          "no-admin-privilege",
        );
        const feedResponse = await api(
          context,
          "/api/community?view=feed&tab=following",
        );
        const feed = await feedResponse.json();
        check(
          feedResponse.status() === 200 &&
            feed.status === "ready" &&
            feed.posts?.length === 0 &&
            feed.viewer?.following === 0,
          "real-empty-following-projection",
        );
        const discoveryResponse = await api(
          context,
          "/api/community?view=feed&tab=for_you",
        );
        const discovery = await discoveryResponse.json();
        check(
          discoveryResponse.status() === 200 &&
            discovery.status === "ready" &&
            discovery.posts?.length === 0,
          "real-empty-for-you-projection",
        );
        checks.push({
          width,
          checkpoint: "read-only-closed-sports-and-admin-gates",
        });
        await page.goto(`${origin}/edges`, { waitUntil: "domcontentloaded" });
        const navName =
          width < 768 ? "Mobile app navigation" : "App navigation";
        for (const destination of routes) {
          const beforeConsole = totalConsoleErrors,
            beforePage = totalPageErrors;
          path = destination.path;
          stage = "tab-switch";
          const nav = page.getByRole("navigation", {
            name: navName,
            exact: true,
          });
          check(await nav.isVisible(), "responsive-navigation-visible");
          check(
            (await nav.getByRole("link").count()) === 5,
            "five-primary-destinations",
          );
          await nav
            .getByRole("link", { name: destination.label, exact: true })
            .click();
          await page.waitForURL(`${origin}${path}`);
          await ready(page, path);
          check(
            (await nav
              .getByRole("link", { name: destination.label, exact: true })
              .getAttribute("aria-current")) === "page",
            "active-destination-matches-route",
          );
          stage = "direct-refresh";
          const response = await page.reload({ waitUntil: "domcontentloaded" });
          check(response?.status() === 200, "direct-authenticated-refresh");
          await ready(page, path);
          await truth(page, path);
          stage = "accessibility-and-evidence";
          const a11y = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          const body = await page.locator("body").innerText();
          check(
            !body.includes(fixture.member.password) &&
              !body.includes(fixture.member.email),
            "no-credential-capture",
          );
          const screenshot = `${path.slice(1)}-${width}.png`;
          await page.screenshot({
            path: resolve(directory, screenshot),
            fullPage: true,
          });
          const consoleErrors = totalConsoleErrors - beforeConsole,
            pageErrors = totalPageErrors - beforePage;
          await page.screenshot({
            path: resolve(directory, `${path.slice(1)}-${width}-viewport.png`),
            fullPage: false,
          });
          results.push({
            path,
            width,
            status: response.status(),
            refreshed: true,
            axeViolations: a11y.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.length,
              selectors: v.nodes.flatMap((node) =>
                node.target.map((target) => {
                  const value = String(target);
                  return /^[a-zA-Z0-9_\- .>#():[\]="']{1,200}$/.test(value) &&
                    !value.includes(fixture.member.password) &&
                    !value.includes(fixture.member.email)
                    ? value
                    : "[dynamic-selector]";
                }),
              ),
            })),
            consoleErrors,
            pageErrors,
            screenshot,
          });
          await save("RUNNING");
          console.log(
            `Checked ${path} at ${width}px: genuine authenticated refresh; ${a11y.violations.length} accessibility rules flagged, ${consoleErrors + pageErrors} browser errors.`,
          );
        }
        stage = "logout";
        path = "/my-edge";
        const logout = page.locator('.member-logout form[action="/api/auth"]');
        await page.waitForFunction(
          () =>
            document
              .querySelector(".member-logout form")
              ?.getAttribute("data-api-ready") === "true",
        );
        check(
          (await logout.getAttribute("method")) === "post",
          "safe-logout-form",
        );
        const pending = page.waitForResponse(
          (r) =>
            r.url() === `${origin}/api/auth` && r.request().method() === "POST",
        );
        await logout
          .getByRole("button", { name: "Log out", exact: true })
          .click();
        const loggedOut = await pending;
        check(
          loggedOut.status() === 200 && (await loggedOut.json()).ok === true,
          "ordinary-global-logout",
        );
        check(
          (await api(context, "/api/member")).status() === 401,
          "logout-revokes-private-export",
        );
        await page.goto(`${origin}/my-edge`, { waitUntil: "domcontentloaded" });
        check(
          (await page.locator('[data-authenticated="true"]').count()) === 0 &&
            (await page
              .getByRole("heading", {
                name: "Sign in to your verified account",
                exact: true,
              })
              .count()) === 1,
          "anonymous-private-shell-denied",
        );
        check(
          forbiddenRequests === 0,
          "no-external-request-or-forbidden-mutation",
        );
        cycles.push({
          width,
          consoleErrors: totalConsoleErrors,
          pageErrors: totalPageErrors,
        });
        checks.push({
          width,
          checkpoint: "logout-private-api-denial-and-no-external-mutations",
        });
        await save("RUNNING");
      } catch (error) {
        // Diagnostics contain counts and fixed selectors only; never raw DOM/errors.
        if (
          checks.some(
            (item) =>
              item.width === width &&
              item.checkpoint === "genuine-login-own-id-secure-cookies",
          )
        ) {
          const currentPath = new URL(page.url()).pathname;
          if (routes.some((route) => route.path === currentPath)) {
            const body = await page
              .locator("body")
              .innerText()
              .catch(() => "");
            failureDom = {
              route: currentPath,
              authenticatedShells: await page
                .locator('[data-authenticated="true"]')
                .count(),
              visibleAuthenticatedShells: await page
                .locator('[data-authenticated="true"]:visible')
                .count(),
              headings: await page.locator("h1").count(),
              visibleHeadings: await page.locator("h1:visible").count(),
              loadingBranches: await page
                .locator(".app-screen-loading")
                .count(),
              feedBodies: await page.locator(".feed-screen").count(),
              visibleFeedBodies: await page
                .locator(".feed-screen:visible")
                .count(),
            };
            if (
              body &&
              !body.includes(fixture.member.email) &&
              !body.includes(fixture.member.password)
            ) {
              await page.screenshot({
                path: resolve(
                  directory,
                  `failure-${currentPath.slice(1)}-${width}.png`,
                ),
                fullPage: false,
              });
            }
          }
        }
        throw error;
      } finally {
        await context.close();
      }
    }
    check(results.length === 15, "complete-five-tab-matrix");
    stage = "complete-matrix-quality";
    check(
      results.every(
        (row) =>
          row.axeViolations.length === 0 &&
          row.consoleErrors === 0 &&
          row.pageErrors === 0,
      ) &&
        cycles.every(
          (cycle) => cycle.consoleErrors === 0 && cycle.pageErrors === 0,
        ),
      "accessibility-and-entire-cycle-console-clean",
    );
    await save("PASS");
    console.log(
      "Mobile UX hosted acceptance PASS: 15 authenticated route/viewport checks, three genuine login/logout cycles. Sanitized evidence saved; QA cleanup still required.",
    );
  } catch (error) {
    // Playwright exceptions can contain filled values/URLs. Never serialize them.
    if (
      error instanceof CheckpointFailure &&
      /^[a-z-]+$/.test(error.checkpoint)
    )
      failedCheckpoint = error.checkpoint;
    else if (error instanceof Error)
      failedErrorKind = /strict mode violation/.test(error.message)
        ? "ambiguous-locator"
        : /timeout/i.test(error.name + error.message)
          ? "browser-timeout"
          : "browser-error";
    await mkdir(directory, { recursive: true });
    await save("FAIL");
    console.error(
      `Mobile UX acceptance stopped at ${stage}; width ${width}; known route ${path || "none"}. Private error content withheld. No owner account used. Review sanitized receipt; do not provision again.`,
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
void main();
