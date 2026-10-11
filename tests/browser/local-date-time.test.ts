import { test, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
test.use({ timezoneId: "Australia/Sydney", locale: "en-AU" });
test("UTC server markup hydrates into Sydney deadline without mismatch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(
    '<main id="fixture-root"><time dateTime="2026-10-16T00:15:00+00:00">2026-10-16 00:15 UTC</time></main>',
  );
  await page.addScriptTag({
    content: await bundleCommunityFixture(
      "tests/fixtures/local-date-time-hydration.tsx",
    ),
  });
  await expect(page.locator("time")).toContainText("11:15");
  expect(errors).toEqual([]);
});
