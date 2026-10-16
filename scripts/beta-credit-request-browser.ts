import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import type {
  BetaCreditRequest,
  BetaCreditRequestMutation,
} from "../src/core/beta-credit-requests";

async function main() {
  const out = "docs/qa/beta-credit-requests";
  mkdirSync(out, { recursive: true });
  const result = await build({
    entryPoints: ["tests/fixtures/beta-credit-request.tsx"],
    outfile: "fixture.js",
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      "next/link": resolve("tests/fixtures/community-framework-shim.tsx"),
      "next/navigation": resolve("tests/fixtures/community-framework-shim.tsx"),
      "@": resolve("src"),
    },
  });
  const script = result.outputFiles.find((f) => f.path.endsWith(".js"))!.text;
  const css =
    [
      ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
        /import "\.\/(.*?\.css)"/g,
      ),
    ]
      .map((m) => readFileSync("src/app/" + m[1], "utf8"))
      .join("\n") +
    (result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "");
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const publicRoot = resolve("public"),
      file = resolve(publicRoot, "." + url.pathname);
    if (url.pathname === "/fixture.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(script);
    } else if (url.pathname === "/style.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else if (
      file.startsWith(publicRoot + sep) &&
      existsSync(file) &&
      /\.(png|webp|svg|jpg)$/.test(file)
    ) {
      response.setHeader(
        "Content-Type",
        file.endsWith("svg")
          ? "image/svg+xml"
          : file.endsWith("webp")
            ? "image/webp"
            : file.endsWith("jpg")
              ? "image/jpeg"
              : "image/png",
      );
      response.end(readFileSync(file));
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked request workflow · synthetic fixture</title><link rel="stylesheet" href="/style.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch().catch(async (error: unknown) => {
    await new Promise<void>((done) => server.close(() => done()));
    throw error;
  });
  const evidence: object[] = [];
  try {
    for (const width of [1440, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const requests: BetaCreditRequest[] = [],
        commands: BetaCreditRequestMutation[] = [];
      const seen = new Map<string, BetaCreditRequest>();
      let interrupt = true;
      await page.route("**/api/admin/credit-requests**", async (route) => {
        const request = route.request();
        if (request.method() === "GET") {
          const q = new URL(request.url()).searchParams.get("q") ?? "";
          await route.fulfill({
            json: {
              requests,
              recipients:
                q.length >= 2
                  ? [
                      {
                        id: "22222222-2222-4222-8222-222222222222",
                        name: "Fixture Recipient",
                        handle: "fixture",
                      },
                    ]
                  : [],
              page: 1,
              hasMore: false,
              executionEnabled: false,
            },
          });
          return;
        }
        const command = request.postDataJSON() as BetaCreditRequestMutation;
        commands.push(command);
        let record = seen.get(command.requestId);
        if (!record) {
          if (command.action === "request") {
            record = {
              id: "33333333-3333-4333-8333-333333333333",
              recipient: command.recipient,
              recipientName: "Fixture Recipient",
              amount: command.amount,
              reason: command.reason,
              status: "requested",
              revision: 1,
              created_at: "2026-10-17T00:00:00Z",
              updated_at: "2026-10-17T00:00:00Z",
              requested_by: "owner-fixture",
              policy_context: "synthetic-only",
              history: [],
            };
            requests.push(record);
          } else {
            record = requests[0];
            record.status =
              command.action === "approve"
                ? "approved"
                : command.action === "decline"
                  ? "declined"
                  : "cancelled";
            record.revision++;
          }
          record.history.push({
            id: command.requestId,
            actor: "owner-fixture",
            action: command.action,
            reason: command.reason,
            created_at: "2026-10-17T00:00:00Z",
          });
          seen.set(command.requestId, record);
        }
        if (interrupt) {
          interrupt = false;
          await route.fulfill({
            status: 503,
            json: {
              error: "Synthetic interrupted response. Retry the same request.",
            },
          });
        } else await route.fulfill({ json: record });
      });
      await page.goto(
        `http://127.0.0.1:${address.port}/admin/workspace/rewards`,
      );
      await expect(
        page.getByText("No saved requests.", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Find admitted recipient").fill("fixture");
      await page
        .getByRole("button", { name: "Find recipient", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select Fixture Recipient" })
        .click();
      await page.getByLabel("Requested test credits").fill("5000");
      await page
        .getByLabel("Reason", { exact: true })
        .fill("Isolated beta request for owner review");
      await page
        .getByRole("button", { name: "Review request", exact: true })
        .click();
      assert.equal(commands.length, 0);
      await page.screenshot({
        path: `${out}/confirmation-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Cancel review" }).click();
      assert.equal(commands.length, 0);
      await page
        .getByRole("button", { name: "Review request", exact: true })
        .click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Confirm review record" }).click();
      await expect(
        page.getByRole("button", { name: "Retry same request" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cancel review" }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Retry same request" }).click();
      await expect(
        page.getByText("Awaiting request review — credits not issued", {
          exact: true,
        }),
      ).toBeVisible();
      assert.equal(commands.length, 2);
      assert.equal(commands[0].requestId, commands[1].requestId);
      assert.equal(requests.length, 1);
      await page
        .getByLabel("Decision reason")
        .fill("Proposal reviewed without granting any credits");
      await page
        .getByRole("button", { name: "Approve request", exact: true })
        .click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Confirm review record" }).click();
      await expect(
        page.getByText("Request approved — credits not issued", {
          exact: true,
        }),
      ).toBeVisible();
      assert.equal(requests[0].history.length, 2);
      const axe = await new AxeBuilder({ page }).analyze();
      writeFileSync(
        `${out}/axe-${width}.json`,
        JSON.stringify(axe.violations, null, 2),
      );
      await page.screenshot({
        path: `${out}/approved-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(
        axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => v.id),
        [],
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      evidence.push({
        width,
        previewAndCancelDoNotSave: true,
        uncertainRetryPreservesRequestId: true,
        storedRequests: 1,
        approvedNotIssued: true,
        noOverflow: true,
        seriousCriticalAxe: 0,
      });
      await context.close();
    }
    writeFileSync(
      `${out}/acceptance.json`,
      JSON.stringify(
        {
          scope:
            "Actual UI and isolated synthetic API; not hosted or physical-device acceptance",
          evidence,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
