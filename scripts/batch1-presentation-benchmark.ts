/** Browser presentation timings only. Synthetic receipts; no database or provider. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { previewPackReceipt } from "../src/components/pack-opening-preview";
import {
  mountPackFixture,
  packFixtureMarkup,
} from "../tests/fixtures/pack-browser";

async function main() {
  const unchanged = [
    "src/components/pack-opening.tsx",
    "src/components/pack-cinema-v2.tsx",
    "src/app/pack-cinema-v2.css",
  ];
  for (const file of unchanged) {
    const previous = execFileSync(
      "git",
      ["show", "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef:" + file],
      { maxBuffer: 10e6 },
    )
      .toString()
      .replaceAll("\r", "");
    assert.equal(readFileSync(file, "utf8").replaceAll("\r", ""), previous);
  }
  const browser = await chromium.launch({ channel: "msedge" });
  const results: object[] = [];
  try {
    for (const sport of ["nfl", "afl", "nrl"] as const)
      for (const motion of ["no-preference", "reduce"] as const) {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          reducedMotion: motion,
        });
        const receipt = previewPackReceipt(sport);
        let opens = 0;
        await page.route("**/*", async (route) => {
          const path = new URL(route.request().url()).pathname;
          if (path === "/receipt") return route.fulfill({ json: null });
          if (path === "/open-pack") {
            opens++;
            return route.fulfill({ json: receipt });
          }
          return route.fulfill(await packFixtureMarkup(path));
        });
        await mountPackFixture(page, true);
        await page.evaluate(() => {
          const sample = { start: 0, pending: false, times: [] as number[] };
          (window as any).__presentation = sample;
          document.addEventListener(
            "click",
            (e) => {
              if (
                (e.target as HTMLElement)
                  .closest("button")
                  ?.getAttribute("aria-label") === "Reveal card"
              ) {
                sample.start = performance.now();
                sample.pending = true;
              }
            },
            true,
          );
          new MutationObserver(() => {
            if (
              sample.pending &&
              document
                .querySelector(".cinema-v2")
                ?.getAttribute("data-pack-reveal-phase") === "revealed"
            ) {
              sample.times.push(performance.now() - sample.start);
              sample.pending = false;
            }
          }).observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
          });
        });
        await page.getByRole("button", { name: "Open pack seal" }).click();
        for (let index = 0; index < receipt.cards.length; index++) {
          await page
            .getByRole("button", { name: "Reveal card", exact: true })
            .click();
          await expect(page.locator(".cinema-v2")).toHaveAttribute(
            "data-pack-reveal-phase",
            "revealed",
            { timeout: 10000 },
          );
          await page
            .getByRole("button", {
              name:
                index === receipt.cards.length - 1
                  ? "View Pack Summary"
                  : "Next Card →",
              exact: true,
            })
            .click();
        }
        await expect(page.locator(".pack-summary > li")).toHaveCount(9);
        assert.equal(opens, 1);
        const measured = await page.evaluate(() => ({
          animationMs: (window as any).__presentation.times as number[],
          measures: performance
            .getEntriesByType("measure")
            .filter((x) => x.name.startsWith("docked.purchase."))
            .map((x) => ({ name: x.name, durationMs: x.duration })),
        }));
        assert.equal(measured.animationMs.length, 9);
        results.push({ sport, motion, cards: 9, ...measured });
        await page.close();
      }
  } finally {
    await browser.close();
  }
  const directory = "docs/qa/batch1-pack-phone-20261116";
  mkdirSync(directory, { recursive: true });
  const evidence = {
    at: new Date().toISOString(),
    environment:
      "Local headless Edge, 390x844; synthetic immediate receipt transport; no CPU/network emulation",
    unchangedSinceProduction: unchanged,
    scope:
      "Shared before/after presentation code; excludes server latency and user pauses. Not installed Android or hosted measurements.",
    results,
    productionWrites: 0,
  };
  writeFileSync(
    directory + "/presentation-benchmark.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
