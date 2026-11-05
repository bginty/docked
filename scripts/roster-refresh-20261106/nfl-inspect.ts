/** Offline structural diagnosis of the locally cached public official pages. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const trace = [];
for (const team of ["ARI", "MIA", "TEN"]) {
  const record = JSON.parse(
    readFileSync(
      `private-data/roster-refresh-20261106/nfl/${team}.json`,
      "utf8",
    ),
  );
  const html = readFileSync(record.file, "utf8");
  if (createHash("sha256").update(html).digest("hex") !== record.sha256)
    throw Error("Cached source changed");
  let section = "Unknown";
  const tables = [];
  for (const m of html.matchAll(/<(h[234]|table)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m[1].toLowerCase() !== "table") {
      section = plain(m[2]);
      continue;
    }
    const heads = [...m[2].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((x) =>
      plain(x[1]),
    );
    const pos = heads.findIndex((h) => /^Pos/i.test(h));
    if (pos < 0) continue;
    const positions = [];
    for (const tr of m[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const td = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (x) => x[1],
      );
      if (td.length < 3) continue;
      if (
        !td[0].match(
          /<a\b[^>]*href=["']([^"']*players-roster[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
        )
      )
        continue;
      positions.push(plain(td[pos] ?? ""));
    }
    tables.push({
      section,
      headers: heads,
      positionIndex: pos,
      rows: positions.length,
      quarterbackRows: positions.filter((p) => p === "QB").length,
      observedPositions: [...new Set(positions)].sort(),
    });
  }
  trace.push({
    team,
    fetchedAt: record.fetchedAt,
    sha256: record.sha256,
    tables,
    totalRows: tables.reduce((n, t) => n + t.rows, 0),
  });
}
const report = {
  at: new Date().toISOString(),
  offlineOnly: true,
  sourceRequests: 0,
  productionWrites: 0,
  trace,
};
writeFileSync(
  "docs/qa/roster-refresh-20261106/nfl/parser-before-trace.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
