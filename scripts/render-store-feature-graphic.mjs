// Original, editable brand layout; no generated app UI or new branding.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import sharp from "sharp";
const out = "docs/qa/prelaunch-store-assets";
mkdirSync(out, { recursive: true });
const logo = "public/brand/docked/logos/docked-wordmark-compact-800w.webp";
const font = "public/brand/fonts/Sora-Variable.ttf";
const brand = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"));
const encodedLogo = readFileSync(logo).toString("base64");
const encodedFont = readFileSync(font).toString("base64");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=1024"><title>Docked feature graphic — review artwork</title>
<style>
@font-face{font-family:Sora;src:url(data:font/ttf;base64,${encodedFont}) format('truetype');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{font-family:Sora,sans-serif;background:#060c18;color:white}
.canvas{position:relative;isolation:isolate;width:1024px;height:500px;overflow:hidden;background:radial-gradient(ellipse at 50% 22%,#17376d77,transparent 65%),radial-gradient(ellipse at 3% 65%,#193cff33,transparent 43%),radial-gradient(ellipse at 100% 90%,#7c2bff22,transparent 42%),linear-gradient(150deg,#091426,#040914 78%)}
.geometry{position:absolute;width:370px;height:570px;top:-35px;border:1px solid #1c4984;transform:rotate(24deg);box-shadow:0 0 0 15px #18315a15,0 0 0 16px #265a8c35,0 0 0 45px #17395a12;z-index:-1}.left{left:-225px}.right{right:-240px;transform:rotate(24deg);border-color:#633ebd66}
.line{position:absolute;left:80px;right:80px;height:1px;background:linear-gradient(90deg,transparent,#007fff66,#93ceff88,#007fff66,transparent)}.top{top:55px}.bottom{bottom:53px}
.eyebrow{position:absolute;top:88px;width:100%;text-align:center;color:#a5bddb;font-size:15px;font-weight:600;letter-spacing:4px}
.logo{position:absolute;width:720px;height:auto;left:152px;top:161px;filter:drop-shadow(0 16px 30px #0008)}
.tagline{position:absolute;top:294px;left:0;width:100%;margin:0;text-align:center;font-size:37px;font-weight:650;letter-spacing:-1.5px;text-shadow:0 2px 12px #0008}.tagline span{color:#30caff}
.accent{position:absolute;top:371px;left:476px;width:72px;height:3px;background:linear-gradient(90deg,#1a2aff,#00d1ff);box-shadow:0 0 20px #00d1ff66}
</style><main class="canvas" aria-label="Docked. ${brand.tagline}"><div class="geometry left"></div><div class="geometry right"></div><div class="line top"></div><div class="line bottom"></div><div class="eyebrow">FANTASY SPORTS · DIGITAL COLLECTIBLES</div><img class="logo" src="data:image/webp;base64,${encodedLogo}" alt="Docked"><h1 class="tagline">Collect. <span>Compete.</span> Connect.</h1><div class="accent"></div></main></html>`;
if (brand.tagline !== "Collect. Compete. Connect.")
  throw Error("Approved tagline changed; review artwork");
writeFileSync(`${out}/feature-graphic-review.html`, html);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await page.screenshot({
    path: `${out}/feature-graphic-review.png`,
    omitBackground: false,
  });
} finally {
  await browser.close();
}
const meta = await sharp(`${out}/feature-graphic-review.png`).metadata();
if (meta.width !== 1024 || meta.height !== 500 || meta.hasAlpha)
  throw Error("Incorrect feature graphic dimensions/format");
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
writeFileSync(
  `${out}/feature-graphic-provenance.json`,
  JSON.stringify(
    {
      status: "LOCAL_REVIEW_ONLY_NOT_FOR_UPLOAD",
      renderedBy: "Local Edge browser screenshot of editable HTML/CSS",
      source: "feature-graphic-review.html",
      output: "feature-graphic-review.png",
      dimensions: [1024, 500],
      hasAlpha: false,
      logoSource: logo,
      logoSha256: hash(logo),
      logoModified: false,
      fontSource: font,
      tagline: brand.tagline,
      design:
        "Original geometric navy/blue layout; no app UI, player/team marks, statistics or financial claims",
      sha256: hash(`${out}/feature-graphic-review.png`),
      physicalDeviceAcceptance: false,
      storeAcceptance: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    rendered: true,
    width: 1024,
    height: 500,
    publicationReady: false,
  }),
);
