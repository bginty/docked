// Isolated rendered acceptance; never connects to Docked or creates entries.
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const before = process.argv.includes("--before");
  const prizesOnly = process.argv.includes("--prizes-only");
  const playOnly = process.argv.includes("--play-only");
  const phase = before ? "before" : "after";
  const out = "docs/qa/ux-refinement-20261108/play";
  mkdirSync(out, { recursive: true });
  const scripts = await Promise.all(
    [
      "tests/fixtures/play-standings-visual.tsx",
      "tests/fixtures/ux-round-selector.tsx",
      "tests/fixtures/member-surfaces.tsx",
    ].map((entry) => bundleCommunityFixture(entry)),
  );
  const css = [
    ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
      /import "\.\/([\w-]+)\.css"/g,
    ),
  ]
    .map((m) => readFileSync(`src/app/${m[1]}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://localhost").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (["/fixture.js", "/selector.js", "/member.js"].includes(pathname)) {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      return res.end(
        scripts[
          pathname === "/fixture.js" ? 0 : pathname === "/selector.js" ? 1 : 2
        ],
      );
    }
    if (pathname === "/style.css") {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      return res.end(css);
    }
    if (pathname === "/local-identity") {
      res.setHeader("Content-Type", "application/json");
      return res.end('{"member":"visual-member"}');
    }
    if (pathname.startsWith("/api/")) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      return res.end('{"error":"Isolated visual fixture"}');
    }
    if (pathname.startsWith("/brand/") || pathname.startsWith("/images/")) {
      const file = resolve("public", "." + pathname);
      assert(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Isolated Play UX</title></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="${pathname === "/selector" ? "/selector.js" : pathname.startsWith("/member/") ? "/member.js" : "/fixture.js"}"></script></body></html>`,
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: "msedge" });
  const results = [];
  try {
    for (const width of [320, 360, 412, 1366]) {
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        reducedMotion: "reduce",
      });
      await page.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
      );
      if (!prizesOnly) {
        await page.goto(origin + "/fantasy/play?scenario=entered");
        await expect(page.locator(".competition-weeks")).toBeVisible();
        await page.screenshot({
          path: `${out}/${phase}-play-${width}.png`,
          fullPage: true,
        });
        if (playOnly) {
          const geometry = await page.evaluate(() => {
            const card = document
              .querySelector(".play-game-day .game-day-summary")!
              .getBoundingClientRect();
            const links = document
              .querySelector(".play-round-links")!
              .getBoundingClientRect();
            return {
              gap:
                links.left >= card.right
                  ? links.left - card.right
                  : links.top - card.bottom,
              axis: links.left >= card.right ? "horizontal" : "vertical",
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert(!geometry.overflow);
          assert(
            geometry.gap >= 0 && geometry.gap <= 16,
            JSON.stringify(geometry),
          );
          results.push({ width, passed: true, geometry });
          await page.close();
          continue;
        }
        await page.goto(origin + "/selector");
        await expect(page.locator(".competition-weeks")).toBeVisible();
        if (before)
          await page.locator(".competition-weeks button").nth(1).click();
        else {
          const select = page.getByRole("combobox", { name: "Round" });
          await expect(select).toHaveValue("current");
          await expect(select.locator("option[value=past]")).toHaveText(
            "Round 6 — Entries closed · Test",
          );
          await expect(select.locator("option[value=final]")).toHaveText(
            "Round 7 — Final · Test",
          );
          await expect(select.locator("option[value=current]")).toHaveText(
            "Round 8 — Entries open",
          );
          await expect(select.locator("option[value=next]")).toHaveText(
            "Round 9 — Upcoming",
          );
          await select.selectOption("practice");
          await expect(page.getByRole("status")).toHaveText(
            "Selected: practice",
          );
          await expect(select.locator("option:checked")).toContainText(
            "Practice",
          );
          await page.getByRole("button", { name: "Previous round" }).click();
          await expect(select).toHaveValue("next");
          await page.getByRole("button", { name: "Next round" }).click();
          await expect(select).toHaveValue("practice");
          await expect(
            page.getByRole("button", { name: "Next round" }),
          ).toBeDisabled();
          await select.selectOption("current");
        }
        await page.screenshot({
          path: `${out}/${phase}-selector-${width}.png`,
          fullPage: true,
        });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "horizontal overflow",
        );
        if (!before) {
          await page.addStyleTag({
            content: "html {font-size: 24px !important}",
          });
          await page.screenshot({
            path: `${out}/after-text-scale-${width}.png`,
            fullPage: true,
          });
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            "text-scale overflow",
          );
          const box = await page
            .getByRole("combobox", { name: "Round" })
            .boundingBox();
          assert(box && box.height >= 44);
        }
        results.push({ width, passed: true });
      }
      if (!before) {
        for (const sport of ["nfl", "afl", "nrl"]) {
          for (const route of prizesOnly
            ? ["prizes"]
            : ["rankings", "prizes"]) {
            await page.goto(`${origin}/member/${route}?sport=${sport}`);
            await expect(
              page.getByRole("heading", {
                name: route === "prizes" ? "Prizes" : "Rankings",
                exact: true,
              }),
            ).toBeVisible();
            await page.screenshot({
              path: `${out}/after-${sport}-${route}-${width}.png`,
              fullPage: true,
            });
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              `${sport} ${route} overflow`,
            );
          }
        }
      }
      if (prizesOnly) results.push({ width, passed: true });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(
    `${out}/${prizesOnly ? "prizes" : playOnly ? "play-spacing" : phase}-checks.json`,
    JSON.stringify(
      { phase, results, synthetic: true, customerMutations: 0 },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
}
void main();
