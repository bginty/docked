import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base = "http://127.0.0.1:3023";
for (const width of [412, 1440])
  test(`Premium authoritative panel and Standard disclosure at ${width}px`, async ({
    page,
  }) => {
    await mkdir("docs/qa/premium-v3", { recursive: true });
    await page.setViewportSize({ width, height: 915 });
    await page.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    await page.goto(base + "/fantasy/test-wallet#packs");
    const panel = page
      .locator("#packs article")
      .filter({ has: page.getByRole("heading", { name: /Premium/ }) })
      .first();
    await expect(panel).toContainText(
      "9 cards · Ultra Rare or better on every card",
    );
    await expect(panel).toContainText(
      "Every card is guaranteed Ultra Rare or better. Legendary and Icon cards are not guaranteed.",
    );
    await panel.locator(".pack-chances summary").click();
    for (const [rarity, percent] of [
      ["Ultra Rare", "90%"],
      ["Legendary", "9.9%"],
      ["Icon", "0.1%"],
    ]) {
      const row = panel
        .getByRole("row")
        .filter({ has: page.getByRole("cell", { name: rarity, exact: true }) });
      await expect(row.getByRole("cell").last()).toHaveText(percent);
    }
    await expect(panel).toContainText("Core, Rare, Elite: not included.");
    await expect(panel).not.toContainText("No guaranteed rarity");
    await expect(panel.getByRole("row")).toHaveCount(4);
    await panel.screenshot({ path: `docs/qa/premium-v3/premium-${width}.png` });
    await panel.locator(".pack-terms summary").click();
    await expect(panel).toContainText("premium-nine-seven-test-v3");
    await expect(panel).toContainText("completed-pack frequencies may differ");
    const standard = page
      .locator("#packs article")
      .filter({ has: page.getByRole("heading", { name: /Standard/ }) })
      .first();
    await standard.locator(".pack-chances summary").click();
    await expect(standard.getByRole("row")).toHaveCount(6);
    for (const percent of ["85%", "12%", "2.5%", "0.49%", "0.01%"])
      await expect(
        standard.getByRole("cell", { name: percent, exact: true }),
      ).toBeVisible();
    await standard.locator(".pack-terms summary").click();
    await expect(standard).toContainText("No guaranteed rarity.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("local HTTP purchase uses displayed version, explicit consent, and persisted nine-card results", async ({
  page,
}) => {
  await page.goto(base + "/fantasy/test-wallet#packs");
  const panel = page
    .locator("#packs article")
    .filter({ has: page.getByRole("heading", { name: /Premium/ }) })
    .first();
  let review = "";
  page.once("dialog", async (d) => {
    review = d.message();
    await d.accept();
  });
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/test-wallet") && r.request().method() === "POST",
  );
  await panel.getByRole("button", { name: /Buy/ }).click();
  const res = await response;
  expect(review).toContain("Ultra Rare or better on every card");
  expect(res.ok()).toBe(true);
  const sent = res.request().postDataJSON();
  expect(sent.command.configuration).toBe("premium-nine-seven-test-v3");
  const body = await res.json();
  const packId = body.result.entitlement;
  const wallet = body.state.wallet;
  const again = await page.request.post(base + "/api/test-wallet", {
    data: sent,
  });
  expect((await again.json()).state.wallet).toEqual(wallet);
  const opened = await page.request.post(base + "/api/test-wallet", {
    data: {
      request: "browser-open-" + packId,
      command: { kind: "open-pack", entitlement: packId },
    },
  });
  const first = await opened.json();
  const receipt = first.state.packs.find(
    (p: { id: string }) => p.id === packId,
  ).receipt;
  expect(receipt.cards).toHaveLength(9);
  expect(
    receipt.cards.every((c: { tier: string }) =>
      ["ULTRA_RARE", "LEGENDARY", "ICON"].includes(c.tier),
    ),
  ).toBe(true);
  await page.reload();
  const reopened = await page.request.post(base + "/api/test-wallet", {
    data: {
      request: "browser-replay-" + packId,
      command: { kind: "open-pack", entitlement: packId },
    },
  });
  expect(
    (await reopened.json()).state.packs.find(
      (p: { id: string }) => p.id === packId,
    ).receipt,
  ).toEqual(receipt);
});
