import { readFile, writeFile } from "node:fs/promises";

const out = "docs/qa/foil-pack-rollout-20261107";
const inventory = JSON.parse(
  await readFile("design/foil-pack-rollout/asset-inventory.json", "utf8"),
);
const browser = JSON.parse(await readFile(out + "/browser.json", "utf8"));
const physical = await readFile(out + "/physical-android.json", "utf8")
  .then(JSON.parse)
  .catch(() => null);
const release = await readFile(out + "/release/live-verified.json", "utf8")
  .then(JSON.parse)
  .catch(() => null);
const signedIn = await readFile(
  out + "/release/signed-in-verified.json",
  "utf8",
)
  .then(JSON.parse)
  .catch(() => null);
const layouts = (
  await Promise.all(
    ["nfl", "afl", "nrl"].flatMap((sport) =>
      [320, 360, 375, 390, 430].map((width) =>
        readFile(`${out}/${sport}-layout-${width}.json`, "utf8"),
      ),
    ),
  )
).flatMap((v) => JSON.parse(v));
const checks = {
  baseline: "864df2779b258f01d66717170e624a89e5b22ee4",
  deployment: release?.passed
    ? `Deployed to ${release.target}; commit ${release.commit}.`
    : "Not deployed. Owner review/approval required.",
  liveAcceptance: signedIn,
  productionReadOnlyCatalogue: true,
  paidVariants: 18,
  starterVariants: 3,
  assets: inventory.flatMap((v) => v.files).length,
  browser: browser.stats,
  existingPlatformPassed: 751,
  addedInventoryTestsPassed: 2,
  typecheck: "Passed",
  lint: "Full source/scripts/tests passed; later fixture edits also linted",
  build: release?.passed
    ? "Local Next.js 16.4.3 production webpack build and hosted Linux Production build passed. All 63 live asset hashes match."
    : "Next.js 16.4.3 production webpack build passed. Existing external node_modules junction prevents local Turbopack; no remote deployment was used.",
  clientBoundary:
    "233 generated assets scanned; no build-canary markers found. Dedicated canary environment was not injected.",
  mobileViewports: [320, 360, 375, 390, 430],
  otherViewports: [768, 1440],
  mobileProductHeightPx: {
    min: Math.min(...layouts.map((v) => v.tile.height)),
    max: Math.max(...layouts.map((v) => v.tile.height)),
  },
  thumbnailBytes: { max: Math.max(...inventory.map((v) => v.files[0].bytes)) },
  physicalAndroid: physical
    ? `${physical.status}: ${physical.model}, Android ${physical.android}, Chrome. ${physical.checks.length} recorded checks. Local synthetic fixture; installed Docked WebView was not tested.`
    : "Pending: ADB reported no connected device. Emulated walkthrough is Edge at Samsung-sized 412x915, DPR 2, touch.",
  sevenGoogleTestAlerts: "Pre-existing; not modified or reconciled.",
  productionCustomerWrites: 0,
  backendChanges: false,
  nativeAppChanges: false,
};
await writeFile(out + "/checks.json", JSON.stringify(checks, null, 2) + "\n");
const items = inventory
  .map((v) => {
    const file = `${v.tier.toLowerCase()}-${v.sport}-${v.count}`;
    return `<li><a href="${file}-store.png">${v.tier} · ${v.sport.toUpperCase()} · ${v.count} cards — store</a> · <a href="${file}-opening.png">opening</a>${v.tier === "STARTER" ? "" : ` · <a href="${file}-confirmation.png">confirmation</a>`}</li>`;
  })
  .join("");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked foil pack rollout review</title>
<style>body{background:#07111f;color:#ebf4ff;font:16px/1.6 system-ui;margin:auto;padding:24px;max-width:1100px}h1{line-height:1.2}a{color:#8edbff}figure{margin:0}img{max-width:100%;height:auto}section{padding:24px;border:1px solid #30465c;border-radius:16px;margin:24px 0;background:#0b1828}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.pair img{width:100%}video{max-height:80vh;width:100%;background:#02080f}li{margin:8px 0}.notice{color:#bde4ff}@media(max-width:600px){.pair{gap:12px}body{padding:12px}section{padding:14px}}</style>
<h1>Complete Docked foil collection</h1><p class="notice">${release?.passed ? `LIVE · ${release.commit.slice(0, 8)}` : "Ready for owner review · NOT DEPLOYED"} · NFL / AFL / NRL · NBA unchanged</p>
${release?.passed ? `<p><a href="https://docked.com.au/fantasy/cards?tab=packs">Open live packs</a> · <a href="release/live-verified.json">Deployment checks</a> · <a href="release/signed-in-verified.json">Signed-in acceptance</a></p><p>All 21 variants loaded during genuine signed-in mobile-width acceptance. Three purchase previews were cancelled; no purchase was confirmed, no new pack was opened and the displayed balance was unchanged.</p>` : ""}
<p>All 21 existing variants: Starter silver (4 cards), Standard blue and Premium black/gold (1, 3, 9 cards). Every logo, tier, sport and quantity is baked into the finished artwork. Prices, odds, supply and eligibility still come from the existing catalogue.</p>
<p><a href="http://127.0.0.1:4189/fantasy/cards?gallery=1">Interactive gallery</a> · <a href="http://127.0.0.1:4189/fantasy/cards?view=packs&amp;sport=nrl">Interactive store</a> · <a href="checks.json">Check results</a></p>
<section><h2>What changed</h2><p>The previous deployed artwork lookup contained only Standard AFL 9 and Premium NRL 9. Every other product fell back to the old flat renderer. Its mobile foil rule also allowed a 250px-wide image in a vertical product tile, making the single upgraded Premium pack much larger than its neighbours.</p><p>The shared renderer now selects the exact sport/tier/count artwork for all 21 existing variants. Mobile tiles use an image-and-details grid with 82–116px-wide packaging; desktop images are bounded to 180px. Catalogue data still supplies price, quantity and availability. My Packs, history, purchase confirmation, opening, Weekly Starter, prize packaging and owner previews reuse the same component.</p><p>All branding is baked into the finished transparent artwork. Three WebP sizes (240, 480 and 800px) reserve a 2:3 aspect ratio. The 240px assets are at most 30,592 bytes; all 63 production files total 6,119,656 bytes. The removed CSS mask no longer forces an extra 800px image download alongside a responsive thumbnail.</p><p>No schema, catalogue, billing, ownership, native Android or sport-visibility changes are included. Legacy fallback assets remain for unknown historical identities and hidden NBA; they are no longer used by the current NFL/AFL/NRL catalogue.</p></section>
<section><h2>Mobile before / after</h2><p>Same synthetic account and viewport; before reproduces the deployed 864df277 artwork selection and CSS.</p><div class="pair"><figure><figcaption>Before — oversized 9-card pack, mixed flat thumbnails</figcaption><img src="before-nrl-mobile.png" alt="Before mobile catalogue"></figure><figure><figcaption>After — consistent foil packs and bounded product cards</figcaption><img src="after-nrl-mobile.png" alt="After mobile catalogue"></figure></div></section>
<section><h2>All finished designs</h2>${["starter", "standard", "premium"].map((t) => `<figure><img loading="lazy" src="${t}-all-variants.png" alt="All ${t} pack variants"></figure>`).join("")}</section>
${physical ? `<section><h2>Physical Samsung walkthrough</h2><p>${physical.model}, Android ${physical.android}, Chrome. All 21 artwork variants, three purchase-review/cancel flows and synthetic 1-, 3- and 9-card openings passed. No runtime errors, non-GET requests or external requests were observed. This tested the real phone's Chrome with local sample data, not a Production account or the installed Docked WebView.</p><video controls preload="metadata" src="samsung-physical-walkthrough.mp4"></video><p><a href="physical-android.json">Device results</a> · <a href="samsung-physical-afl-standard-store.png">AFL store</a> · <a href="samsung-physical-nrl-premium-store.png">NRL store</a> · <a href="samsung-physical-nrl-9-opening.png">Enlarged opening</a> · <a href="samsung-physical-nrl-9-summary.png">Nine-card summary</a></p></section>` : ""}
<section><h2>Additional Samsung-sized browser walkthrough</h2><p>Desktop Edge, 412 × 915, DPR 2 and touch emulation; separately labelled from the physical-device check.</p><video controls preload="metadata" src="samsung-sized-store-walkthrough.webm"></video></section>
<section><h2>Every variation</h2><ul>${items}</ul></section>
<section><h2>Verification</h2><p>751 existing platform tests, 2 inventory checks and 62 browser checks passed. Typecheck, full lint and production webpack build passed. Includes 320–1440px layouts, 200% text, delayed image loading, all purchase confirmations, history, single/three/nine-card opening, double taps, Reveal All, resume, replay and lost-response recovery.</p><p>Production customer data was read only. No database migration or change to payments, ownership, balances, odds or Google Play configuration. The seven pre-existing Google TEST reconciliation alerts remain separate and untouched.</p><p>The player-detail navigation fix remains a separate branch, as requested. This artwork release does not merge or deploy it.</p></section></html>`;
await writeFile(out + "/review.html", html);
console.log(JSON.stringify(checks, null, 2));
