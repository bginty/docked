import fs from "node:fs/promises";
const url =
  "https://en.wikipedia.org/w/api.php?" +
  new URLSearchParams({
    action: "parse",
    page: "List of current NRL team squads",
    prop: "templates",
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
await fs.writeFile(
  "private-data/roster-source-review/nrl-templates.json",
  JSON.stringify(d),
);
console.log(d.parse.templates.filter((t) => /squad|roster/i.test(t.title)));
