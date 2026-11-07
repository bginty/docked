import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../../src/core/member-test-wallet";

for (const recovery of ["dialog", "refresh", "timeout"] as const) {
  test(`lost purchase response recovers once through ${recovery}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    let state = packFixture();
    const requests: string[] = [];
    let loseResponse = true;
    const before = wallet(state, packMember.id).spendable;
    const product = memberTestView(
      state,
      packMember.id,
      [],
      false,
      packNow,
    ).products.find((p) => p.tier === "PREMIUM" && p.cards === 9)!;
    const script = await bundleCommunityFixture(
      "tests/fixtures/pack-shopping.tsx",
    );
    const css = (
      await Promise.all(
        ["globals", "fantasy", "pack-shop", "pack-opening", "test-wallet"].map(
          (n) => readFile(`src/app/${n}.css`, "utf8"),
        ),
      )
    ).join("\n");
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/test-wallet") {
        if (route.request().method() === "POST") {
          const { request, command } = route.request().postDataJSON();
          requests.push(request);
          const executed = executeCredits(
            state,
            packMember,
            request,
            command,
            packNow,
          );
          state = executed.state; // The server committed even if the client lost its reply.
          if (loseResponse) {
            loseResponse = false;
            if (recovery === "timeout") {
              await new Promise((resolve) => setTimeout(resolve, 16500));
              return route
                .fulfill({
                  json: {
                    state: memberTestView(
                      state,
                      packMember.id,
                      [],
                      false,
                      packNow,
                    ),
                    result: executed.result,
                  },
                })
                .catch(() => {});
            }
            return route.abort("connectionreset");
          }
          const result =
            command.kind === "open-pack"
              ? testReceipt(state, command.entitlement, packMember.id)
              : executed.result;
          return route.fulfill({
            json: {
              state: memberTestView(state, packMember.id, [], false, packNow),
              result,
            },
          });
        }
        return route.fulfill({
          json: {
            state: memberTestView(state, packMember.id, [], false, packNow),
          },
        });
      }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
      if (url.pathname.startsWith("/brand/")) {
        try {
          return route.fulfill({
            body: await readFile("public" + url.pathname),
            contentType: url.pathname.endsWith(".svg")
              ? "image/svg+xml"
              : "image/png",
          });
        } catch {
          return route.fulfill({ status: 404 });
        }
      }
      return route.fulfill({
        contentType: "text/html",
        body: `<html><head><style>${css}</style></head><body class="fantasy-mode"><main id="fixture-root"></main><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`,
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("https://fixture.invalid/fantasy/cards?packs=buy");
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check pending purchase" }),
    ).toBeVisible({ timeout: 20000 });
    expect(wallet(state, packMember.id).spendable).toBe(before - product.price);
    expect(Object.keys(state.economy!.instances)).toHaveLength(9);
    if (recovery === "refresh") {
      await page.reload();
      await page
        .getByRole("button", { name: "Retry pending transaction" })
        .click();
    } else
      await page
        .getByRole("button", { name: "Check pending purchase" })
        .click();
    await expect(
      page.getByRole("button", { name: "Reveal card", exact: true }),
    ).toBeVisible();
    expect(requests[0]).toBe(requests[1]);
    expect(wallet(state, packMember.id).spendable).toBe(before - product.price);
    expect(Object.keys(state.economy!.instances)).toHaveLength(9);
    expect(Object.keys(state.economy!.packs)).toHaveLength(1);
  });
}
