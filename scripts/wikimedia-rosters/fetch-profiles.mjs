import fs from "node:fs/promises";
const root = process.argv[2] ?? "private-data/roster-source-review";
const rows = JSON.parse(await fs.readFile(root + "/discovered.json", "utf8"));
const titles = [...new Set(rows.map((x) => x.sourceTitle))];
await fs.mkdir(root + "/profiles", { recursive: true });
const pages = [];
for (let i = 0; i < titles.length; i += 35) {
  const file = root + "/profiles/batch-" + i + ".json";
  let data = await fs.readFile(file, "utf8").then(JSON.parse, () => null);
  const requested = titles.slice(i, i + 35).join("|");
  if (data && new URL(data.docked.url).searchParams.get("titles") !== requested)
    data = null;
  if (!data) {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        titles: titles.slice(i, i + 35).join("|"),
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
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    data = await r.json();
    if (data.error) throw Error(JSON.stringify(data.error));
    data.docked = {
      fetchedAt: new Date().toISOString(),
      url,
      license: "CC-BY-SA-4.0",
    };
    await fs.writeFile(file, JSON.stringify(data));
  }
  pages.push(...data.query.pages);
  console.log(
    JSON.stringify({
      processed: Math.min(i + 35, titles.length),
      total: titles.length,
    }),
  );
}
await fs.writeFile(root + "/profiles.json", JSON.stringify(pages));
