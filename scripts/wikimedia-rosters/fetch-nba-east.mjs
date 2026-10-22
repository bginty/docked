import fs from "node:fs/promises";
const url =
  "https://en.wikipedia.org/w/api.php?" +
  new URLSearchParams({
    action: "parse",
    page: "List of current NBA Eastern Conference team rosters",
    prop: "text|revid|displaytitle",
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
const r = await fetch(url, {
  headers: {
    "User-Agent":
      "DockedRosterReview/1.0 (https://docked.com.au; roster verification; contact via website)",
  },
  signal: AbortSignal.timeout(30000),
});
const body = await r.text();
if (!r.ok || JSON.parse(body).error)
  throw Error("Roster request failed; previous snapshot retained");
await fs.mkdir("private-data/roster-source-review", { recursive: true });
await fs.writeFile(
  "private-data/roster-source-review/nba-east-response.txt",
  body,
);
console.log(
  JSON.stringify({
    status: r.status,
    bytes: body.length,
    revision: JSON.parse(body).parse.revid,
  }),
);
