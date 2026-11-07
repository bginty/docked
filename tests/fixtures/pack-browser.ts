import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { bundleCommunityFixture } from "./bundle-community";

export const packFixtureStyles = [
  "brand-theme",
  "globals",
  "sports-visuals",
  "sports-experience",
  "community-app",
  "native",
  "mobile-app",
  "app-auth",
  "beta-experience",
  "fantasy",
  "fantasy-play",
  "pack-opening",
  "pack-cinematic",
  "pack-pull-share",
  "mobile-cleanup",
  "collectible",
  "card-viewer",
  "pack-shop",
  "premium-ux",
  "member-surfaces",
  "pack-cinema-v2",
  "foil-pack-artwork",
];

const mimeTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export const packFixtureOrigin = "https://fixture.invalid";
export const revealPhase = "[data-pack-reveal-phase]";

export async function packFixtureMarkup(path: string) {
  if (path.startsWith("/brand/")) {
    try {
      return {
        contentType: mimeTypes[extname(path)] ?? "application/octet-stream",
        body: await readFile("public" + path),
      };
    } catch {
      return { status: 404 };
    }
  }
  if (path !== "/pack") return { status: 404 };
  return {
    contentType: "text/html",
    body: '<!doctype html><html lang="en"><head><title>Isolated pack acceptance</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body class="fantasy-mode"><main id="fixture-root"></main></body></html>',
  };
}

let assets: Promise<[string, string[]]> | undefined;

export async function mountPackFixture(
  page: Page,
  prototype = false,
  product?: { name: string; sport: string; count: number; premium: boolean },
) {
  assets ??= Promise.all([
    bundleCommunityFixture("tests/fixtures/pack-opening.tsx"),
    Promise.all(
      packFixtureStyles.map((name) =>
        readFile("src/app/" + name + ".css", "utf8"),
      ),
    ),
  ]);
  const [script, css] = await assets;
  const query = new URLSearchParams({ cinema: prototype ? "v3" : "legacy" });
  if (product) {
    query.set("name", product.name);
    query.set("sport", product.sport);
    query.set("count", String(product.count));
    query.set("type", product.premium ? "PREMIUM" : "STANDARD");
  }
  await page.goto(packFixtureOrigin + "/pack?" + query.toString());
  await page.addStyleTag({ content: css.join("\n") });
  await page.addScriptTag({ content: script });
  await page.getByRole("button", { name: "Open viewer" }).click();
}
