import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../../src/core/member-test-wallet";

for (const scenario of ["success", "rejected"] as const) {
  test(`purchase transition is truthful and recoverable: ${scenario}`, async ({
    page,
  }) => {
    let state = packFixture();
    let purchases = 0;
    const initialBalance = wallet(state, packMember.id).spendable;
    let releaseBuy!: () => void;
    let releaseOpen!: () => void;
    const buyGate = new Promise<void>((r) => {
      releaseBuy = r;
    });
    const openGate = new Promise<void>((r) => {
      releaseOpen = r;
    });
    const script = await bundleCommunityFixture(
      "tests/fixtures/pack-shopping.tsx",
    );
    const css = (
      await Promise.all(
        [
          "globals",
          "fantasy",
          "pack-shop",
          "pack-opening",
          "pack-cinematic",
          "pack-cinema-v2",
          "test-wallet",
        ].map((s) => readFile(`src/app/${s}.css`, "utf8")),
      )
    ).join("\n");
    await page.route("**/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/test-wallet") {
        if (route.request().method() === "POST") {
          const { request, command } = route.request().postDataJSON();
          if (command.kind === "buy-pack") {
            purchases++;
            await buyGate;
          } else if (command.kind === "open-pack") await openGate;
          if (scenario === "rejected")
            return route.fulfill({
              status: 409,
              json: {
                outcome: "rejected",
                error: "Pack unavailable. No credits deducted.",
              },
            });
          const executed = executeCredits(
            state,
            packMember,
            request,
            command,
            packNow,
          );
          state = executed.state;
          return route.fulfill({
            headers: {
              "Server-Timing": "purchase_total;dur=10, purchase_issue;dur=3",
            },
            json: {
              state: memberTestView(state, packMember.id, [], false, packNow),
              result:
                command.kind === "open-pack"
                  ? testReceipt(state, command.entitlement, packMember.id)
                  : executed.result,
            },
          });
        }
        return route.fulfill({
          json: {
            state: memberTestView(state, packMember.id, [], false, packNow),
          },
        });
      }
      if (path.startsWith("/brand/")) {
        try {
          return route.fulfill({
            body: await readFile("public" + path),
            contentType: path.endsWith(".svg") ? "image/svg+xml" : "image/webp",
          });
        } catch {
          return route.fulfill({ status: 404 });
        }
      }
      if (path.startsWith("/api/")) return route.fulfill({ json: {} });
      return route.fulfill({
        contentType: "text/html",
        body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="fantasy-mode"><main id="fixture-root"></main><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`,
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("https://fixture.invalid/fantasy/cards?packs=buy");
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    const confirm = page.getByRole("button", {
      name: "Confirm Purchase",
      exact: true,
    });
    await confirm.dblclick();
    await expect(
      page.getByRole("heading", { name: "Processing purchase", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirming…", exact: true }),
    ).toBeDisabled();
    expect(purchases).toBe(1);
    expect(wallet(state, packMember.id).spendable).toBe(initialBalance);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toHaveCount(0);
    await mkdir("docs/qa/scoring-pack-20261108", { recursive: true });
    await page.screenshot({
      path: `docs/qa/scoring-pack-20261108/purchase-processing-${scenario}.png`,
    });
    if (scenario === "success") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await page
          .locator(".purchase-transition-pack")
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("none");
    }
    releaseBuy();
    if (scenario === "rejected") {
      await expect(
        page.getByRole("button", { name: "Refresh packs and review again" }),
      ).toBeVisible();
      expect(wallet(state, packMember.id).spendable).toBe(initialBalance);
      expect(Object.keys(state.economy!.instances)).toHaveLength(0);
      return;
    }
    await expect(
      page.getByRole("heading", { name: "Securing your cards", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toHaveCount(0);
    expect(Object.keys(state.economy!.instances)).toHaveLength(9);
    releaseOpen();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeVisible();
    expect(purchases).toBe(1);
    expect(Object.keys(state.economy!.instances)).toHaveLength(9);
    const timings = await page.evaluate(() =>
      performance
        .getEntriesByType("measure")
        .filter((e) => e.name.startsWith("docked.purchase."))
        .map((e) => ({
          name: e.name,
          detail: (e as PerformanceMeasure).detail,
        })),
    );
    expect(
      timings.some(
        (t) =>
          t.name === "docked.purchase.test-credit.purchase" &&
          t.detail.server.purchase_total === 10,
      ),
    ).toBe(true);
    expect(JSON.stringify(timings)).not.toContain(packMember.id);
  });
}
