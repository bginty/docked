// Read-only acceptance for one explicitly reviewed candidate; never signs in.
import { chromium, request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://docked-preview-bktyvjl8r-briant-s-projects.vercel.app";
const stamp = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replaceAll(".", "-");
const output = path.resolve(
  "docs/qa/edge-signal-brand/hosted",
  `candidate-${stamp}`,
);
const report = {
  origin,
  sourceCommit: "5ee5c56",
  deploymentId: "dpl_98W8eekf5UHSkD1oNWNe39wRVUNb",
  startedAt: new Date().toISOString(),
  account: "anonymous; no accounts or writes",
  assets: [],
  checks: [],
  routes: [],
  failures: [],
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const save = async () =>
  writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
const check = (condition, message) => {
  if (!condition) throw Error(message);
};
await mkdir(output, { recursive: true });
const http = await request.newContext({
  baseURL: origin,
  ignoreHTTPSErrors: false,
  timeout: 45000,
});
let browser;
try {
  for (const [remote, local] of [
    [
      "/brand/logos/docked-primary.png",
      "public/brand/logos/docked-primary.png",
    ],
    [
      "/brand/logos/docked-primary-on-dark.png",
      "public/brand/logos/docked-primary-on-dark.png",
    ],
    ["/brand/logos/docked-mark.png", "public/brand/logos/docked-mark.png"],
    ["/brand/fonts/Sora-Variable.ttf", "public/brand/fonts/Sora-Variable.ttf"],
    [
      "/brand/social/docked-hero-built-for-an-edge.png",
      "public/brand/social/docked-hero-built-for-an-edge.png",
    ],
    [
      "/opengraph-image",
      "public/brand/social/docked-hero-built-for-an-edge.png",
    ],
    ["/favicon.ico", "public/favicon.ico"],
  ]) {
    const response = await http.get(remote, { maxRedirects: 0 });
    check(response.status() === 200, `${remote} HTTP ${response.status()}`);
    const actual = await response.body(),
      expected = await readFile(local);
    const item = {
      path: remote,
      status: response.status(),
      bytes: actual.length,
      sha256: sha256(actual),
      expectedSha256: sha256(expected),
      identical: actual.equals(expected),
    };
    report.assets.push(item);
    check(item.identical, `${remote} bytes differ`);
  }
  const health = await http.get("/api/status", { maxRedirects: 0 });
  check(health.status() === 200, "Status API must return 200");
  const status = await health.json();
  check(status.database === true, "Database health must be true");
  check(
    status.feed === false &&
      status.strategy === false &&
      status.publication === false,
    "Feed/strategy/publication must fail closed",
  );
  check(
    status.oddsProviderStatus === "NOT_CONFIGURED" &&
      status.resultsProviderStatus === "NOT_CONFIGURED",
    "Providers must remain NOT_CONFIGURED",
  );
  report.checks.push({
    path: "/api/status",
    status: health.status(),
    body: status,
  });
  for (const [url, expectedStatus] of [
    ["/api/community-edges/share?id=00000000-0000-4000-8000-000000000000", 403],
    ["/api/member", 401],
  ]) {
    const response = await http.get(url, { maxRedirects: 0 });
    check(
      response.status() === expectedStatus,
      `${url} must deny anonymous access`,
    );
    report.checks.push({
      path: url,
      status: response.status(),
      expectedStatus,
    });
  }
  await save();
  console.log(
    "PASS: 7 asset identities; closed provider/publication status; anonymous API denials.",
  );
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
      colorScheme: "light",
      reducedMotion: "reduce",
      serviceWorkers: "block",
      ignoreHTTPSErrors: false,
    });
    for (const route of [
      "/",
      "/home",
      "/login",
      "/edges",
      "/results",
      "/learn/value-versus-winners",
    ]) {
      const page = await context.newPage();
      const item = {
        route,
        width,
        startedAt: new Date().toISOString(),
        errors: [],
        requestFailures: [],
        blockedRequests: [],
      };
      const name = `${route === "/" ? "homepage" : route.slice(1).replaceAll("/", "-")}-${width}`;
      page.on("pageerror", (e) =>
        item.errors.push({ type: "pageerror", message: e.message }),
      );
      page.on("console", (m) => {
        if (m.type() === "error")
          item.errors.push({ type: "console", message: m.text() });
      });
      page.on("requestfailed", (r) => {
        if (r.failure()?.errorText !== "net::ERR_ABORTED")
          item.requestFailures.push({
            path: new URL(r.url()).pathname,
            failure: r.failure()?.errorText,
          });
      });
      await page.route("**/*", async (interception) => {
        const req = interception.request(),
          target = new URL(req.url());
        if (
          !["GET", "HEAD"].includes(req.method()) ||
          (target.protocol.startsWith("http") && target.origin !== origin)
        ) {
          item.blockedRequests.push({
            method: req.method(),
            origin: target.origin,
            path: target.pathname,
          });
          return interception.abort();
        }
        return interception.continue();
      });
      try {
        const response = await page.goto(origin + route, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        check(response?.status() === 200, `${route} response must be 200`);
        check(
          new URL(page.url()).origin === origin,
          "Navigation left exact candidate",
        );
        await page.locator("h1").waitFor({ state: "visible", timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        for (const image of await page.locator("img").all()) {
          if (!(await image.isVisible())) continue;
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(async (node) => {
            await Promise.race([
              node.decode(),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(Error("Image decode timed out")),
                  15000,
                ),
              ),
            ]);
          });
        }
        await page.evaluate(() => scrollTo(0, 0));
        item.renderedPath = new URL(page.url()).pathname;
        item.visual = await page.evaluate(() => ({
          heading: document.querySelector("h1")?.textContent,
          font: getComputedStyle(document.body).fontFamily,
          soraLoaded: [...document.fonts].some(
            (face) =>
              face.family.replaceAll('"', "") === "Sora" &&
              face.status === "loaded",
          ),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          logos: [...document.querySelectorAll("img.brand-logo")]
            .filter((image) => image.getBoundingClientRect().width > 0)
            .map((image) => {
              const style = getComputedStyle(image),
                box = image.getBoundingClientRect();
              return {
                path: new URL(image.currentSrc || image.src).pathname,
                width: box.width,
                height: box.height,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                filter: style.filter,
                shadow: style.boxShadow,
                transform: style.transform,
              };
            }),
          brokenImages: [...document.images]
            .filter(
              (image) =>
                image.getBoundingClientRect().width > 0 &&
                (!image.complete || !image.naturalWidth),
            )
            .map((image) => new URL(image.currentSrc || image.src).pathname),
        }));
        check(
          item.visual.soraLoaded && item.visual.font.includes("Sora"),
          "Sora must load",
        );
        check(item.visual.overflow === false, "Horizontal overflow");
        check(item.visual.logos.length > 0, "Supplied logo missing");
        for (const logo of item.visual.logos)
          check(
            logo.filter === "none" &&
              logo.shadow === "none" &&
              logo.transform === "none" &&
              Math.abs(
                logo.width / logo.height -
                  logo.naturalWidth / logo.naturalHeight,
              ) < 0.025,
            "Logo distorted or modified",
          );
        check(item.visual.brokenImages.length === 0, "Broken image");
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        item.accessibility = {
          violations: axe.violations,
          incomplete: axe.incomplete.map((v) => ({
            id: v.id,
            nodes: v.nodes.length,
          })),
        };
        check(axe.violations.length === 0, "Accessibility violations");
        await page.screenshot({
          path: path.join(output, `${name}.png`),
          fullPage: true,
        });
        if (route === "/")
          await page.screenshot({
            path: path.join(output, `${name}-viewport.png`),
          });
        check(item.errors.length === 0, "Browser console/page errors");
        check(item.requestFailures.length === 0, "Failed browser requests");
        check(
          item.blockedRequests.length === 0,
          "Unexpected external/write requests",
        );
        item.passed = true;
        console.log(`PASS ${width}px ${route}`);
      } catch (error) {
        item.passed = false;
        item.failure = error.message;
        await page
          .screenshot({
            path: path.join(output, `${name}-failure.png`),
            fullPage: true,
          })
          .catch(() => {});
        report.failures.push({ route, width, failure: error.message });
        console.log(`FAIL ${width}px ${route}: ${error.message}`);
      } finally {
        item.completedAt = new Date().toISOString();
        report.routes.push(item);
        await save();
        await page.close();
      }
    }
    await context.close();
  }
} catch (error) {
  report.failures.push({ stage: "setup-or-API", failure: error.message });
  console.log(`FAIL setup-or-API: ${error.message}`);
} finally {
  await browser?.close();
  await http.dispose();
  report.completedAt = new Date().toISOString();
  report.passed = report.failures.length === 0 && report.routes.length === 12;
  await save();
  console.log(
    JSON.stringify({
      evidence: output,
      passed: report.passed,
      routes: report.routes.length,
      failures: report.failures.length,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
