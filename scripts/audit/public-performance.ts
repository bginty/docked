/** Diagnostic only. Fresh anonymous browser; no submitted forms or mutations. */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance as nodePerformance } from "node:perf_hooks";
async function main() {
  const out = "docs/qa/overnight-audit-20261115/public-performance";
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results: unknown[] = [];
  const routes = ["/", "/login", "/privacy", "/fantasy/cards"];
  try {
    for (const profile of ["desktop", "android-simulated"] as const) {
      for (const route of routes)
        for (let run = 1; run <= 3; run++) {
          const context = await browser.newContext({
            viewport:
              profile === "desktop"
                ? { width: 1440, height: 900 }
                : { width: 390, height: 844 },
            deviceScaleFactor: profile === "desktop" ? 1 : 2,
            isMobile: profile !== "desktop",
            hasTouch: profile !== "desktop",
            serviceWorkers: "block",
          });
          const page = await context.newPage(),
            cdp = await context.newCDPSession(page);
          await page.addInitScript("window.__name = value => value;");
          const failed: unknown[] = [],
            blocked: unknown[] = [],
            consoleErrors: string[] = [];
          await context.route("**/*", async (r) => {
            if (!["GET", "HEAD"].includes(r.request().method())) {
              blocked.push({
                path: new URL(r.request().url()).pathname,
                method: r.request().method(),
              });
              return r.abort();
            }
            return r.continue();
          });
          page.on("requestfailed", (r) =>
            failed.push({
              path: new URL(r.url()).pathname,
              error: r.failure()?.errorText,
            }),
          );
          page.on("pageerror", (e) => consoleErrors.push(e.message));
          await cdp.send("Network.enable");
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
          await cdp.send("Emulation.setCPUThrottlingRate", {
            rate: profile === "desktop" ? 1 : 4,
          });
          if (profile !== "desktop")
            await cdp.send("Network.emulateNetworkConditions", {
              offline: false,
              latency: 150,
              downloadThroughput: (1.6 * 1024 * 1024) / 8,
              uploadThroughput: (750 * 1024) / 8,
              connectionType: "cellular4g",
            });
          await page.addInitScript(() => {
            const metrics = {
              lcp: 0,
              cls: 0,
              longTasks: [] as number[],
              events: [] as number[],
            };
            Object.assign(window, { auditMetrics: metrics });
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) metrics.lcp = e.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const e of list.getEntries() as (PerformanceEntry & {
                hadRecentInput: boolean;
                value: number;
              })[])
                if (!e.hadRecentInput) metrics.cls += e.value;
            }).observe({ type: "layout-shift", buffered: true });
            new PerformanceObserver((list) => {
              for (const e of list.getEntries())
                metrics.longTasks.push(e.duration);
            }).observe({ type: "longtask", buffered: true });
            new PerformanceObserver((list) => {
              for (const e of list.getEntries())
                metrics.events.push(e.duration);
            }).observe({
              type: "event",
              buffered: true,
              durationThreshold: 16,
            } as PerformanceObserverInit);
          });
          const start = nodePerformance.now();
          let error: string | null = null,
            status = 0;
          try {
            const response = await page.goto("https://docked.com.au" + route, {
              waitUntil: "load",
              timeout: 60000,
            });
            status = response?.status() ?? 0;
            await page.waitForTimeout(2500);
          } catch (e) {
            error = String(e);
          }
          const loadedMs = Math.round(nodePerformance.now() - start);
          // Focus only: no sign-in, password reset, consent or other form submission.
          if (route === "/login" && !error) {
            const input = page.locator("input").first();
            if (await input.count()) await input.click();
            await page.waitForTimeout(300);
          }
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType(
              "navigation",
            )[0] as PerformanceNavigationTiming;
            const resources = performance.getEntriesByType(
              "resource",
            ) as PerformanceResourceTiming[];
            return {
              navigation: nav
                ? {
                    ttfb: nav.responseStart,
                    domInteractive: nav.domInteractive,
                    domContentLoaded: nav.domContentLoadedEventEnd,
                    loadEvent: nav.loadEventEnd,
                    transferBytes: nav.transferSize,
                  }
                : null,
              paint: performance
                .getEntriesByType("paint")
                .map((e) => ({ name: e.name, ms: e.startTime })),
              ...(window as unknown as { auditMetrics: object }).auditMetrics,
              resources: resources.map((r) => ({
                path: new URL(r.name).pathname,
                type: r.initiatorType,
                duration: r.duration,
                transferBytes: r.transferSize,
                encodedBytes: r.encodedBodySize,
                decodedBytes: r.decodedBodySize,
              })),
              horizontalOverflow:
                document.documentElement.scrollWidth > innerWidth,
              title: document.title,
              visibleText: document.body.innerText.slice(0, 1800),
            };
          });
          if (run === 1)
            await page.screenshot({
              path:
                out + `/${profile}-${route.replaceAll("/", "_") || "home"}.png`,
            });
          const row = {
            profile,
            route,
            run,
            status,
            finalPath: new URL(page.url()).pathname,
            loadedMs,
            error,
            metrics,
            failed,
            blocked,
            consoleErrors,
          };
          results.push(row);
          console.log(
            JSON.stringify({
              profile,
              route,
              run,
              status,
              ttfb: metrics.navigation?.ttfb,
              lcp: (metrics as { lcp?: number }).lcp,
              resources: metrics.resources.length,
              error,
            }),
          );
          writeFileSync(
            out + "/measurements.json",
            JSON.stringify(
              {
                at: new Date().toISOString(),
                origin: "https://docked.com.au",
                source: "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef",
                environment:
                  "Headless Edge on founder Windows laptop; new anonymous context per run; browser cache disabled; backend cold/warm state uncontrolled",
                mobileSimulation: {
                  cpuSlowdown: 4,
                  latencyMs: 150,
                  downloadMbps: 1.6,
                  uploadKbps: 750,
                  physicalAndroid: false,
                },
                limitations: [
                  "Interaction event durations are a small lab sample, not field INP",
                  "CLS is sum over observation window, not whole-session field metric",
                  "Anonymous /fantasy/cards renders the sign-in recovery screen, not a logged-in collection",
                  "Non-GET requests blocked, including analytics",
                ],
                results,
              },
              null,
              2,
            ) + "\n",
          );
          await context.close();
        }
    }
  } finally {
    await browser.close();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
