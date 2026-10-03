import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../fixtures/bundle-community";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { evidenceRoot } from "./evidence";

const output = path.join(evidenceRoot, "mobile-app");
const views = ["edges", "feed", "following", "points", "my-edge"];
let bundle = "",
  markup: Record<string, string> = {};
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  bundle = await bundleCommunityFixture();
  markup = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-experience.ts"],
      { encoding: "utf8" },
    ),
  );
});
async function fixture(page: Page, view: string, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "Isolated DEMO: no operation accepted." },
    }),
  );
  await page.goto("/offline.html");
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>DEMO mobile acceptance</title><meta name="robots" content="noindex,nofollow"></head><body><main id="demo-root"></main></body></html>',
  );
  for (const file of [
    "brand-theme.css",
    "globals.css",
    "sports-visuals.css",
    "sports-experience.css",
    "community-app.css",
    "native.css",
    "mobile-app.css",
  ])
    await page.addStyleTag({ path: path.resolve("src/app", file) });
  await page.addStyleTag({
    content:
      ".demo-label{padding:6px 12px;background:var(--brand-navy);color:var(--brand-white);font-size:10px;line-height:1.5}.community-shell{min-height:100vh}",
  });
  await page.evaluate(
    (value) =>
      Object.assign(window, {
        demoOfficialHtml: value.active,
        demoCompactHtml: value.compact_active,
      }),
    markup,
  );
  await page.addScriptTag({ content: bundle });
  await render(page, view);
  return errors;
}
async function render(page: Page, view: string) {
  await page.evaluate(
    (name) => (window as any).renderDemo(`mobile-${name}`),
    view,
  );
  await expect(page.getByRole("note")).toContainText(
    "NO AUTHENTICATED SESSION",
  );
}
async function check(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
}
for (const width of [360, 390, 412, 1366]) {
  test(`approved five-tab mobile composition, contrast and content clearance at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors = await fixture(page, "edges", width);
    for (const view of views) {
      await render(page, view);
      const nav = page.getByRole("navigation", {
        name: width <= 760 ? "Mobile app navigation" : "App navigation",
        exact: true,
      });
      await expect(nav.getByRole("link")).toHaveText([
        "Edges",
        "Feed",
        "Following",
        "Points",
        "My Edge",
      ]);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
        "href",
        `/${view}`,
      );
      await expect(page.locator("h1")).toHaveCount(1);
      if (width <= 760) {
        expect(
          (await page.locator(".app-topbar").boundingBox())!.height,
        ).toBeLessThanOrEqual(64);
        for (const link of await nav.getByRole("link").all()) {
          const box = (await link.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        const content = await page.locator(".app-footnote").boundingBox();
        const bottom = await nav.boundingBox();
        expect(content!.y + content!.height).toBeLessThanOrEqual(bottom!.y + 1);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await check(page);
      await page.screenshot({
        path: path.join(output, `DEMO-${view}-${width}.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: path.join(output, `DEMO-${view}-${width}-viewport.png`),
      });
    }
    expect(errors).toEqual([]);
    await writeFile(
      path.join(output, `DEMO-${width}.json`),
      JSON.stringify(
        {
          width,
          views,
          errors,
          fixtures: true,
          authenticatedSession: false,
          statement:
            "Production presentation components rendered with isolated labelled data. No API writes or real performance.",
        },
        null,
        2,
      ),
    );
  });
}

test("mobile null metrics, profile controls and compact locked quotes remain honest", async ({
  page,
}) => {
  await fixture(page, "points");
  await expect(
    page.getByRole("heading", { name: "Your points" }),
  ).toBeVisible();
  await expect(page.getByText("Not enabled", { exact: true })).toHaveCount(2);
  await expect(page.locator(".member-metrics").first()).toContainText(
    "Unavailable",
  );
  await render(page, "my-edge");
  await expect(
    page.getByRole("link", { name: /Edit profile/ }),
  ).toHaveAttribute("href", "/profile#edit");
  const requests: any[] = [];
  await page.route("**/api/auth", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  expect(requests).toEqual([{ action: "logout" }]);
  await render(page, "edge-record");
  await expect(page.locator(".compact-edge-card")).toContainText(
    "Locked estimate",
  );
  await expect(page.locator(".compact-edge-card")).toContainText(
    "Estimated EV is not guaranteed profit",
  );
  await expect(page.locator(".compact-edge-card")).toContainText("1.95");
  await expect(page.locator(".compact-edge-card")).toContainText("2.00");
  await check(page);
});

test("mobile safe insets and keyboard occlusion preserve controls", async ({
  page,
}) => {
  await fixture(page, "compose");
  await page.evaluate(() => {
    document.documentElement.classList.add("docked-native");
    document.documentElement.style.setProperty("--safe-area-inset-top", "24px");
    document.documentElement.style.setProperty(
      "--safe-area-inset-bottom",
      "24px",
    );
    document.documentElement.style.setProperty("--safe-area-inset-left", "8px");
    document.documentElement.style.setProperty(
      "--safe-area-inset-right",
      "8px",
    );
  });
  const nav = page.locator(".app-bottom-nav");
  await expect(nav).toBeVisible();
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  const textarea = page.locator("textarea").first();
  await textarea.fill(
    "DEMO keyboard check. Long text remains editable and no request is sent. ".repeat(
      4,
    ),
  );
  await expect(nav).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 420,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".community-shell")).toHaveAttribute(
    "data-keyboard-open",
    "true",
  );
  await expect(nav).toBeHidden();
  await textarea.blur();
  await expect(nav).toBeVisible();
  await check(page);
  await page.screenshot({
    path: path.join(output, "DEMO-safe-area-keyboard.png"),
    fullPage: true,
  });
});

test("all app destinations reject anonymous data access and preserve direct URL routing", async ({
  page,
}) => {
  for (const route of ["/feed", "/following", "/points", "/my-edge"]) {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Sign in to your verified account" }),
    ).toBeVisible();
    await expect(page.locator(".app-bottom-nav")).toHaveCount(0);
    await page.reload({ waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe(route);
  }
  await page.goto("/home", { waitUntil: "networkidle" });
  expect(new URL(page.url()).pathname).toBe("/edges");
  await page.goto("/home?tab=following&sport=football", {
    waitUntil: "networkidle",
  });
  expect(new URL(page.url()).pathname).toBe("/following");
  expect(new URL(page.url()).searchParams.get("sport")).toBe("football");
});

test("continuous feed appends unique posts and clears revoked or changed account content", async ({
  page,
}) => {
  await fixture(page, "feed");
  const post = await page.evaluate(() => (window as any).demoPost);
  const requests: string[] = [];
  await page.route("**/api/community?**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      json: {
        status: "ready",
        message: "",
        viewer: post.author,
        posts: [
          post,
          {
            ...post,
            id: "33333333-3333-4333-8333-333333333335",
            body: "DEMO appended older post",
          },
        ],
        profiles: [],
        nextCursor: "fixture-next",
      },
    });
  });
  await page
    .getByRole("button", { name: "Load more posts", exact: true })
    .click();
  await expect(page.locator(".social-timeline .social-card")).toHaveCount(3);
  await expect(
    page.getByText("DEMO appended older post", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]).searchParams.get("cursor")).toBe(
    "fixture-cursor",
  );
  await page.route("**/api/community?**", (route) =>
    route.fulfill({ status: 403, json: { error: "DEMO revoked access" } }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("docked:community-updated")),
  );
  await expect(page.locator(".social-timeline .social-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Community feed unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("DEMO appended older post", { exact: true }),
  ).toHaveCount(0);
  await check(page);
});

test("bounded timeline continues from the first unconsumed page without dropping posts", async ({
  page,
}) => {
  await fixture(page, "feed");
  const post = await page.evaluate(() => (window as any).demoPost);
  await page.evaluate((base) => {
    Object.assign(window, {
      demoTimelinePosts: Array.from({ length: 19 }, (_, index) => ({
        ...base,
        id: `fixture-initial-${index}`,
        body: `DEMO initial record ${index}`,
      })),
    });
  }, post);
  await render(page, "feed");
  let pages = 0;
  await page.route("**/api/community?**", (route) => {
    pages++;
    return route.fulfill({
      json: {
        status: "ready",
        message: "",
        viewer: post.author,
        posts: Array.from({ length: 20 }, (_, index) => ({
          ...post,
          id: `fixture-page-${pages}-${index}`,
          body: `DEMO page ${pages} record ${index}`,
        })),
        profiles: [],
        nextCursor: `unconsumed-${pages}`,
      },
    });
  });
  for (let count = 1; count <= 4; count++) {
    await page
      .getByRole("button", { name: "Load more posts", exact: true })
      .click();
    await expect(page.locator(".social-timeline .social-card")).toHaveCount(
      19 + 20 * count,
    );
  }
  expect(pages).toBe(4);
  await expect(
    page.getByRole("button", { name: "Load more posts", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Continue with older posts" }),
  ).toHaveAttribute("href", "/feed?tab=for_you&cursor=unconsumed-4");
  await expect(
    page.getByText("DEMO page 4 record 19", { exact: true }),
  ).toBeVisible();
});

for (const width of [360, 390, 412, 1366]) {
  test(`DEMO Following suggestions retain readable identity, badge contrast and actions at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors = await fixture(page, "following-suggestions", width);
    const rows = page.locator(".member-list > .member-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("DEMO Docked Official");
    await expect(rows.last()).toContainText(
      "DEMO Alexandria Montgomery Sports Perspective",
    );
    const dimensions = [];
    for (const row of await rows.all()) {
      const copy = (await row.locator(".member-copy").boundingBox())!;
      const name = (await row.locator(".social-author-name").boundingBox())!;
      // Previously the control group's intrinsic width squeezed the identity
      // into a three-character column, despite no document-level overflow.
      expect(copy.width).toBeGreaterThanOrEqual(140);
      expect(name.height).toBeLessThanOrEqual(100);
      const follow = row.getByRole("button", { name: "Follow", exact: true });
      const controls = row
        .locator("summary")
        .filter({ hasText: "Member controls" });
      await expect(follow).toBeVisible();
      await expect(controls).toBeVisible();
      for (const target of [follow, controls]) {
        const box = (await target.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      dimensions.push({ identityWidth: copy.width, nameHeight: name.height });
    }
    await expect(rows.first().locator(".official-badge")).toBeVisible();
    await check(page);
    await page.screenshot({
      path: path.join(output, `DEMO-following-suggestions-${width}.png`),
      fullPage: true,
    });
    const requests: unknown[] = [];
    await page.route("**/api/community", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    await rows
      .first()
      .getByRole("button", { name: "Follow", exact: true })
      .click();
    expect(requests).toEqual([
      {
        action: "follow",
        profileId: "11111111-1111-4111-8111-111111111112",
        enabled: true,
      },
    ]);
    await expect(
      rows.first().getByRole("button", { name: "Unfollow", exact: true }),
    ).toBeVisible();
    await expect(rows.first().getByRole("checkbox")).not.toBeChecked();
    await rows
      .first()
      .locator("summary")
      .filter({ hasText: "Member controls" })
      .click();
    await expect(
      rows.first().getByRole("button", { name: "Mute", exact: true }),
    ).toBeVisible();
    await expect(
      rows.first().getByRole("button", { name: "Block", exact: true }),
    ).toBeVisible();
    await check(page);
    if (width === 390) {
      await page.evaluate(() =>
        (window as any).renderDemo("mobile-my-edge", {
          isOfficial: true,
          displayName: "DEMO Official Account",
          handle: "demo_official",
        }),
      );
      await expect(
        page.locator(".member-identity .official-badge"),
      ).toBeVisible();
      await check(page);
      await page.screenshot({
        path: path.join(output, "DEMO-official-member-identity-390.png"),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    await writeFile(
      path.join(output, `DEMO-following-suggestions-${width}.json`),
      JSON.stringify(
        {
          width,
          fixtures: true,
          authenticatedSession: false,
          realWrites: false,
          identityDimensions: dimensions,
          axeViolations: 0,
          pageErrors: 0,
          statement:
            "Isolated DEMO official and long-name suggestions; actual presentation and handlers, intercepted fictional follow response only.",
        },
        null,
        2,
      ),
    );
  });
}
