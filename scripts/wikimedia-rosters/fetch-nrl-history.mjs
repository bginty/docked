import fs from "node:fs/promises";
const root = "private-data/roster-source-review";
const titles = JSON.parse(
  await fs.readFile(root + "/nrl-templates.json", "utf8"),
)
  .parse.templates.filter((t) => /current squad/.test(t.title))
  .map((t) => t.title);
const request = async (params) => {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      format: "json",
      formatversion: "2",
      maxlag: "5",
      ...params,
    });
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "DockedRosterReview/1.0 (https://docked.com.au; roster verification)",
    },
  });
  if (!r.ok) throw Error(r.status);
  return {
    ...(await r.json()),
    docked: { fetchedAt: new Date().toISOString(), url },
  };
};
await fs.writeFile(
  root + "/nrl-current-templates.json",
  JSON.stringify(await request({ titles: titles.join("|") })),
);
for (const club of [
  "Brisbane Broncos",
  "New Zealand Warriors",
  "North Queensland Cowboys",
]) {
  const data = await request({
    titles: "Template:" + club + " current squad",
    rvstart: "2026-09-30T23:59:59Z",
    rvlimit: "1",
  });
  await fs.writeFile(
    root + "/nrl-history-" + club.replaceAll(" ", "-") + ".json",
    JSON.stringify(data),
  );
  console.log(club, data.query.pages[0].revisions[0].timestamp);
}
