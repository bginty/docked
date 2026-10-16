const evidence = process.env.DOCKED_VISUAL_EVIDENCE ?? "docs/qa/mobile-cleanup";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const base = process.env.DOCKED_LOCAL_VISUAL_ORIGIN ?? "http://127.0.0.1:3023";
test("touch viewport, compact pack discovery and keyboard-safe reveal controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  await page.goto(base + "/fantasy/cards");
  await page.getByRole("link", { name: /Open packs/ }).tap();
  await expect(
    page.getByText("No unopened packs.", { exact: false }),
  ).toBeVisible();
  await page.goto(base + "/fantasy/reveal");
  await page.getByRole("button", { name: "Open nine-card preview" }).tap();
  await expect(
    page.getByRole("button", { name: "Reveal next card" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reveal next card" }).tap();
  await expect(page.getByText("2 of 9 · RARE")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(
    page.getByRole("button", { name: "Reveal next card" }),
  ).toBeEnabled();
  const bounds = await page.locator(".pack-case").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Close panel" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});
test.beforeEach(async ({ context }) => {
  await context.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
});
test("mobile/desktop hierarchy, card details, independent drafts, explicit social posting", async ({
  page,
}) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [412, 1440]) {
    await page.setViewportSize({ width, height: 815 });
    for (const tab of ["play", "cards", "social", "market"]) {
      await page.goto(base + "/fantasy/" + tab);
      await page.waitForTimeout(350);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${evidence}/after-${tab}-${width}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 412, height: 815 });
  await page.goto(base + "/fantasy/play");
  await page.getByRole("button", { name: /QB1: / }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Your competition entry has not changed."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter Competition", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update Team", exact: true }),
  ).toBeDisabled();
  const salaryTeam = await page.locator(".seven-field").innerText();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("No Salary Cap · 1.0×–1.5×")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter Competition", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salary Cap", exact: true }).click();
  expect(await page.locator(".seven-field").innerText()).toBe(salaryTeam);
  await page.goto(base + "/fantasy/cards");
  await page.getByRole("button", { name: /View Alex.*card details/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Alex Northbridge-Wellington",
  );
  await page.keyboard.press("Escape");
  await page.goto(base + "/fantasy/social");
  let posts = 0;
  const keys: string[] = [];
  await page.route("**/api/community", async (r) => {
    posts++;
    keys.push(r.request().postDataJSON().idempotencyKey);
    await r.fulfill({ status: 503, json: { error: "Local recovery test" } });
  });
  await page
    .getByRole("textbox", { name: "Your post" })
    .fill("Local only unsent draft");
  expect(posts).toBe(0);
  await page.getByRole("button", { name: "Preview post", exact: true }).click();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Local recovery test");
  await expect(page.getByRole("textbox", { name: "Your post" })).toHaveValue(
    "Local only unsent draft",
  );
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect.poll(() => posts).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  expect(errors).toEqual([]);
});
test("nine distinct animations, short viewport fit, rapid taps, skip and reopen recording", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 720 },
    recordVideo: {
      dir: "tmp/mobile-reveal-video",
      size: { width: 412, height: 720 },
    },
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  let mutations = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") mutations++;
  });
  await page.goto(base + "/fantasy/reveal");
  await page.getByRole("button", { name: "Open nine-card preview" }).click();
  for (let i = 0; i < 3; i++) {
    await expect(
      page.locator(`[data-reveal-index="${i}"].pack-rising`),
    ).toBeVisible();
    expect(
      await page
        .locator(".pack-arrival")
        .evaluate((e) => getComputedStyle(e).animationName),
    ).toBe("docked-single-reveal");
    await expect(
      page.getByRole("button", { name: "Reveal next card" }),
    ).toBeEnabled();
    const rect = await page.locator(".pack-case").boundingBox();
    expect(rect!.y).toBeGreaterThan(0);
    expect(rect!.y + rect!.height).toBeLessThan(720);
    expect(
      await page
        .locator("dialog")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    if (i === 1)
      await page.screenshot({
        path: `${evidence}/reveal-second.png`,
      });
    if (i < 2)
      await page
        .getByRole("button", { name: "Reveal next card" })
        .evaluate((b: HTMLButtonElement) => {
          b.click();
          b.click();
          b.click();
        });
  }
  await page.getByRole("button", { name: "Skip remaining reveals" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(9);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open nine-card preview" }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(9);
  await page
    .getByRole("button", { name: "Replay saved result · no new cards" })
    .click();
  for (let i = 0; i < 9; i++) {
    await expect(
      page.locator(`[data-reveal-index="${i}"].pack-rising`),
    ).toBeVisible();
    const next = page.getByRole("button", {
      name: i === 8 ? "View pack summary" : "Reveal next card",
    });
    await expect(next).toBeEnabled();
    await next.click();
  }
  expect(mutations).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Replay saved result · no new cards" })
    .click();
  await expect(page.locator(".pack-rising")).toHaveCount(0);
  for (const height of [915, 720, 640]) {
    await page.setViewportSize({ width: 412, height });
    expect(
      await page
        .locator("dialog")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(axe.violations).toEqual([]);
  await page.addStyleTag({ content: "html{font-size:32px}" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Close panel" })).toBeVisible();
  await page.screenshot({
    path: `${evidence}/reveal-enlarged-text.png`,
  });
  await context.close();
  await page.video()!.saveAs(`${evidence}/nine-card-reveal.webm`);
});

test("compact lineup profile and explicit transfer retain independent drafts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await page.goto(base + "/fantasy/play");
  const te = page.getByRole("button", { name: /TE1: Taylor West/ });
  await expect(te).toContainText("Pittsburgh");
  await expect(te).toContainText("1.1×");
  await expect(te).not.toContainText("600,000");
  await expect(te.locator("svg text")).toHaveText("84"); // Explicit synthetic verified metadata.
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await page
    .locator(".seven-field")
    .screenshot({ path: `${evidence}/lineup-refined.png` });
  await te.click();
  const profile = page.getByRole("dialog");
  await expect(profile).toContainText("Pittsburgh");
  await expect(profile).toContainText("Fantasy salary");
  await expect(profile).toContainText("600,000");
  await expect(profile).toContainText("Awaiting verified scoring history");
  await expect(profile).toContainText("Upcoming games");
  await profile.screenshot({
    path: `${evidence}/player-profile.png`,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Choose TE1");
  await page
    .locator(".seven-candidate")
    .filter({ hasText: "Alex Northbridge-Wellington" })
    .click();
  await expect(
    page.getByRole("button", { name: "Use this player" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Choose TE1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /WR1: Casey Rivers/ }).click();
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await page
    .locator(".seven-candidate")
    .filter({ hasText: "Blake Hill" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Outgoing 650,000");
  await expect(page.getByRole("dialog")).toContainText("Incoming 600,000");
  await expect(page.getByRole("dialog")).toContainText("Remaining 350,000");
  await page.getByRole("button", { name: "Use this player" }).click();
  await expect(
    page.getByRole("button", { name: /WR1: Blake Hill/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /WR1: Blake Hill/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /WR1: Casey Rivers/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /WR1: Casey Rivers/ }).click();
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await page
    .locator(".seven-candidate")
    .filter({ hasText: "Blake Hill" })
    .click();
  await expect(page.getByRole("dialog")).not.toContainText(
    "Replacement budget",
  );
  await expect(
    page.getByRole("button", { name: "Use this player" }),
  ).toBeEnabled();
});
test("locked player profile remains readable without transfer or removal", async ({
  page,
}) => {
  await page.goto(base + "/fantasy/play");
  await page
    .getByRole("button", { name: "Enter Competition", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update Team", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = "docked:local-visual-state:v1";
    const state = JSON.parse(sessionStorage.getItem(key)!);
    const entry = state.seven.entries.find(
      (e: { competition_id: string }) => e.competition_id === "visual-round-0",
    );
    entry.snapshot[0].kickoff = new Date(
      Date.parse(state.seven.server_time) - 1000,
    ).toISOString();
    sessionStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const qb = page.getByRole("button", { name: /QB1: .*locked/ });
  await expect(qb).toBeEnabled();
  await qb.click();
  await expect(page.getByRole("dialog")).toContainText("Locked ·");
  await expect(
    page.getByRole("button", { name: "Transfer", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Card details & rules", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove from lineup" }),
  ).toHaveCount(0);
});

test("pack chances show only per-card rarity percentages with separate terms", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await page.goto(base + "/fantasy/test-wallet#packs");
  const chances = page.locator(".pack-chances").first();
  await chances.locator("summary").click();
  await expect(chances.getByRole("columnheader")).toHaveCount(2);
  await expect(chances).toContainText("Rare");
  await expect(chances).toContainText("%");
  await expect(chances).not.toContainText("active catalogue");
  await expect(chances).not.toContainText("At least one");
  await expect(
    page.locator(".pack-terms").first().locator("summary"),
  ).toHaveText("Pack details");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await chances.screenshot({
    path: `${evidence}/rarity-chances.png`,
  });
});
