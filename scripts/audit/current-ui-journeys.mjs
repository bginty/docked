/** Adapts stale diagnostic assumptions only; never overrides application components. */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const out = "docs/qa/overnight-audit-20261115/current-ui";
const temp = "private-data/overnight-audit-20261115";
fs.mkdirSync(out, { recursive: true });
const jobs = [
  ["collection", "owned-collection-browser.ts", "docs/qa/owned-collection"],
  ["member", "member-surfaces-browser.ts", "docs/qa/member-surfaces"],
  ["social", "prelaunch-experience-browser.ts", "docs/qa/prelaunch"],
];
const results = [];
for (const [name, file, oldOut] of jobs.filter(
  (j) => process.argv.length < 3 || process.argv.slice(2).includes(j[0]),
)) {
  let source = fs
    .readFileSync("scripts/" + file, "utf8")
    .replaceAll('from "../', 'from "../../')
    .replaceAll(oldOut, out + "/" + name);
  const adaptations = [];
  if (name === "collection") {
    const a = source.indexOf("    const baseline = await browser.newPage("),
      b = source.indexOf("    for (const width of [412, 1440])", a);
    if (a < 0 || b < 0) throw Error("Diagnostic baseline changed");
    source = source.slice(0, a) + source.slice(b);
    source = source.replaceAll(
      "for (const sport of collectionSports)",
      'for (const sport of collectionSports.filter(s => s !== "basketball"))',
    );
    source = source.replace(
      "collectionSports.map((s)",
      'collectionSports.filter(s => s !== "basketball").map((s)',
    );
    source = source
      .replaceAll('["basketball", "afl", "nrl"]', '["afl", "nrl"]')
      .replaceAll('name: "NBA"', 'name: "AFL"')
      .replaceAll("local-basketball-", "local-afl-");
    source = source.replace(
      'page.on("pageerror", (e) => errors.push(e.message));',
      'page.on("pageerror", (e) => { errors.push(e.message); writeFileSync(out+"/page-errors.json",JSON.stringify(errors,null,2)); });',
    );
    source = source.replaceAll(
      "state: { enabled: false },",
      "state: { enabled: false, packs: [], coupons: [], serverTime: Date.now() },",
    );
    adaptations.push(
      "Supply the disabled weekly/coupon API arrays required by the current contracts; the historical catch-all response omitted them.",
    );
    adaptations.push(
      "Remove obsolete NBA baseline; supported NFL/AFL/NRL only; sport-switch check uses AFL. Hidden NBA remains hidden.",
    );
    source = source.replace(
      'await page.getByRole("button", { name: "Packs", exact: true }).click();',
      `writeFileSync(out+"/partial-checks.json",JSON.stringify({checks,errors},null,2));\n        await page.getByRole("button", { name: "Packs", exact: true }).click();`,
    );
    source = source.replace(
      "  } finally {\n    await browser.close();",
      `  } finally {\n    for(const p of browser.contexts().flatMap(c=>c.pages())){try{await p.screenshot({path:out+"/last-screen.png"});writeFileSync(out+"/last-screen.txt",await p.locator("body").innerText());}catch{}}\n    await browser.close();`,
    );
    // Record the current focus behaviour without treating it as intended UX.
    source = source.replace(
      'await page.locator(".collectible-flip-control").click();',
      `await page.evaluate(() => window.dispatchEvent(new Event("focus")));\n        await page.waitForTimeout(500);\n        const detailClosedOnFocus = await page.locator(".collectible-viewer").count() === 0;\n        checks.push({sport,width,detailClosedOnFocus});\n        if(detailClosedOnFocus)await page.locator(".owned-grid .card-face").first().click();\n        await page.locator(".collectible-flip-control").click();`,
    );
  }
  if (name === "member") {
    source = source.replaceAll(
      'page.locator(".pack-wrapper")',
      'page.locator(".foil-pack-art")',
    );
    adaptations.push(
      "The shipped supported pack artwork now uses .foil-pack-art, replacing .pack-wrapper. Still assert all 21 variants.",
    );
  }
  if (name === "social") {
    source = source.replaceAll(
      'getByLabel("Your post")',
      'getByLabel("Post to Docked")',
    );
    source = source.replaceAll("/Attach your cards/", "/Attach cards/");
    source = source.replaceAll(
      'page.getByRole("button", { name: "Post", exact: true })',
      'page.getByRole("dialog", { name: "Preview post", exact: true }).getByRole("button", { name: "Post", exact: true })',
    );
    const a = source.indexOf("  const css = ["),
      b = source.indexOf("  let outcome", a);
    if (a < 0 || b < 0) throw Error("Diagnostic CSS block changed");
    source =
      source.slice(0, a) +
      `  const css = [...readFileSync("src/app/layout.tsx","utf8").matchAll(/import "\\.\\/(.+\\.css)"/g)].map(x=>readFileSync("src/app/"+x[1],"utf8")).join("\\n");\n` +
      source.slice(b);
    adaptations.push(
      "Use current composer label and actual root stylesheet order.",
    );
  }
  const generated = temp + "/current-" + name + ".ts";
  fs.writeFileSync(generated, source);
  const started = new Date().toISOString();
  console.log(JSON.stringify({ name, status: "running" }));
  const run = spawnSync(process.execPath, ["--import", "tsx", generated], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 600000,
    maxBuffer: 10e6,
  });
  fs.writeFileSync(
    temp + "/current-" + name + ".log",
    (run.stdout ?? "") + "\n" + (run.stderr ?? ""),
  );
  results.push({
    name,
    started,
    finished: new Date().toISOString(),
    exitCode: run.status,
    error: run.error?.message,
    adaptations,
    productOverrides: 0,
  });
  fs.writeFileSync(
    out + "/runs.json",
    JSON.stringify(
      {
        environment:
          "Loopback HTTP, real unchanged components, synthetic transport and members. No hosted acceptance.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(results.at(-1)));
}
