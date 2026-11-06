import { devices, expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { rarityRule } from "../../src/core/card-rarity";
import { rarityPresentation } from "../../src/core/rarity-theme";
import {
  previewPackReceipt,
  type PreviewSport,
} from "../../src/components/pack-opening-preview";
import {
  mountPackFixture,
  packFixtureMarkup,
  revealPhase,
} from "../fixtures/pack-browser";

const evidence =
  (process.env.DOCKED_VISUAL_EVIDENCE ?? "docs/qa/mobile-cleanup") +
  "/cinematic-regression";
const previewSports: PreviewSport[] = ["afl", "nfl", "nrl"];

for (const sport of previewSports) {
  test(
    "cinematic rarity, turn and awarded player match the " + sport + " receipt",
    async ({ browser }) => {
      test.setTimeout(120000);
      await mkdir(evidence, { recursive: true });
      const mobile = sport === "afl";
      const viewport = mobile
        ? { width: 412, height: 850 }
        : { width: 1366, height: 900 };
      const context = await browser.newContext({
        ...(mobile ? devices["Pixel 5"] : {}),
        viewport,
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
        ...(mobile
          ? { recordVideo: { dir: evidence + "/recording", size: viewport } }
          : {}),
      });
      const page = await context.newPage();
      if (mobile) {
        await page.addInitScript(() => {
          Object.defineProperties(navigator, {
            canShare: { value: () => true, configurable: true },
            share: {
              configurable: true,
              value: async ({ files }: ShareData) => {
                document.documentElement.dataset.sharedFile = files?.[0]?.type;
              },
            },
          });
        });
      }
      const receipt = previewPackReceipt(sport);
      const errors: string[] = [];
      const observed: Array<{
        tier: string;
        colour: string;
        elapsedMs: number;
      }> = [];
      let opens = 0;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/receipt") return route.fulfill({ json: null });
        if (path === "/open-pack") {
          opens++;
          return route.fulfill({ json: receipt });
        }
        return route.fulfill(await packFixtureMarkup(path));
      });
      try {
        await mountPackFixture(page);
        await page.getByRole("button", { name: "Open pack seal" }).click();
        const phase = page.locator(revealPhase);
        await expect(phase).toHaveAttribute(
          "data-pack-reveal-phase",
          "mystery",
        );
        await page.locator(".pack-opening").evaluate((viewer, selector) => {
          const observations: unknown[] = [];
          let previous: string | undefined;
          // Record each phase in the document. Test-runner polling can miss a
          // short flip on a busy host even when the page presented it correctly.
          new MutationObserver(() => {
            const stage = viewer.querySelector<HTMLElement>(selector);
            const phase = stage?.dataset.packRevealPhase;
            if (!stage || !phase || phase === previous) return;
            previous = phase;
            observations.push({
              phase,
              tier: stage.dataset.tier,
              name: viewer.querySelector("h3")?.textContent?.trim() ?? null,
              label: stage.querySelector(".pack-reveal-tier")?.textContent,
              colour: getComputedStyle(stage)
                .getPropertyValue("--reveal-accent")
                .trim(),
              at: performance.now(),
            });
            document.documentElement.dataset.revealObservations =
              JSON.stringify(observations);
          }).observe(viewer, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["data-pack-reveal-phase"],
          });
        }, revealPhase);
        const cards = mobile ? receipt.cards : receipt.cards.slice(0, 6);
        for (const [index, card] of cards.entries()) {
          const name = page.getByRole("heading", {
            name: card.name,
            exact: true,
          });
          const progress = "Card " + (index + 1) + " of 9";
          await expect(phase).toHaveAttribute(
            "data-pack-reveal-phase",
            "mystery",
          );
          await expect(phase).not.toHaveAttribute("data-tier");
          await expect(page.getByText(progress, { exact: true })).toBeVisible();
          await expect(name).toHaveCount(0);
          await expect(phase.locator(".fantasy-card")).toHaveCount(0);
          if (mobile && index === 0) {
            await page.screenshot({ path: evidence + "/afl-mystery.png" });
          }

          await page
            .getByRole("button", { name: "Reveal card" })
            .click({ force: true });
          if (mobile && (card.tier === "LEGENDARY" || card.tier === "ICON")) {
            await expect(phase).toHaveAttribute(
              "data-pack-reveal-phase",
              "rarity",
            );
            await page.screenshot({
              path:
                evidence + "/afl-" + card.tier.toLowerCase() + "-rarity.png",
            });
          }
          await expect(phase).toHaveAttribute(
            "data-pack-reveal-phase",
            "revealed",
          );
          const phases = JSON.parse(
            (await page
              .locator("html")
              .getAttribute("data-reveal-observations")) ?? "[]",
          ) as Array<{
            phase: string;
            tier: string;
            name: string | null;
            label?: string;
            colour: string;
            at: number;
          }>;
          const [rarity, flip, revealed] = phases.slice(-3);
          expect([rarity.phase, flip.phase, revealed.phase]).toEqual([
            "rarity",
            "flipping",
            "revealed",
          ]);
          expect([rarity.tier, flip.tier, revealed.tier]).toEqual([
            card.tier,
            card.tier,
            card.tier,
          ]);
          expect([rarity.name, flip.name, revealed.name]).toEqual([
            null,
            null,
            card.name,
          ]);
          expect(rarity.label).toBe(rarityRule(card.tier).label);
          const expectedColour: Partial<Record<string, string>> = {
            ULTRA_RARE: "#ff56d8",
            LEGENDARY: "#ffc24b",
            ICON: "#f6faff",
          };
          expect(rarity.colour).toBe(
            expectedColour[card.tier] ?? rarityPresentation(card.tier).accent,
          );
          observed.push({
            tier: card.tier,
            colour: rarity.colour,
            elapsedMs: Math.round(revealed.at - rarity.at),
          });
          await expect(name).toBeAttached();
          await expect(phase.locator(".fantasy-card")).toContainText(card.name);
          await expect(phase.locator(".fantasy-card")).toContainText(
            new RegExp(rarityRule(card.tier).label, "i"),
          );
          const cardBounds = await phase.locator(".fantasy-card").boundingBox();
          expect(cardBounds).not.toBeNull();
          expect(cardBounds!.x).toBeGreaterThanOrEqual(0);
          expect(cardBounds!.x + cardBounds!.width).toBeLessThanOrEqual(
            viewport.width,
          );
          if (index < 6) {
            await page.screenshot({
              path:
                evidence +
                "/" +
                sport +
                "-" +
                card.tier.toLowerCase() +
                "-revealed.png",
            });
          }
          if (mobile && (card.tier === "LEGENDARY" || card.tier === "ICON")) {
            await page.getByRole("button", { name: "Share My Pull" }).click();
            const share = page.getByRole("dialog", { name: "Share your pull" });
            await expect(
              share.getByRole("button", { name: "Save Image" }),
            ).toBeEnabled();
            const image = share.getByRole("img", {
              name: new RegExp(card.name),
            });
            await expect
              .poll(() =>
                image.evaluate((el: HTMLImageElement) => [
                  el.naturalWidth,
                  el.naturalHeight,
                ]),
              )
              .toEqual([1080, 1920]);
            await page.screenshot({
              path: evidence + "/afl-" + card.tier.toLowerCase() + "-share.png",
            });
            const download = page.waitForEvent("download");
            await share.getByRole("button", { name: "Save Image" }).click();
            await (
              await download
            ).saveAs(
              evidence + "/afl-" + card.tier.toLowerCase() + "-pull.png",
            );
            await share.getByRole("button", { name: "Share Image" }).click();
            await expect(page.locator("html")).toHaveAttribute(
              "data-shared-file",
              "image/png",
            );
            await share.getByRole("button", { name: /close/i }).click();
          }
          if (index < cards.length - 1) {
            await page
              .getByRole("button", { name: "Reveal next card" })
              .click();
          }
        }
        if (mobile) {
          await page.getByRole("button", { name: "View pack summary" }).click();
        } else {
          await page
            .getByRole("button", { name: "Reveal All", exact: true })
            .click();
        }
        const summary = page.locator(".pack-summary li");
        await expect(summary).toHaveCount(9);
        await expect(summary.locator("strong")).toHaveText(
          receipt.cards.map((card) => card.name),
        );
        await expect(page.locator(".pack-best-pull")).toContainText(
          "Best pull",
        );
        await expect(page.locator(".pack-best-pull")).toContainText(
          receipt.cards[5].name,
        );
        await expect(
          page.getByRole("link", { name: "View Collection" }),
        ).toBeVisible();
        await page.screenshot({
          path: evidence + "/" + sport + "-summary.png",
          fullPage: true,
        });
        expect(opens).toBe(1);
        expect(new Set(observed.map((card) => card.colour)).size).toBe(6);
        expect(errors).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await writeFile(
          evidence + "/" + sport + "-timing.json",
          JSON.stringify(
            {
              viewport,
              cards: observed,
              opens,
              device: mobile ? "Mobile Chromium emulation" : "Desktop Chromium",
            },
            null,
            2,
          ),
        );
      } finally {
        await context.close();
        if (mobile)
          await page.video()!.saveAs(evidence + "/afl-nine-card-reveal.webm");
      }
    },
  );
}

test("skip, rapid taps and background interruption finish the same awarded card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const receipt = previewPackReceipt("afl");
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
  await mountPackFixture(page);
  await page.getByRole("button", { name: "Open pack seal" }).dblclick();
  const phase = page.locator(revealPhase);
  const reveal = page.getByRole("button", { name: "Reveal card" });
  await reveal.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "rarity");
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
  await expect(phase.locator(".fantasy-card")).toContainText(
    receipt.cards[0].name,
  );

  const next = page.getByRole("button", { name: "Reveal next card" });
  await next.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(page.getByText("Card 2 of 9", { exact: true })).toBeVisible();
  await reveal.click();
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "rarity");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(phase).toHaveAttribute("data-pack-reveal-phase", "revealed");
  await expect(phase.locator(".fantasy-card")).toContainText(
    receipt.cards[1].name,
  );
  await page.getByRole("button", { name: "Reveal All", exact: true }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(9);
  expect(opens).toBe(1);
});
