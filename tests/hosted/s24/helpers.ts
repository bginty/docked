import type { Page, APIRequestContext, BrowserContext } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { check, ORIGIN, PROJECT, privateEvidence, type Account } from "./guard";

export async function guardBrowser(context: BrowserContext) {
  let unexpected = 0;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:"].includes(url.protocol)) return route.continue();
    if (
      url.origin !== ORIGIN ||
      ["password", "access_token", "refresh_token"].some((key) =>
        url.searchParams.has(key),
      )
    ) {
      unexpected++;
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return () => check(unexpected === 0, "no-cross-origin-browser-request");
}
export async function api(
  request: APIRequestContext,
  endpoint: string,
  body?: Record<string, unknown>,
) {
  check(
    endpoint.startsWith("/api/") && !endpoint.includes("//"),
    "same-origin-api-path",
  );
  const response =
    body === undefined
      ? await request.get(`${ORIGIN}${endpoint}`, { maxRedirects: 0 })
      : await request.post(`${ORIGIN}${endpoint}`, {
          data: body,
          headers: { Origin: ORIGIN },
          maxRedirects: 0,
        });
  check(
    new URL(response.url()).origin === ORIGIN &&
      !(response.status() >= 300 && response.status() < 400),
    "api-never-redirects",
  );
  return response;
}
export async function login(page: Page, a: Account) {
  const response = await page.goto(`${ORIGIN}/login`, {
    waitUntil: "domcontentloaded",
  });
  check(response?.status() === 200, "login-page-ready");
  const form = page
    .locator("form")
    .filter({ has: page.locator('[name="password"]') });
  check(
    (await form.getAttribute("method")) === "post" &&
      (await form.getAttribute("action")) === "/api/auth",
    "login-native-submission-cannot-leak-query-credentials",
  );
  await form.locator('[name="email"]').waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document
        .querySelector('form[action="/api/auth"]')
        ?.getAttribute("data-api-ready") === "true",
  );
  await page.locator('[name="email"]').fill(a.email);
  await page.locator('[name="password"]').fill(a.password);
  const pending = page.waitForResponse(
    (r) => r.url() === `${ORIGIN}/api/auth` && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const accepted = await pending;
  const result = await accepted.json();
  check(
    accepted.status() === 200 &&
      result.ok === true &&
      result.redirect === "/dashboard",
    "genuine-login-accepted",
  );
  await page.waitForURL(`${ORIGIN}/dashboard`);
  const cookies = await page.context().cookies();
  const auth = cookies.filter((c) =>
    c.name.startsWith(`sb-${PROJECT}-auth-token`),
  );
  check(
    auth.length > 0 &&
      auth.every((c) => c.secure && c.httpOnly && c.sameSite === "Lax"),
    "secure-http-only-project-cookies",
  );
  const exported = await api(page.request, "/api/member");
  check(
    exported.status() === 200 && (await exported.json()).profile?.id === a.id,
    "session-matches-disposable-identity",
  );
  await page.goto(`${ORIGIN}/home`, { waitUntil: "domcontentloaded" });
}
export async function publicCapture(page: Page, name: string) {
  const directory = path.join(privateEvidence, "public-responses", name);
  await mkdir(directory, { recursive: true });
  const work: Promise<void>[] = [],
    records: Array<{
      file: string;
      path: string;
      kind: string;
      bytes: number;
    }> = [];
  page.on("response", (response) => {
    const url = new URL(response.url()),
      kind = response.headers()["content-type"] ?? "";
    if (
      url.origin !== ORIGIN ||
      response.status() !== 200 ||
      !/(?:text\/html|text\/x-component|javascript|text\/css)/i.test(kind)
    )
      return;
    work.push(
      (async () => {
        try {
          const bytes = await response.body();
          const file =
            createHash("sha256").update(response.url()).digest("hex") +
            (kind.includes("html")
              ? ".html"
              : kind.includes("x-component")
                ? ".rsc"
                : kind.includes("css")
                  ? ".css"
                  : ".js");
          await writeFile(path.join(directory, file), bytes, { mode: 0o600 });
          records.push({ file, path: url.pathname, kind, bytes: bytes.length });
        } catch {
          /* Cancelled speculative prefetch is not a served artifact. */
        }
      })(),
    );
  });
  return async () => {
    await Promise.all(work);
    await writeFile(
      path.join(directory, "rendered.html"),
      await page.content(),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify(records, null, 2),
      { mode: 0o600 },
    );
    check(
      records.some((r) => /javascript/i.test(r.kind)),
      "actual-public-javascript-captured",
    );
    return {
      files: records.length + 2,
      bytes: records.reduce((n, r) => n + r.bytes, 0),
    };
  };
}
export async function readyImages(page: Page) {
  const good = await page.locator("img").evaluateAll(async (images) => {
    for (const image of images) (image as HTMLImageElement).loading = "eager";
    return (
      await Promise.all(
        images.map(async (image) => {
          try {
            await (image as HTMLImageElement).decode();
            return (image as HTMLImageElement).naturalWidth > 0;
          } catch {
            return false;
          }
        }),
      )
    ).every(Boolean);
  });
  check(good, "page-images-decode");
}
