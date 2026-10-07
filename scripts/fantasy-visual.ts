import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app",
  out = "docs/qa/fantasy";
async function main() {
  if (process.argv[2] !== "--confirm-preview")
    throw Error("Preview scope required");
  const a = JSON.parse(
    await readFile("private-data/fantasy/testers.json", "utf8"),
  ).accounts[0];
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
  });
  const r = await c.request.post(origin + "/api/auth", {
    data: { action: "login", email: a.email, password: a.password, app: true },
    headers: { Origin: origin },
  });
  if (r.status() !== 200) throw Error("Genuine login required");
  const p = await c.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const checks: unknown[] = [];
  try {
    for (const tab of ["play", "cards", "market", "social", "profile"]) {
      for (const width of [360, 390, 412, 430, 768, 1440]) {
        await p.setViewportSize({ width, height: width < 600 ? 915 : 1000 });
        const response = await p.goto(origin + "/fantasy/" + tab, {
          waitUntil: "networkidle",
        });
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        const images = await p
          .locator("img")
          .evaluateAll((xs) =>
            xs.every(
              (x) =>
                (x as HTMLImageElement).complete &&
                (x as HTMLImageElement).naturalWidth > 0,
            ),
          );
        const analysis =
          width === 390
            ? await new AxeBuilder({ page: p })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
            : null;
        checks.push({
          tab,
          width,
          http: response?.status(),
          overflow,
          images,
          violations:
            analysis?.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            })) ?? [],
        });
        if ([390, 412, 1440].includes(width))
          await p.screenshot({
            path: `${out}/${tab}-${width}.png`,
            fullPage: true,
          });
      }
    }
    const report = {
      at: new Date().toISOString(),
      browser:
        "Chromium emulation; 412 CSS pixels approximates Samsung S24 viewport, not hardware",
      checks,
      pageErrors: errors,
    };
    await writeFile(out + "/visual.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await b.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
