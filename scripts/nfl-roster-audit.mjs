import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

// Public official team pages only. No credentials, feed worker or database writes.
const teams = {
  ARI: "azcardinals",
  ATL: "atlantafalcons",
  BAL: "baltimoreravens",
  BUF: "buffalobills",
  CAR: "panthers",
  CHI: "chicagobears",
  CIN: "bengals",
  CLE: "clevelandbrowns",
  DAL: "dallascowboys",
  DEN: "denverbroncos",
  DET: "detroitlions",
  GB: "packers",
  HOU: "houstontexans",
  IND: "colts",
  JAX: "jaguars",
  KC: "chiefs",
  LAC: "chargers",
  LAR: "therams",
  LV: "raiders",
  MIA: "miamidolphins",
  MIN: "vikings",
  NE: "patriots",
  NO: "neworleanssaints",
  NYG: "giants",
  NYJ: "newyorkjets",
  PHI: "philadelphiaeagles",
  PIT: "steelers",
  SEA: "seahawks",
  SF: "49ers",
  TB: "buccaneers",
  TEN: "tennesseetitans",
  WAS: "commanders",
};
const directory = process.argv[2] ?? "tmp/nfl-roster-audit";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const evidence = [];
try {
  for (const [team, domain] of Object.entries(teams)) {
    const url = `https://www.${domain}.com/team/players-roster/`;
    let checkedAt = new Date().toISOString();
    try {
      const file = `${directory}/${team}.html`;
      let html;
      if (process.argv.includes("--cached")) {
        html = await readFile(file, "utf8");
        // Re-parsing cached bytes is not a fresh upstream verification.
        checkedAt = (await stat(file)).mtime.toISOString();
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        html = await response.text();
        await writeFile(file, html);
      }
      const page = await browser.newPage();
      const data = await page.evaluate(
        ({ html, url }) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          let section = "Unknown";
          const players = [];
          for (const node of doc.querySelectorAll("h2,h3,h4,table")) {
            if (node.tagName !== "TABLE") {
              section = node.textContent.trim();
              continue;
            }
            const heads = Array.from(node.querySelectorAll("thead th")).map(
              (n) => n.textContent.trim(),
            );
            if (!heads.some((h) => /Pos/.test(h))) continue;
            for (const tr of node.querySelectorAll("tbody tr")) {
              const td = Array.from(tr.querySelectorAll("td"));
              if (td.length < 3) continue;
              const link = td[0].querySelector('a[href*="players-roster"]');
              players.push({
                name: td[0].textContent.trim().replace(/\s+/g, " "),
                position:
                  td[heads.findIndex((h) => /Pos/.test(h))]?.textContent.trim(),
                section,
                profile: link
                  ? new URL(link.getAttribute("href"), url).href
                  : null,
                cells: td.map((n) => n.textContent.trim().replace(/\s+/g, " ")),
                headers: heads,
              });
            }
          }
          const transactions = Array.from(doc.querySelectorAll("a[href]")).find(
            (n) => n.textContent.trim().toLowerCase() === "transactions",
          );
          return {
            title: doc.title,
            players,
            transactions: transactions
              ? new URL(transactions.getAttribute("href"), url).href
              : null,
          };
        },
        { html, url },
      );
      await page.close();
      const rows = data.players.filter((p) => p.profile);
      const valid =
        rows.length >= 45 &&
        rows.length <= 110 &&
        rows.some((p) => p.position === "QB") &&
        rows.every((p) => p.section !== "Unknown");
      evidence.push({
        team,
        url,
        checkedAt,
        sha256: createHash("sha256").update(html).digest("hex"),
        status: valid ? "parsed-review-required" : "incomplete",
        ...data,
      });
      console.log(team, rows.length, valid ? "parsed" : "INCOMPLETE");
    } catch (e) {
      evidence.push({
        team,
        url,
        checkedAt,
        status: "unavailable",
        error: e.message,
      });
      console.log(team, e.message);
    }
    await writeFile(
      `${directory}/official-rosters.json`,
      JSON.stringify(evidence, null, 2),
    );
  }
} finally {
  await browser.close();
}
