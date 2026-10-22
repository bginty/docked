import fs from "node:fs/promises";
const sources = {
  nbaWest: "List of current NBA Western Conference team rosters",
  afl: "List of current AFL team squads",
  nrl: "List of current NRL team squads",
};
const headers = {
  "User-Agent":
    "DockedRosterReview/1.0 (https://docked.com.au; roster verification)",
};
for (const [key, page] of Object.entries(sources)) {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "parse",
      page,
      prop: "text|revid|displaytitle",
      format: "json",
      formatversion: "2",
      maxlag: "5",
    });
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`${key}: HTTP ${r.status}`);
  const data = await r.json();
  if (data.error) throw Error(JSON.stringify(data.error));
  await fs.writeFile(
    `private-data/roster-source-review/${key}.json`,
    JSON.stringify({
      ...data,
      docked: {
        fetchedAt: new Date().toISOString(),
        url,
        license: "CC-BY-SA-4.0",
      },
    }),
  );
  console.log(
    JSON.stringify({
      key,
      title: data.parse.title,
      pageId: data.parse.pageid,
      revision: data.parse.revid,
      bytes: data.parse.text.length,
    }),
  );
}
