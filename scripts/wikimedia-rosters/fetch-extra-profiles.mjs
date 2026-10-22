import fs from "node:fs/promises";
const root = "private-data/roster-source-review";
const rows = JSON.parse(await fs.readFile(root + "/discovered.json", "utf8"));
const pages = JSON.parse(await fs.readFile(root + "/profiles.json", "utf8"));
const known = new Set(pages.map((p) => p.title));
for (const f of await fs.readdir(root + "/profiles")) {
  const d = JSON.parse(await fs.readFile(root + "/profiles/" + f, "utf8"));
  for (const r of [...(d.query.normalized ?? []), ...(d.query.redirects ?? [])])
    known.add(r.from);
}
const missing = [...new Set(rows.map((r) => r.sourceTitle))].filter(
  (t) => !known.has(t),
);
for (let i = 0; i < missing.length; i += 35) {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: missing.slice(i, i + 35).join("|"),
      prop: "revisions|pageprops",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      redirects: "1",
      format: "json",
      formatversion: "2",
      maxlag: "5",
    });
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "DockedRosterReview/1.0 (https://docked.com.au; roster verification)",
    },
  });
  const d = await r.json();
  if (d.error) throw Error(d.error.info);
  d.docked = { fetchedAt: new Date().toISOString(), url };
  await fs.writeFile(
    root + "/profiles/batch-extra-" + i + ".json",
    JSON.stringify(d),
  );
  pages.push(...d.query.pages);
}
await fs.writeFile(root + "/profiles.json", JSON.stringify(pages));
console.log({ additional: missing.length });
