import { chromium, expect, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import { executeCredits } from "../src/core/credits-sandbox";
import { testCard } from "../src/core/member-test-wallet";
import { marketplaceView, marketQuery } from "../src/core/marketplace";

async function main() {
  const identityOnly = process.argv.includes("--identity-only");
  const out = "docs/qa/ux-refinement-20261108/marketplace";
  await mkdir(out, { recursive: true });
  const entry = "tests/fixtures/marketplace-refresh.tsx";
  const original = execFileSync(
    "git",
    ["show", "1f8c6924:src/components/credit-marketplace.tsx"],
    { encoding: "utf8" },
  );
  const before = identityOnly
    ? ""
    : await bundleCommunityFixture(entry, {
        [resolve("src/components/credit-marketplace.tsx")]: original,
      });
  const after = await bundleCommunityFixture(entry);
  const layout = await readFile("src/app/layout.tsx", "utf8");
  const css = (
    await Promise.all(
      [...layout.matchAll(/import "\.\/(.+\.css)"/g)].map((m) =>
        readFile("src/app/" + m[1], "utf8"),
      ),
    )
  ).join("\n");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const evidence: unknown[] = [];
  async function setup(script: string, automatic = false) {
    const now = Date.now();
    let state = marketplaceFixture(now);
    const seller = marketActors[1],
      buyer = marketActors[0];
    let currentMember = buyer.id;
    const card = Object.keys(state.cards).find(
      (id) =>
        state.commerce.cards[id].owner === seller.id &&
        testCard(state, id).tier !== "CORE",
    )!;
    state = executeCredits(
      state,
      seller,
      "refresh-fixture-list",
      { kind: "list", card, price: 1000, preference: "sell" },
      now,
    ).state;
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(10000);
    await page.clock.install({ time: new Date(now) });
    await page.clock.pauseAt(new Date(now + 100));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const reads: {
      route: Route;
      view: ReturnType<typeof marketplaceView>;
      done: boolean;
    }[] = [];
    const commands: string[] = [];
    const view = (search = new URLSearchParams()) =>
      marketplaceView(
        state,
        currentMember,
        marketLabels,
        marketQuery.parse(Object.fromEntries(search)),
        {
          reserved: [],
          rounds: [],
          tradingEnabled: true,
          offersEnabled: false,
        },
        now,
      );
    const finish = async (index: number, status = 200) => {
      const read = reads[index];
      read.done = true;
      await read.route.fulfill(
        status === 200
          ? { json: { state: read.view } }
          : { status, json: { error: "Isolated read failure" } },
      );
    };
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/fixture.js")
        return route.fulfill({ contentType: "text/javascript", body: script });
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
      if (url.pathname === "/api/marketplace") {
        if (route.request().method() === "POST") {
          const input = route.request().postDataJSON();
          commands.push(input.command.kind);
          const result = executeCredits(
            state,
            buyer,
            input.request,
            input.command,
            now,
          );
          state = result.state;
          return route.fulfill({
            json: { state: view(url.searchParams), result: result.result },
          });
        }
        reads.push({ route, view: view(url.searchParams), done: false });
        if (automatic) await finish(reads.length - 1);
        return;
      }
      if (url.pathname === "/fantasy/market")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
        });
      return route.fulfill({ status: 404 });
    });
    await page.goto("https://fixture.invalid/fantasy/market");
    await expect.poll(() => reads.length).toBe(1);
    return {
      page,
      reads,
      finish,
      commands,
      errors,
      setAutomatic: (value: boolean) => {
        automatic = value;
      },
      state: () => state,
      card,
      buyer,
      switchMember: async (member: string) => {
        currentMember = member;
        await page.evaluate((next) => {
          (
            window as unknown as { fixtureSetMember: (member: string) => void }
          ).fixtureSetMember(next);
        }, member);
      },
    };
  }
  try {
    if (identityOnly) {
      const a = await setup(after, true);
      await expect(a.page.locator(".market-count")).toHaveText(
        "1 active listing",
      );
      await a.page
        .getByRole("button", { name: "Buy card", exact: true })
        .click({ force: true });
      await expect(a.page.getByRole("dialog")).toHaveCount(1);
      a.setAutomatic(false);
      await a.page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect.poll(() => a.reads.length).toBe(2);
      await a.switchMember(marketActors[1].id);
      await expect.poll(() => a.reads.length).toBe(3);
      await expect(a.page.locator(".market-tile")).toHaveCount(0);
      await expect(a.page.getByRole("dialog")).toHaveCount(0);
      await expect(a.page.locator(".fixed-market")).toHaveAttribute(
        "data-market-ready",
        "false",
      );
      await a.finish(2);
      await expect(
        a.page.getByRole("button", { name: "View listing", exact: true }),
      ).toBeVisible();
      // A delayed previous-member snapshot must not replace the new account.
      await a.finish(1);
      await a.page.clock.runFor(1);
      await expect(
        a.page.getByRole("button", { name: "View listing", exact: true }),
      ).toBeVisible();
      await expect(
        a.page.getByRole("button", { name: "Buy card", exact: true }),
      ).toHaveCount(0);
      expect(a.commands).toEqual([]);
      expect(a.errors).toEqual([]);
      await a.page.close();
      const result = {
        passed: true,
        scope:
          "Actual Marketplace component; in-place member prop switch, isolated identity and HTTP fixtures, no real account change or mutation",
        oldRowsClearedBeforeNewResponse: true,
        oldDetailClosedBeforeNewResponse: true,
        latePreviousAccountReadIgnored: true,
        newAccountListingOwnershipCorrect: true,
        commands: a.commands,
        pageErrors: a.errors,
      };
      await writeFile(
        `${out}/identity-acceptance.json`,
        JSON.stringify(result, null, 2),
      );
      console.log(JSON.stringify(result));
      return;
    }
    for (const [phase, script] of [
      ["before", before],
      ["after", after],
    ]) {
      const h = await setup(script);
      await h.page.clock.runFor(10000);
      await expect.poll(() => h.reads.length).toBe(phase === "before" ? 2 : 1);
      await h.page.clock.runFor(2000);
      await h.finish(0);
      await expect(h.page.locator(".fixed-market")).toHaveAttribute(
        "data-market-ready",
        phase === "before" ? "false" : "true",
      );
      if (phase === "after")
        await expect(h.page.locator(".market-count")).toHaveText(
          "1 active listing",
        );
      await h.page.screenshot({
        path: `${out}/${phase}-slow-read.png`,
        fullPage: true,
      });
      evidence.push({
        phase,
        simulatedResponseMs: 12000,
        pollIntervalMs: 10000,
        requestCount: h.reads.length,
        rendered: await h.page
          .locator(".fixed-market")
          .getAttribute("data-market-ready"),
        pageErrors: h.errors,
      });
      expect(h.errors).toEqual([]);
      await h.page.close();
    }
    const h = await setup(after, true);
    await expect(h.page.locator(".market-count")).toHaveText(
      "1 active listing",
    );
    await h.page
      .getByRole("button", { name: "Buy card", exact: true })
      .click({ force: true });
    await h.page
      .getByRole("button", { name: "Review purchase", exact: true })
      .click({ force: true });
    await expect(
      h.page.getByRole("button", { name: "Confirm purchase", exact: true }),
    ).toBeVisible();
    const reviewedRead = h.page.waitForResponse(
      (response) =>
        response.url().includes("/api/marketplace?") &&
        response.request().method() === "GET",
    );
    await h.page.clock.runFor(1);
    await (await reviewedRead).finished();
    await h.page.evaluate(() => Promise.resolve());
    await expect.poll(() => h.reads.length).toBe(2);
    await expect(h.page.locator(".market-count")).toHaveText(
      "1 active listing",
    );
    h.setAutomatic(false);
    await h.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => h.reads.length).toBe(3);
    const staleIndex = h.reads.length - 1;
    await h.page.evaluate(() => {
      for (const event of ["focus", "online", "docked-app-resume"])
        window.dispatchEvent(new Event(event));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(h.reads.length).toBe(3);
    await h.page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click({ force: true });
    await expect.poll(() => h.commands).toEqual(["review-buy", "buy"]);
    await expect
      .poll(() => h.state().commerce.cards[h.card].owner)
      .toBe(h.buyer.id);
    await expect(
      h.page.getByRole("heading", { name: "Congratulations!", exact: true }),
    ).toBeVisible();
    await h.page.clock.runFor(1);
    await expect.poll(() => h.reads.length).toBe(4);
    await h.finish(3);
    await expect(h.page.locator(".market-count")).toHaveText(
      "0 active listings",
    );
    // Deliberately deliver the stale pre-purchase snapshot last.
    await h.finish(staleIndex);
    await h.page.clock.runFor(1);
    await expect(h.page.locator(".market-count")).toHaveText(
      "0 active listings",
    );
    expect(h.errors).toEqual([]);
    evidence.push({
      scenario: "actual-component synthetic purchase",
      reads: h.reads.length,
      commands: h.commands,
      burstSignalsJoinedRead: true,
      stalePrePurchaseSnapshotIgnored: true,
      currentListingCount: 0,
      pageErrors: h.errors,
    });
    await h.page.close();

    const r = await setup(after);
    await r.finish(0, 503);
    await expect(r.page.getByRole("alert")).toContainText(
      "Isolated read failure",
    );
    await r.page
      .getByRole("button", { name: "Retry", exact: true })
      .click({ force: true });
    await expect.poll(() => r.reads.length).toBe(2);
    await r.finish(1);
    await expect(r.page.locator(".market-count")).toHaveText(
      "1 active listing",
    );
    await r.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => r.reads.length).toBe(3);
    await r.page
      .getByRole("button", { name: "Activity", exact: true })
      .click({ force: true });
    await expect.poll(() => r.reads.length).toBe(4);
    await r.finish(3);
    await r.finish(2);
    await expect(
      r.page.getByRole("button", { name: "Activity", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(r.page.locator(".fixed-market")).toHaveAttribute(
      "data-market-ready",
      "true",
    );
    expect(r.errors).toEqual([]);
    evidence.push({
      scenario: "read failure and query change",
      recoveryPassed: true,
      previousQueryReadCancelled: true,
      readCount: r.reads.length,
      pageErrors: r.errors,
    });
    await r.page.close();
  } finally {
    await browser.close();
  }
  await writeFile(
    `${out}/acceptance.json`,
    JSON.stringify(
      {
        passed: true,
        scope:
          "Actual Marketplace component, deterministic browser clock, isolated HTTP and transaction-core fixtures. No real customer writes or hosted/device acceptance.",
        evidence,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, evidence }));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
