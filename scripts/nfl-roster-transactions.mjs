import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
const dir = "tmp/nfl-roster-audit";
const teams = JSON.parse(
  await readFile(`${dir}/official-rosters.json`, "utf8"),
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const t of teams) {
    const url = t.transactions ?? new URL("/team/transactions/", t.url).href;
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(`${dir}/${t.team}-transactions.html`, html);
      const page = await browser.newPage();
      const rows = await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return Array.from(doc.querySelectorAll("tbody tr")).map((n) =>
          n.textContent.replace(/\s+/g, " ").trim(),
        );
      }, html);
      await page.close();
      results.push({
        team: t.team,
        url,
        checkedAt,
        sha256: createHash("sha256").update(html).digest("hex"),
        rows,
        status: rows.length ? "retrieved" : "no-table-review-required",
      });
      console.log(t.team, rows.length);
    } catch (e) {
      results.push({
        team: t.team,
        url,
        checkedAt,
        status: "unavailable",
        error: e.message,
      });
    }
    await writeFile(
      `${dir}/official-transactions.json`,
      JSON.stringify(results, null, 2),
    );
  }
} finally {
  await browser.close();
}
