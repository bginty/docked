import { test, expect } from "@playwright/test";
import { retiredProductRoots } from "../../src/core/retired-product";
test("saved betting URLs and APIs are permanently unavailable while fantasy routes remain", async ({
  request,
  page,
}) => {
  test.setTimeout(120000);
  for (const root of retiredProductRoots) {
    const r = await request.get(root);
    expect(r.status(), root).toBe(410);
  }
  const old = await request.post("/api/edges", { data: { probability: 0.99 } });
  expect(old.status()).toBe(410);
  for (const tab of ["play", "cards", "market", "social", "profile"]) {
    const r = await request.get("/fantasy/" + tab);
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("Gameplay is not enabled");
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "COLLECT.",
  );
  await expect(page.locator("body")).not.toContainText(
    /BUILT FOR AN EDGE|Edge Signal|Today.s edges|My Edge/,
  );
  await page.screenshot({
    path: "docs/qa/fantasy-cleanup/homepage-actual-local.png",
    fullPage: true,
  });
});
