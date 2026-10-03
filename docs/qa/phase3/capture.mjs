// Repeatable local preview measurements; no authenticated fixture or external provider use.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
const output = path.join(process.cwd(), "docs/qa/phase3", phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const base = "http://localhost:3000";
// Explicitly warm the existing production preview process, while each measurement gets a fresh cache/context.
const warm = await browser.newPage();
await warm.goto(base, { waitUntil: "networkidle" });
await warm.close();
const results = [];
for (const width of [1440, 390]) {
  const runs = [];
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__visualMetrics = { lcp: null, cls: 0, lcpElement: null };
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) {
          window.__visualMetrics.lcp = last.startTime;
          window.__visualMetrics.lcpElement =
            last.element?.tagName + "." + last.element?.className;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__visualMetrics.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    runs.push(
      await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        return {
          ...window.__visualMetrics,
          domContentLoaded:
            navigation.domContentLoadedEventEnd - navigation.startTime,
          transferredBytes:
            navigation.transferSize +
            resources.reduce(
              (total, resource) => total + resource.transferSize,
              0,
            ),
          resourceRequests: resources.length,
          imageTransferBytes: resources
            // A preloaded hero can be reported with initiatorType "link".
            .filter(
              (resource) =>
                resource.initiatorType === "img" ||
                resource.name.includes("/images/sports/") ||
                resource.name.includes("/_next/image?"),
            )
            .reduce((total, resource) => total + resource.transferSize, 0),
        };
      }),
    );
    await context.close();
  }
  const median = (key) => runs.map((run) => run[key]).sort((a, b) => a - b)[1];
  results.push({
    viewport: { width, height: 1000 },
    runs,
    median: {
      lcp: median("lcp"),
      cls: median("cls"),
      domContentLoaded: median("domContentLoaded"),
      transferredBytes: median("transferredBytes"),
      imageTransferBytes: median("imageTransferBytes"),
    },
  });
}
const routes = {
  homepage: "/",
  edges: "/edges",
  results: "/results",
  article: "/learn/minimum-odds",
  sports: "/sports",
  "member-locked": "/dashboard",
};
for (const width of [1440, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const [name, route] of Object.entries(routes)) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // Full-page evidence needs below-fold lazy photos loaded; never do this during the initial-viewport measurements above.
    for (const photo of await page.locator(".sport-image img").all()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate((image) => image.decode());
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(output, `${name}-${width}.png`),
      fullPage: true,
    });
  }
  await context.close();
}
const report = {
  phase,
  recordedAt: new Date().toISOString(),
  buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
  browser: browser.version(),
  method:
    "Local Chromium headless; 3 fresh browser contexts per viewport; warmed standalone server; 1440x1000 and 390x1000 CSS px; deviceScaleFactor 1; no CPU/network throttling; page networkidle plus 1200ms observation; viewport emulation is not mobile hardware. Transferred bytes = NavigationTiming + ResourceTiming transferSize, including headers where exposed. Local lab comparison, not field Core Web Vitals or a production/network forecast.",
  results,
};
await writeFile(
  path.join(output, "performance.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
await browser.close();
