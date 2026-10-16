// Evidence only: render the prior committed owner component/CSS in the same
// synthetic local harness. Never checks out source or connects to hosted data.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const commit = "c588d7930129987796f8aa309d42040abafc5938";
const git = (file) =>
  execFileSync("git", ["show", `${commit}:${file}`], { encoding: "utf8" });
const out = "docs/qa/prelaunch-owner/before-c588d793";
mkdirSync("tmp", { recursive: true });
mkdirSync(out, { recursive: true });
writeFileSync(
  "tmp/prelaunch-owner-before.tsx",
  git("src/components/owner-dashboard.tsx").replace(
    '"./prize-register"',
    '"../src/components/prize-register"',
  ),
);
writeFileSync(
  "tmp/prelaunch-owner-before-fixture.tsx",
  readFileSync("tests/fixtures/owner-command-centre.tsx", "utf8")
    .replace(
      '"../../src/components/owner-dashboard"',
      '"./prelaunch-owner-before"',
    )
    .replaceAll('"../../src/', '"../src/')
    .replace(
      "ISOLATED OWNER REVIEW",
      "BEFORE c588d793 · ISOLATED OWNER REVIEW",
    ),
);
const css = [...git("src/app/layout.tsx").matchAll(/import "\.\/(.*?\.css)"/g)]
  .map((m) => git("src/app/" + m[1]))
  .join("\n");
writeFileSync("tmp/prelaunch-owner-before.css", css);
let script = readFileSync("scripts/owner-command-browser.ts", "utf8")
  .replaceAll("\r\n", "\n")
  .replace(/const out = `[^`]+`;/, `const out = ${JSON.stringify(out)};`)
  .replace(
    '"tests/fixtures/owner-command-centre.tsx"',
    '"tmp/prelaunch-owner-before-fixture.tsx"',
  )
  .replace(
    /const css = [\s\S]*?\.join\("\\n"\);/,
    'const css = readFileSync("tmp/prelaunch-owner-before.css", "utf8");',
  )
  .replace(
    "metrics: { admitted: 3, newRegistrations: 2 }",
    "metrics: { admitted: 3, newRegistrations: 2, competitors: 3 }",
  );
const start = script.indexOf("  try {\n    const checks = [];");
const finish = script.indexOf("  } finally {", start);
if (
  start < 0 ||
  finish < 0 ||
  !script.includes('readFileSync("tmp/prelaunch-owner-before.css"')
)
  throw Error("Harness changed; review before rendering");
script =
  script.slice(0, start) +
  `  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({ viewport: {width, height:900}, isMobile:width<600, hasTouch:width<600, reducedMotion:"reduce" });
      const page = await context.newPage();
      await page.goto(base + "/admin/operations");
      await expect(page.getByRole("heading", {name:"What needs attention"})).toBeVisible();
      await page.screenshot({path: out + "/owner-before-" + width + ".png", fullPage:true});
      await context.close();
    }
    writeFileSync(out + "/provenance.json", JSON.stringify({commit:${JSON.stringify(commit)}, component:"src/components/owner-dashboard.tsx", css:"Historical layout imports", scope:"Prior component and CSS; current shell and same synthetic fixture. Not a historical hosted screenshot or authenticated acceptance.", pairedAfter:"docs/qa/prelaunch-owner/browser-1792153080888"},null,2));
    console.log(JSON.stringify({rendered:true,out}));
` +
  script.slice(finish);
writeFileSync("tmp/prelaunch-owner-before-browser.ts", script);
const result = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "tmp/prelaunch-owner-before-browser.ts"],
  { stdio: "inherit", windowsHide: true },
);
process.exitCode = result.status ?? 1;
