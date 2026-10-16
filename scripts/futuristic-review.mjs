import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
const root = "docs/qa/futuristic-cards";
const run = readdirSync(root)
  .filter(
    (n) => n.startsWith("browser-") && existsSync(`${root}/${n}/results.json`),
  )
  .sort()
  .at(-1);
if (!run) throw Error("No completed visual run");
const contexts = [
  "collection",
  "detail",
  "market",
  "social",
  "member",
  "reveal",
  "lineup",
];
const rarities = ["Core", "Rare", "Elite", "Ultra Rare", "Legendary", "Icon"];
const grid = (items, file, width) =>
  `<div class="grid">${items.map((name, i) => `<figure><a href="${run}/${file(name, i, width)}"><img src="${run}/${file(name, i, width)}" alt="${name} card"></a><figcaption>${name}</figcaption></figure>`).join("")}</div>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked futuristic cards — local review</title><style>body{margin:0;padding:28px;background:#050c18;color:#eef5ff;font:15px system-ui}h1{margin:0 0 8px}h2{margin:30px 0 12px}p{color:#a7bed7}.grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px}figure{margin:0;min-width:0}img{display:block;width:100%;height:auto}figcaption{text-transform:capitalize;text-align:center;padding:10px}a{color:#68c4ff}.rarities .grid{grid-template-columns:repeat(6,minmax(0,1fr))}nav{display:flex;gap:15px;flex-wrap:wrap;margin-bottom:16px}@media(max-width:700px){.grid,.rarities .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>One collectible, every surface</h1><p>Actual browser captures · isolated synthetic owned-card fixture · no Production changes. Number 85 is fixture metadata, not a claim about a real player.</p><section id="comparison"><h2>Same card across seven contexts · desktop</h2>${grid(contexts, (name) => `${name}-card-1440.png`, 1440)}<h2>Same card across seven contexts · 412px Android viewport</h2>${grid(contexts, (name) => `${name}-card-412.png`, 412)}</section><section id="rarities" class="rarities"><h2>All six rarity materials</h2>${grid(rarities, (_name, i) => `rarity-${i}-1440.png`, 1440)}</section><h2>Full screens</h2>${[1440, 1024, 412, 360].map((w) => `<h3>${w}px</h3><nav>${contexts.map((c) => `<a href="${run}/${c}-${w}.png">${c}</a>`).join("")}<a href="${run}/long-names-${w}.png">Long names</a></nav>`).join("")}<p>Physical Samsung S24 acceptance and hosted authenticated sessions remain pending. Preview is local only.</p></html>`;
writeFileSync(`${root}/review.html`, html);
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve(`${root}/review.html`)).href);
  await page
    .locator("#comparison")
    .screenshot({ path: `${root}/same-card-comparison.png` });
  await page
    .locator("#rarities")
    .screenshot({ path: `${root}/six-rarities.png` });
  console.log(
    JSON.stringify({
      run,
      results: JSON.parse(readFileSync(`${root}/${run}/results.json`, "utf8")),
    }),
  );
} finally {
  await browser.close();
}
