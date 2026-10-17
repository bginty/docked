import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const out = "private-data/nfl-roster-reconciliation/supplement";
await mkdir(out, { recursive: true });
// Targeted gap-filling only; the 32 roster captures remain unchanged.
const pages = [
  [
    "MIN-retirement",
    "https://www.vikings.com/news/adam-thielen-cj-ham-careers-retirement-friendship-defied-odds",
    ["Adam Thielen", "C.J. Ham"],
    "retired",
    "2026-03-24",
  ],
  [
    "DAL-retirement",
    "https://www.dallascowboys.com/news/parris-campbell-makes-decision-on-nfl-future-cowboys-move-to-retired-list",
    ["Parris Campbell"],
    "reserve-retired",
    "2026-05-27",
  ],
  [
    "WAS-cuts",
    "https://www.commanders.com/news/commanders-announce-multiple-roster-cuts-place-2-players-on-ir",
    ["Tre\' McKitty", "Jacoby Jones", "Quentin Moore", "Nick Nash"],
    "released",
    "2026-08-30",
  ],
  [
    "ATL-cuts",
    "https://www.atlantafalcons.com/news/atlanta-falcons-2026-roster",
    ["Cash Jones", "Keelan Marion"],
    "released",
    "2026-08-30",
  ],
  [
    "DAL-cuts",
    "https://www.dallascowboys.com/news/jaydon-blue-y-sam-williams-entre-cortes-del-roster-de-los-cowboys",
    ["Jashaun Corbin", "Jaden Smith", "Mitch Van Vooren"],
    "released",
    "2026-08-30",
  ],
  [
    "NO-cuts",
    "https://www.neworleanssaints.com/news/decamerion-richardson-saints-roster-moves-transaction-alert-october-13-2026",
    ["Trey Palmer", "Ulysses Bentley IV", "Brock Rechsteiner"],
    "released",
    "2026-10-13",
  ],
  [
    "SF-cuts",
    "https://www.49ers.com/news/49ers-announce-moves-for-initial-53-man-roster-x1231",
    ["Adrian Martinez"],
    "released",
    "2026-08-30",
  ],
];
const audit = JSON.parse(
  await readFile("docs/qa/nfl-roster-audit/catalogue-audit.json", "utf8"),
);
const results = [];
for (const [key, url, names, decision, eventDate] of pages) {
  let body, checkedAt;
  try {
    const saved = JSON.parse(await readFile(`${out}/${key}.json`, "utf8"));
    body = saved.body;
    checkedAt = saved.checkedAt;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error(`${key}: HTTP ${r.status}`);
    body = await r.text();
    checkedAt = new Date().toISOString();
    await writeFile(
      `${out}/${key}.json`,
      JSON.stringify({ url, body, checkedAt }),
    );
  }
  for (const name of names) {
    const p = audit.records.find((p) => p.name === name);
    if (!p) throw Error(name);
    results.push({
      providerId: p.providerId,
      name,
      url,
      checkedAt,
      sha256: createHash("sha256").update(body).digest("hex"),
      eventDate,
      decision,
      reason:
        decision === "reserve-retired"
          ? "Official retirement announcement; retained reserve identity, no removal"
          : "Official team announcement explicitly confirms departure; absent current all-team roster capture",
    });
  }
}
await writeFile(
  "docs/qa/nfl-roster-reconciliation/supplemental-evidence.json",
  JSON.stringify(results, null, 2),
);
console.log({ pages: pages.length, identities: results.length });
