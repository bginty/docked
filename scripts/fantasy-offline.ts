import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
async function main() {
  if (process.argv[2] !== "--confirm-preview")
    throw Error("Preview scope required");
  const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({
    storageState: "private-data/fantasy/browser-0.json",
    viewport: { width: 390, height: 915 },
  });
  try {
    const p = await c.newPage();
    await p.goto(origin + "/fantasy/play", { waitUntil: "networkidle" });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    const metadata = await p
      .locator('link[rel="icon"],meta[property="og:image"]')
      .evaluateAll((xs) =>
        xs.map((x) => x.getAttribute("href") ?? x.getAttribute("content")),
      );
    assert.ok(
      metadata.some((x) => x?.includes("/brand/docked/icons/favicon.ico")),
    );
    const cached = await p.evaluate(async () => {
      const result: string[] = [];
      for (const k of await caches.keys()) {
        const cache = await caches.open(k);
        result.push(
          ...(await cache.keys()).map((r) => new URL(r.url).pathname),
        );
      }
      return result;
    });
    assert.deepEqual(cached, ["/brand/docked/offline.html"]);
    await c.setOffline(true);
    await p.goto(origin + "/fantasy/cards");
    await p.getByRole("heading", { name: "You’re offline." }).waitFor();
    const body = await p.locator("body").innerText();
    assert.ok(
      body.includes("COLLECT. BUILD. COMPETE.") &&
        body.includes("Test credits only.") &&
        !body.includes("BUILT FOR AN EDGE"),
    );
    await p.screenshot({
      path: "docs/qa/fantasy/offline-390.png",
      fullPage: true,
    });
    await writeFile(
      "docs/qa/fantasy/offline.json",
      JSON.stringify(
        {
          status: "PASS",
          cached,
          metadata,
          privateResponsesCached: false,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: branded offline shell; only the public fallback cached.",
    );
  } finally {
    await c.setOffline(false);
    await b.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
