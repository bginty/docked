/** New dated AFL/NRL-only observation. Never imports/approves/changes published data. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "private-data/roster-refresh-20261106/wikimedia",
  out = "docs/qa/roster-refresh-20261106/wikimedia";
await fs.mkdir(root, { recursive: true });
await fs.mkdir(out, { recursive: true });
const endpoint = "https://en.wikipedia.org/w/api.php";
const headers = {
  "User-Agent":
    "DockedRosterReview/1.1 (https://docked.com.au; support@docked.com.au; dated AFL/NRL factual roster verification)",
  Accept: "application/json",
  "Accept-Encoding": "gzip",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function request(parameters, file) {
  assert(
    !(await fs.access(file).then(
      () => true,
      () => false,
    )),
    "Dated raw observation already exists; do not overwrite",
  );
  const url =
    endpoint +
    "?" +
    new URLSearchParams({
      ...parameters,
      format: "json",
      formatversion: "2",
      maxlag: "5",
    });
  assert(
    !/\b(?:NBA|basketball)\b/i.test(
      Object.values(parameters).join(" ").replaceAll("_", " "),
    ),
  );
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
  const raw = await r.text();
  const observedAt = new Date().toISOString();
  if (!r.ok) {
    await fs.writeFile(root + "/blocked-response.private.txt", raw, {
      mode: 0o600,
    });
    await fs.writeFile(
      out + "/access-blocker.json",
      JSON.stringify(
        {
          observedAt,
          status: r.status,
          endpoint,
          action: parameters.action,
          reason:
            "Provider access/rate restriction; no bypass or speculative retry attempted",
          rawResponsePrivate: true,
        },
        null,
        2,
      ),
    );
    throw Error("Wikimedia request stopped: HTTP" + r.status);
  }
  const data = JSON.parse(raw);
  if (data.error) {
    await fs.writeFile(root + "/blocked-response.private.json", raw, {
      mode: 0o600,
    });
    throw Error(
      "Wikimedia API error " + data.error.code + "; stopped without bypass",
    );
  }
  const wrapped = {
    ...data,
    docked: {
      observedAt,
      url,
      responseSha256: hash(raw),
      license: "CC-BY-SA-4.0",
      identifierLicense: "CC0",
      expandedHtmlSha256: data.parse?.text ? hash(data.parse.text) : undefined,
      responseDate: r.headers.get("date"),
    },
  };
  await fs.writeFile(file, JSON.stringify(wrapped), {
    mode: 0o600,
    flag: "wx",
  });
  return wrapped;
}
if (process.argv[2] === "rosters") {
  const summaries = [];
  for (const [sport, page] of [
    ["afl", "List of current AFL team squads"],
    ["nrl", "List of current NRL team squads"],
  ]) {
    const file = root + "/" + sport + "-current.json";
    const data = await request(
      { action: "parse", page, prop: "text|revid|displaytitle|templates" },
      file,
    );
    summaries.push({
      sport,
      title: data.parse.title,
      rootRevision: data.parse.revid,
      observedAt: data.docked.observedAt,
      responseSha256: data.docked.responseSha256,
      expandedHtmlSha256: data.docked.expandedHtmlSha256,
      templates: data.parse.templates?.length ?? 0,
      sourceUrl: data.docked.url,
    });
    console.log(JSON.stringify(summaries.at(-1)));
  }
  await fs.writeFile(
    out + "/root-observations.json",
    JSON.stringify(summaries, null, 2),
  );
} else if (process.argv[2] === "templates") {
  const titles = [];
  for (const sport of ["afl", "nrl"]) {
    const d = JSON.parse(
      await fs.readFile(root + "/" + sport + "-current.json", "utf8"),
    );
    for (const t of d.parse.templates ?? []) {
      const title = t.title ?? t["*"];
      if (
        sport === "afl"
          ? / AFL personnel$/.test(title)
          : / current squad$/.test(title) && !title.includes("Rugby league")
      )
        titles.push(title);
    }
  }
  assert.equal(new Set(titles).size, 35);
  const data = await request(
    {
      action: "query",
      titles: titles.sort().join("|"),
      prop: "revisions",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      redirects: "1",
    },
    root + "/team-templates.json",
  );
  await fs.writeFile(
    out + "/team-template-request.json",
    JSON.stringify(
      {
        observedAt: data.docked.observedAt,
        responseSha256: data.docked.responseSha256,
        sourceUrl: data.docked.url,
        pages: data.query.pages.length,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      templates: data.query.pages.length,
      observedAt: data.docked.observedAt,
    }),
  );
} else if (process.argv[2] === "supplement") {
  await fs.mkdir(root + "/supplement", { recursive: true });
  const observations = [];
  for (const [key, team, heading] of [
    ["bri", "Brisbane Broncos", "Squad information"],
    ["nql", "North Queensland Cowboys", "Squad"],
    ["war", "New Zealand Warriors", "Squad"],
  ]) {
    const page = "2026 " + team + " season";
    const meta = await request(
      { action: "parse", page, prop: "revid|sections" },
      root + "/supplement/" + key + "-sections.json",
    );
    const sections = meta.parse.sections.filter((r) => r.line === heading);
    assert.equal(
      sections.length,
      1,
      "Exact named squad section required: " + team,
    );
    const section = sections[0].index;
    assert(/^\d+$/.test(section));
    const d = await request(
      {
        action: "parse",
        oldid: String(meta.parse.revid),
        section,
        prop: "text|revid|displaytitle|templates",
      },
      root + "/supplement/" + key + "-squad.json",
    );
    assert.equal(d.parse.revid, meta.parse.revid);
    assert.equal(d.parse.title, page);
    observations.push({
      key,
      team,
      page,
      season: "2026",
      section,
      heading,
      revision: d.parse.revid,
      observedAt: d.docked.observedAt,
      sourceUrl: d.docked.url,
      responseSha256: d.docked.responseSha256,
      expandedHtmlSha256: d.docked.expandedHtmlSha256,
    });
    console.log(JSON.stringify({ team, section, revision: d.parse.revid }));
  }
  await fs.writeFile(
    out + "/supplement-observations.json",
    JSON.stringify(observations, null, 2),
  );
} else if (process.argv[2] === "profiles") {
  const rows = JSON.parse(await fs.readFile(root + "/discovered.json", "utf8"));
  assert(rows.every((r) => ["afl", "nrl"].includes(r.sport)));
  const titles = [...new Set(rows.map((r) => r.sourceTitle))].sort();
  await fs.mkdir(root + "/profiles", { recursive: true });
  const pages = [],
    requests = [];
  for (let i = 0; i < titles.length; i += 35) {
    const batch = titles.slice(i, i + 35);
    const file =
      root + "/profiles/batch-" + String(i).padStart(4, "0") + ".json";
    let data = await fs.readFile(file, "utf8").then(JSON.parse, () => null);
    if (data) {
      assert.equal(
        new URL(data.docked.url).searchParams.get("titles"),
        batch.join("|"),
      );
      assert(data.docked.observedAt.startsWith("2026-11-"));
    } else
      data = await request(
        {
          action: "query",
          titles: batch.join("|"),
          prop: "revisions|pageprops",
          rvprop: "ids|timestamp|content",
          rvslots: "main",
          redirects: "1",
        },
        file,
      );
    pages.push(...data.query.pages);
    requests.push({
      file: file.split("/").at(-1),
      observedAt: data.docked.observedAt,
      responseSha256: data.docked.responseSha256,
      sourceUrl: data.docked.url,
      requested: batch.length,
    });
    console.log(
      JSON.stringify({
        processed: Math.min(i + 35, titles.length),
        total: titles.length,
      }),
    );
  }
  await fs.writeFile(root + "/profiles.json", JSON.stringify(pages), {
    mode: 0o600,
  });
  await fs.writeFile(
    out + "/profile-requests.json",
    JSON.stringify(requests, null, 2),
  );
} else
  throw Error(
    "Expected rosters/templates/profiles/supplement; no mutation mode exists",
  );
