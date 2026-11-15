/** Measures image readiness; does not change assertions in the original suite. */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { previewPackReceipt } from "../../src/components/pack-opening-preview";
import {
  mountPackFixture,
  packFixtureMarkup,
} from "../../tests/fixtures/pack-browser";

async function main() {
  const out = "docs/qa/overnight-audit-20261115/share-image-profile";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  const results = [];
  try {
    for (const simulateShareCancel of [false, true]) {
      const rootStyles = true;
      const page = await browser.newPage();
      await page.addInitScript(`(() => {
        const events=[];
        Object.defineProperty(window,"auditShareEvents",{value:events});
        const original=navigator.share?.bind(navigator);
        if(original) Object.defineProperty(navigator,"share",{configurable:true,value:async (data)=>{
          events.push({action:"start",at:performance.now(),files:data.files?.length});
          try {
            if(${JSON.stringify(simulateShareCancel)}) throw new DOMException("Synthetic chooser cancelled","AbortError");
            await original(data);
            events.push({action:"complete",at:performance.now()});
          } catch(e) {
            events.push({action:"rejected",at:performance.now(),error:e instanceof Error?e.name:"unknown"});
            throw e;
          }
        }});
      })()`);
      const receipt = previewPackReceipt("afl", "LEGENDARY");
      const errors: string[] = [];
      const resources: { path: string; status: number }[] = [];
      let opens = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) =>
        resources.push({ path: new URL(r.url()).pathname, status: r.status() }),
      );
      await page.route("**/*", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/receipt") return route.fulfill({ json: null });
        if (path === "/open-pack") {
          opens++;
          return route.fulfill({ json: receipt });
        }
        return route.fulfill(await packFixtureMarkup(path));
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await mountPackFixture(page, true);
      if (rootStyles) {
        const css = [
          ...fs
            .readFileSync("src/app/layout.tsx", "utf8")
            .matchAll(/import "\.\/(.+\.css)"/g),
        ]
          .map((x) => fs.readFileSync("src/app/" + x[1], "utf8"))
          .join("\n");
        await page.addStyleTag({ content: css });
      }
      await page.getByRole("button", { name: "Open pack seal" }).click();
      await page
        .getByRole("button", { name: "Reveal All", exact: true })
        .click();
      const start = Date.now();
      await page
        .getByRole("button", {
          name: `Share ${receipt.cards[0].name}`,
          exact: true,
        })
        .click();
      const share = page.getByRole("dialog", { name: "Share your pull" });
      await page.setViewportSize({ width: 360, height: 800 });
      const button = share.getByRole("button", { name: "Save Image" });
      await share.waitFor({ state: "visible" });
      const readinessStart = Date.now();
      while (
        !(await button.isEnabled()) &&
        Date.now() - readinessStart < 20000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const ready = await button.isEnabled();
      const readyMs = Date.now() - start;
      const widths = [];
      for (const width of [360, 768, 1536]) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(150);
        widths.push({
          width,
          box: await share.boundingBox(),
          overflow: await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        });
      }
      const text = await share.innerText();
      const shareEvents = await page.evaluate(() =>
        Reflect.get(window, "auditShareEvents"),
      );
      const images = await share
        .getByRole("img")
        .evaluateAll((imgs) =>
          imgs.map((i) => ({
            width: (i as HTMLImageElement).naturalWidth,
            height: (i as HTMLImageElement).naturalHeight,
          })),
        );
      results.push({
        rootStyles,
        simulateShareCancel,
        ready,
        readyMs,
        opens,
        errors,
        resources,
        widths,
        text,
        shareEvents,
        images,
      });
      await page.screenshot({
        path:
          out +
          `/share-${simulateShareCancel ? "cancelled" : "real-headless"}.png`,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        source: "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef",
        environment:
          "Local isolated unminified fixture, headless Edge, normal CPU; host load uncontrolled; all requests intercepted",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      results.map(({ rootStyles, ready, readyMs, opens, errors, widths }) => ({
        rootStyles,
        ready,
        readyMs,
        opens,
        errors,
        widths,
      })),
    ),
  );
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
