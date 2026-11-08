import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { profile } from "../tests/fixtures/global-sport-data";

async function main() {
  const baseline = process.argv.includes("--baseline");
  const focused = process.argv.includes("--focused");
  const phase = baseline ? "before" : focused ? "after-focused" : "after";
  const out = "docs/qa/ux-refinement-20261108/social";
  await mkdir(out, { recursive: true });
  const revision = "1cabfc48";
  const previous = (path: string) =>
    execFileSync("git", ["show", `${revision}:${path}`], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  const sourceOverrides: Record<string, string> = {};
  if (baseline) {
    for (const path of [
      "src/components/social-composer.tsx",
      "src/components/social-home-content.tsx",
    ])
      sourceOverrides[resolve(path)] = previous(path);
  }
  const script = await bundleCommunityFixture(
    "tests/fixtures/social-refinement.tsx",
    sourceOverrides,
  );
  const layout = await readFile("src/app/layout.tsx", "utf8");
  const css = (
    await Promise.all(
      [...layout.matchAll(/import "\.\/(.+\.css)"/g)].map((m) =>
        baseline
          ? Promise.resolve(previous("src/app/" + m[1]))
          : readFile("src/app/" + m[1], "utf8"),
      ),
    )
  ).join("\n");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const measurements = [];
  try {
    for (const width of focused ? [412] : [320, 360, 412, 1366]) {
      const page = await browser.newPage({ viewport: { width, height: 915 } });
      page.setDefaultTimeout(15000);
      let hubs = 0,
        posts = 0;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const cards = Array.from({ length: 180 }, (_, i) => ({
        card: {
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          edition_id: `edition-${i}`,
          player_id: `player-${i}`,
          name: `Fixture Player ${String(i).padStart(3, "0")}`,
          tier: "RARE",
          serial: i + 1,
          max_supply: 2000,
          sport: ["nfl", "afl", "nrl"][i % 3],
          position: "MID",
          team: "Docked",
          colour: "#123456",
          shirt: "solid",
          season: 2026,
          kind: "PLAYER",
          status: "owned",
          tradeable: false,
        },
        offers: false,
        asking: null,
      }));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/fixture.js")
          return route.fulfill({
            contentType: "text/javascript",
            body: script,
          });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        if (url.pathname.startsWith("/brand/")) {
          try {
            return route.fulfill({
              body: await readFile("public" + url.pathname),
              contentType: url.pathname.endsWith(".svg")
                ? "image/svg+xml"
                : "image/webp",
            });
          } catch {
            return route.fulfill({ status: 404 });
          }
        }
        if (url.pathname === "/api/community") {
          if (route.request().method() === "POST") {
            posts++;
            return route.fulfill({
              status: 503,
              json: {
                error: "Fixture connection interrupted. Draft retained.",
              },
            });
          }
          if (url.searchParams.get("view") === "hub") {
            hubs++;
            return route.fulfill({
              json: {
                own: true,
                viewer: profile.id,
                handle: profile.handle,
                visibility: "private",
                visible: true,
                cards,
                settings: null,
                communities: [],
                canManage: false,
                teams: [],
              },
            });
          }
          return route.fulfill({
            json: {
              status: "ready",
              viewer: profile,
              profiles: [],
              posts: [],
              nextCursor: null,
            },
          });
        }
        if (url.pathname === "/api/sports-beta")
          return route.fulfill({ json: { allowed: ["afl", "nrl"] } });
        if (url.pathname === "/api/test-wallet")
          return route.fulfill({
            json: {
              state: {
                member: profile.id,
                wallet: { spendable: 10000 },
                packs: [],
                swaps: [],
              },
            },
          });
        if (url.pathname.startsWith("/api/"))
          return route.fulfill({
            json: { state: { enabled: false }, unread: 0, notifications: [] },
          });
        if (url.pathname === "/fantasy/social")
          return route.fulfill({
            contentType: "text/html",
            body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
          });
        return route.fulfill({ status: 404 });
      });
      await page.goto("https://fixture.invalid/fantasy/social");
      await expect(page.locator(".docked-composer")).toHaveAttribute(
        "data-composer-ready",
        "true",
      );
      const initial = await page.locator(".docked-composer").boundingBox();
      const initialHubRequests = hubs;
      await page.screenshot({
        path: `${out}/${phase}-${width}.png`,
        fullPage: true,
      });
      if (!baseline) {
        await expect(
          page.getByRole("button", { name: "What’s happening?", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "What’s happening?", exact: true })
          .click();
      }
      await page
        .getByRole("textbox", { name: "Post to Docked" })
        .fill("A fixture draft stays safe through inspection and errors.");
      const started = performance.now();
      await page
        .getByRole("button", { name: "Attach cards", exact: true })
        .click();
      await expect(
        page.locator(".social-attachment-grid .fantasy-card").first(),
      ).toBeVisible();
      const pickerReadyMs = performance.now() - started;
      const renderedCards = await page
        .locator(".social-attachment-grid .fantasy-card")
        .count();
      const pickerDomNodes = await page
        .locator(".attachment-sheet")
        .evaluate((el) => el.querySelectorAll("*").length);
      if (!baseline) {
        await expect(
          page.locator(".social-attachment-grid .fantasy-card"),
        ).toHaveCount(24);
        await page.getByRole("button", { name: "Next cards" }).click();
        await page
          .getByRole("checkbox", { name: "Attach Fixture Player 024" })
          .check();
        if (width === 412) {
          for (const number of ["000", "003", "006"])
            await page
              .getByRole("checkbox", {
                name: `Attach Fixture Player ${number}`,
              })
              .check();
          await expect(
            page.getByRole("checkbox", { name: "Attach Fixture Player 009" }),
          ).toBeDisabled();
          for (const number of ["000", "003", "006"])
            await page
              .getByRole("checkbox", {
                name: `Attach Fixture Player ${number}`,
              })
              .uncheck();
          const search = page.getByRole("searchbox", {
            name: "Search owned players",
          });
          await search.fill("173");
          await expect(
            page.getByText("No owned players match this search."),
          ).toBeVisible();
          await search.fill("024");
          await expect(
            page.getByRole("checkbox", { name: "Attach Fixture Player 024" }),
          ).toBeChecked();
          await search.fill("");
        }
        await page.getByRole("button", { name: "Done · 1 selected" }).click();
        await page.getByRole("button", { name: "Minimise composer" }).click();
        await expect(
          page.getByRole("button", {
            name: "Continue your draft",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Continue your draft", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Post to Docked" }),
        ).toHaveValue(
          "A fixture draft stays safe through inspection and errors.",
        );
        await page.getByRole("button", { name: "Post", exact: true }).click();
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "Fixture connection interrupted" }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Post to Docked" }),
        ).toHaveValue(
          "A fixture draft stays safe through inspection and errors.",
        );
        await page
          .getByRole("button", { name: "Add image", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Add image", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Close panel" }).click();
        await page.getByRole("button", { name: "Minimise composer" }).click();
        if (width === 412) {
          await page.evaluate(() => {
            location.hash = "social-compose";
          });
          await expect(
            page.getByRole("textbox", { name: "Post to Docked" }),
          ).toBeFocused();
          await page.getByRole("button", { name: "Minimise composer" }).click();
        }
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "20px"),
        );
        await expect(
          page.getByRole("link", { name: "Announcements", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `${out}/after-text125-${width}.png`,
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
      measurements.push({
        width,
        initialComposerHeight: initial?.height,
        initialHubRequests,
        hubRequests: hubs,
        renderedCards,
        pickerDomNodes,
        pickerReadyMs: Math.round(pickerReadyMs),
        postAttempts: posts,
      });
      console.log(JSON.stringify(measurements.at(-1)));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(
    `${out}/${phase}-measurements.json`,
    JSON.stringify(
      {
        phase,
        isolated: true,
        fixtureCards: 180,
        caveat:
          "Single-run local fixture timings are directional, not hosted or physical-device performance claims",
        measurements,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ phase, passed: true, measurements }));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
