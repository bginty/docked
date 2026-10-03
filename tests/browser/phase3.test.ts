import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { evidenceRoot } from "./evidence";
let demoBundle = "";
let demoOfficialHtml = "";
const fixtureErrors = new WeakMap<Page, string[]>();
const qa = path.join(evidenceRoot, "web-regression");
test.beforeAll(async () => {
  await mkdir(qa, { recursive: true });
  demoOfficialHtml = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/fixtures/render-experience.ts"],
      { encoding: "utf8" },
    ),
  ).active;
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [path.resolve("tests/fixtures/community-demo.tsx")],
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-node-read-fixture",
        setup(b) {
          // Node reads avoid native parent-directory enumeration in the Windows sandbox.
          // This fixture resolver never changes production module resolution.
          b.onResolve({ filter: /.*/ }, (args) => {
            let target: string;
            if (/^next\/(navigation|link)$/.test(args.path))
              target = path.resolve(
                "tests/fixtures/community-framework-shim.tsx",
              );
            else if (args.path.startsWith("@/"))
              target = path.resolve("src", args.path.slice(2));
            else if (path.isAbsolute(args.path)) target = args.path;
            else if (args.path.startsWith("."))
              target = path.resolve(path.dirname(args.importer), args.path);
            else
              target = createRequire(
                args.importer || path.resolve("package.json"),
              ).resolve(args.path);
            const file = [
              target,
              target + ".tsx",
              target + ".ts",
              target + ".js",
              path.join(target, "index.js"),
            ].find(existsSync);
            if (!file)
              throw new Error(`Unresolved fixture module: ${args.path}`);
            return { path: file, namespace: "fixture-source" };
          });
          b.onLoad({ filter: /.*/, namespace: "fixture-source" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".json")
                  ? "json"
                  : "jsx",
          }));
        },
      },
    ],
  });
  demoBundle = result.outputFiles[0].text;
});
async function fixture(page: Page, view = "home", width = 390) {
  const runtimeErrors: string[] = [];
  fixtureErrors.set(page, runtimeErrors);
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "DEMO request requires an explicit test response.",
      }),
    }),
  );
  await page.goto("/offline.html");
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>DEMO isolated community review</title><meta name="robots" content="noindex,nofollow"></head><body><main id="demo-root"></main></body></html>',
  );
  for (const file of [
    "globals.css",
    "sports-visuals.css",
    "sports-experience.css",
    "community-app.css",
  ])
    await page.addStyleTag({ path: path.join(process.cwd(), "src/app", file) });
  await page.addStyleTag({
    content:
      ".demo-label{padding:12px;background:#62480e;color:#fff;font:700 12px/1.6 Arial,sans-serif;position:relative;z-index:60}.community-shell{min-height:90vh}",
  });
  await page.evaluate((html) => {
    Object.assign(window, { demoOfficialHtml: html });
  }, demoOfficialHtml);
  await page.addScriptTag({ content: demoBundle });
  expect(runtimeErrors).toEqual([]);
  await page.evaluate((view) => (window as any).renderDemo(view), view);
  await expect(page.getByRole("note")).toContainText("DEMO");
}
async function accessible(page: Page) {
  expect(fixtureErrors.get(page) ?? []).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const width of [390, 430, 768, 1366, 1920])
  test(`Phase3 public gates and disabled previews remain accessible at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const routes = {
      home: "/home",
      community: "/community",
      compose: "/compose",
      profile: "/profile",
      top: "/top-docked",
      notifications: "/notifications",
      search: "/search",
      membership: "/membership",
      competitions: "/competitions",
      deals: "/deals",
      moderation: "/admin/community/reports",
      audit: "/admin/community/leaderboard-audit",
    };
    for (const [name, route] of Object.entries(routes)) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(
        page.locator('nav[aria-label="Mobile app navigation"]'),
      ).toHaveCount(0);
      await accessible(page);
      await page.screenshot({
        path: path.join(qa, `${name}-${width}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    if (width === 390) {
      const shareDenied = await page.request.get(
        "/api/community-edges/share?id=22222222-2222-4222-8222-222222222222",
      );
      expect(shareDenied.status()).toBe(403);
      expect(shareDenied.headers()["cache-control"]).toContain("private");
      expect(shareDenied.headers()["cache-control"]).toContain("no-store");
      expect(shareDenied.headers()["content-type"]).not.toContain("image/png");
    }
    await writeFile(
      path.join(qa, `public-${width}.json`),
      JSON.stringify(
        {
          buildId: readFileSync(
            path.join(process.cwd(), ".next/BUILD_ID"),
            "utf8",
          ).trim(),
          width,
          routes: Object.values(routes),
          errors,
          violations: 0,
          overflow: false,
        },
        null,
        2,
      ),
    );
  });
test("DEMO app hierarchy, all outcomes, provisional ranking and touch navigation", async ({
  page,
}) => {
  for (const width of [390, 430, 768, 1366, 1920]) {
    await fixture(page, "home", width);
    const pinned = await page
      .getByRole("heading", { name: "DOCKED EDGES", exact: true })
      .boundingBox();
    const discussion = await page
      .getByRole("heading", { name: "Community discussion", exact: true })
      .boundingBox();
    expect(pinned!.y).toBeLessThan(discussion!.y);
    await accessible(page);
    await page.screenshot({
      path: path.join(qa, `DEMO-home-${width}.png`),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(qa, `DEMO-home-${width}-viewport.png`),
      fullPage: false,
    });
  }
  await page.evaluate(() => (window as any).renderDemo("profile"));
  await expect(page.getByText("LOST", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".profile-metric")
      .filter({ hasText: "Net standard units" })
      .locator("strong"),
  ).toHaveText("-1");
  // Simulate a server refresh after another instance updates this member's controls.
  await page.evaluate(() =>
    (window as any).renderDemo("profile", {
      isFollowing: true,
      followNotifications: true,
    }),
  );
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: /Notify me about this member in the app/,
    }),
  ).toBeChecked();
  const profileActions: Record<string, unknown>[] = [];
  await page.route("**/api/community", (route) => {
    profileActions.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page
    .getByLabel("Display name", { exact: true })
    .fill("DEMO edited member");
  await page
    .getByRole("combobox", { name: "Profile visibility", exact: true })
    .selectOption("private");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("#edit").getByRole("status").first()).toContainText(
    "Profile saved",
  );
  expect(profileActions[0]).toMatchObject({
    action: "profile",
    displayName: "DEMO edited member",
    visibility: "private",
  });
  expect(profileActions[0]).not.toHaveProperty("isOfficial");
  expect(profileActions[0]).not.toHaveProperty("performance");
  await page.route("**/api/community-edges/share?*", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cqioAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download community share card" })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "docked-community-22222222-2222-4222-8222-222222222222.png",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Card downloaded" }),
  ).toContainText("Nothing was posted or sent");
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-profile-loss-1920.png"),
    fullPage: true,
  });
  await page.evaluate(() => (window as any).renderDemo("leaderboard"));
  await expect(page.getByText("PROVISIONAL", { exact: true })).toBeVisible();
  await expect(page.getByText(/Needs 19 more settled/)).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-top-docked-provisional-1920.png"),
    fullPage: true,
  });
});
test("DEMO verified Edge review requires permanent confirmation again when provider price moves", async ({
  page,
}) => {
  await fixture(page, "compose");
  const review = await page.evaluate(() => (window as any).demoReview);
  const submitted: Record<string, unknown>[] = [];
  const mediaId = "88888888-8888-4888-8888-888888888888";
  await page.route("**/api/community?view=own_media", (route) =>
    route.fulfill({
      json: {
        media: [
          {
            id: mediaId,
            status: "approved",
            alt: "DEMO approved social illustration",
            url: null,
            width: 640,
            height: 480,
          },
          {
            id: "99999999-9999-4999-8999-999999999999",
            status: "quarantine",
            alt: "DEMO unapproved image",
            url: null,
            width: 640,
            height: 480,
          },
        ],
      },
    }),
  );
  await page.route("**/api/community-edges**", async (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({
        json: {
          status: "READY",
          message: "DEMO prices only",
          options: [review],
        },
      });
    const body = request.postDataJSON();
    if (body.action === "review")
      return route.fulfill({ json: { ok: true, review } });
    submitted.push(body);
    return submitted.length === 1
      ? route.fulfill({
          status: 409,
          json: {
            code: "PRICE_MOVED",
            previousOdds: "2.10",
            current: { ...review, odds: "1.95", reviewToken: "b".repeat(64) },
          },
        })
      : route.fulfill({
          json: { ok: true, id: "22222222-2222-4222-8222-222222222222" },
        });
  });
  await page.getByRole("button", { name: "Refresh verified prices" }).click();
  await page.getByText("Optional social image", { exact: true }).click();
  await page.getByRole("button", { name: "Load approved images" }).click();
  await page
    .getByLabel("DEMO approved social illustration", { exact: true })
    .check();
  await expect(
    page.getByText("DEMO unapproved image", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("football");
  await page
    .getByRole("combobox", { name: "Competition", exact: true })
    .selectOption("DEMO league");
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption("demo-event");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("football_1x2");
  await page
    .getByRole("combobox", { name: "Selection", exact: true })
    .selectOption("DEMO Team A");
  await page
    .getByRole("combobox", {
      name: "Bookmaker · provider-observed standard odds",
    })
    .selectOption("demo-snapshot:DEMO Team A");
  await page.getByRole("button", { name: "Review verified Edge" }).click();
  await expect(page.locator(".compose-review")).toContainText(
    "Full-time result · regulation only",
  );
  await expect(
    page.getByRole("button", { name: "Submit at verified price" }),
  ).toBeDisabled();
  await page
    .getByLabel("I understand and accept this permanent record.")
    .check();
  await page.getByRole("button", { name: "Submit at verified price" }).click();
  await expect(page.getByRole("alert")).toContainText("2.10 → 1.95");
  await expect(
    page.getByLabel("I understand and accept this permanent record."),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Submit at verified price" }),
  ).toBeDisabled();
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-price-moved-390.png"),
    fullPage: true,
  });
  await page
    .getByLabel("I understand and accept this permanent record.")
    .check();
  await page.getByRole("button", { name: "Submit at verified price" }).click();
  await expect(
    page.getByRole("heading", { name: "Permanent record submitted." }),
  ).toBeVisible();
  expect(submitted).toHaveLength(2);
  expect(submitted[1].reviewToken).toBe("b".repeat(64));
  expect(submitted[1]).not.toHaveProperty("odds");
  expect(submitted[1].confirmedPermanent).toBe(true);
  expect(submitted[1].mediaIds).toEqual([mediaId]);
  await page.screenshot({
    path: path.join(qa, "DEMO-permanent-submitted-390.png"),
    fullPage: true,
  });
});
test("DEMO unsupported and promotional claims stay social-only; social interactions use distinct actions", async ({
  page,
}) => {
  await fixture(page, "compose");
  const actions: Record<string, unknown>[] = [];
  await page.route("**/api/community", async (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page
    .getByRole("button", { name: "Post as social content only" })
    .click();
  await expect(
    page.getByText(
      "Discussion is social content, not a verified performance record.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Your post")
    .fill(
      "DEMO promotional screenshot discussion. This is not a verified price.",
    );
  await page
    .getByLabel(
      "This post mentions a promotional, boosted or personalised price.",
    )
    .check();
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-social-promotional-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publish social post" }).click();
  expect(actions[0].action).toBe("post");
  expect(actions[0].promotional).toBe(true);
  expect(actions[0]).not.toHaveProperty("odds");
  await page.evaluate(() => (window as any).renderDemo("home"));
  await page.getByRole("button", { name: "0 reactions" }).click();
  await page.getByRole("button", { name: "0 comments" }).click();
  await page
    .getByLabel("Add a comment")
    .fill("DEMO reply with sporting context.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  expect(
    actions.find((action) => action.action === "follow"),
  ).not.toHaveProperty("notifications");
  const perMemberConsent = page.getByRole("checkbox", {
    name: /Notify me about this member in the app/,
  });
  await expect(perMemberConsent).not.toBeChecked();
  // This control updates only after the server confirms consent, not optimistically.
  await perMemberConsent.click();
  await expect(perMemberConsent).toBeChecked();
  expect(
    actions.filter((action) => action.action === "follow").at(-1),
  ).toMatchObject({ enabled: true, notifications: true });
  await page.getByText("Member controls", { exact: true }).click();
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page
    .getByRole("button", { name: "Report", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Reason", exact: true })
    .first()
    .selectOption("misleading_odds");
  await page
    .getByLabel("Details", { exact: true })
    .first()
    .fill("DEMO report: inaccurate price claims.");
  await page.getByRole("button", { name: "Send report" }).first().click();
  expect(actions.map((a) => a.action)).toEqual(
    expect.arrayContaining([
      "post",
      "react",
      "comment",
      "follow",
      "block",
      "report",
    ]),
  );
  expect(actions.some((a) => a.action === "submit")).toBe(false);
});
test("DEMO notification consent and moderation are separate from record corrections", async ({
  page,
}) => {
  await fixture(page, "notifications");
  const actions: Record<string, unknown>[] = [];
  await page.route("**/api/notifications", (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await expect(
    page.getByLabel("Future deals and marketing (separate opt-in)"),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Email · unavailable in this preview"),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Save notification preferences" })
    .click();
  expect(actions[0]).toMatchObject({
    email: false,
    push: false,
    dealsMarketing: false,
  });
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-notifications-390.png"),
    fullPage: true,
  });
  await page.evaluate(() => (window as any).renderDemo("moderation"));
  await page.route("**/api/community", (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page
    .getByRole("combobox", { name: "Action", exact: true })
    .selectOption("remove");
  await page
    .getByLabel("Audited reason")
    .fill("DEMO privacy redaction; structured record remains untouched.");
  await page.getByRole("button", { name: "Record moderation action" }).click();
  expect(actions.at(-1)).toMatchObject({
    action: "moderate",
    targetType: "post",
    decision: "remove",
  });
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-moderation-390.png"),
    fullPage: true,
  });
});
test("DEMO administrative drafts remain disabled and leaderboard captures are auditable", async ({
  page,
}) => {
  await fixture(page, "benefits");
  const actions: Record<string, unknown>[] = [];
  await page.route("**/api/admin/benefits", (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        ok: true,
        id: "66666666-6666-4666-8666-666666666666",
        state: "DRAFT_DISABLED",
      },
    });
  });
  for (const [name, value] of Object.entries({
    title: "DEMO non-active sports offer",
    description:
      "DEMO-only draft for testing the disabled configuration form. No real offer exists.",
    country: "AU",
    state: "NSW",
    startsAt: "2030-01-01T00:00",
    endsAt: "2030-02-01T00:00",
    sponsor: "DEMO sponsor",
    terms: "DEMO terms for an inactive test draft only.",
    disclosure: "DEMO fictional sponsor disclosure; not an active promotion.",
    reason: "DEMO form verification, no activation authority.",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await expect(
    page.getByRole("combobox", { name: "Future tracking class" }),
  ).toHaveValue("NONE");
  await page
    .getByRole("button", { name: "Save disabled draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Disabled draft saved");
  await expect(page.getByRole("status")).toContainText(
    "No public offer, entry or award is active",
  );
  expect(actions[0].action).toBe("deal_draft");
  expect(actions[0]).not.toHaveProperty("enabled");
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-disabled-deal-draft-390.png"),
    fullPage: true,
  });
  await page.evaluate(() => (window as any).renderDemo("audit"));
  await page.route("**/api/top-docked", (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({
      json: { ok: true, id: "77777777-7777-4777-8777-777777777777" },
    });
  });
  await page
    .getByLabel("Audited review reason")
    .fill("DEMO audited snapshot review; no real rankings.");
  await page.getByRole("button", { name: "Capture audited snapshot" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Audited snapshot recorded",
  );
  expect(actions[1].action).toBe("snapshot");
  expect(actions[1]).not.toHaveProperty("rank");
  await accessible(page);
  await page.screenshot({
    path: path.join(qa, "DEMO-leaderboard-audit-390.png"),
    fullPage: true,
  });
});
test("PWA serves an offline shell without caching private pages or APIs", async ({
  page,
  context,
}) => {
  await page.goto("/community");
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    await r.update();
  });
  await page.reload({ waitUntil: "networkidle" });
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/home");
  expect(manifest.icons).toHaveLength(3);
  const keys = await page.evaluate(async () => {
    const names = await caches.keys();
    return Promise.all(
      names.map(async (n) => ({
        name: n,
        urls: (await (await caches.open(n)).keys()).map(
          (r) => new URL(r.url).pathname,
        ),
      })),
    );
  });
  expect(
    keys.every((c) => c.urls.every((url) => url === "/offline.html")),
  ).toBe(true);
  await context.setOffline(true);
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "You’re offline." }),
  ).toBeVisible();
  await expect(
    page.getByText(/No submission has been confirmed/),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(qa, "offline-shell.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations())
      await r.unregister();
    for (const n of await caches.keys()) await caches.delete(n);
  });
});
