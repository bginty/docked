// Operator-only, bounded diagnostic. Never imported by web/Android. No automatic activation.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const key = process.env.API_FOOTBALL_KEY;
if (!key) {
  console.log("API_FOOTBALL_STATUS=NOT_CONFIGURED");
  process.exit(0);
}
if (
  !process.argv.includes("--probe") ||
  process.env.API_FOOTBALL_TEST_STORAGE_APPROVED !== "true"
)
  throw Error("Explicit probe and approved test/storage scope required");
const fixture = process.env.API_FOOTBALL_COMPLETED_FIXTURE;
if (!/^\d+$/.test(fixture ?? ""))
  throw Error(
    "Supply a reviewed completed EPL fixture ID from the account dashboard",
  );
const date = new Date().toISOString().slice(0, 10),
  dir = "private-data/api-football";
mkdirSync(dir, { recursive: true });
const receipt = `${dir}/${date}-probe.json`;
if (existsSync(receipt))
  throw Error("One bounded probe/day; inspect existing receipt");
const report = {
  at: new Date().toISOString(),
  requests: [],
  acceptedForScoring: false,
  missingGuarantees: [
    "Regulation-only exact seconds and on-pitch intervals",
    "Deterministic same-minute event ordering",
    "Assist, dismissal and penalty-save definitions",
    "Permitted hosted fantasy use, retention and attribution",
  ],
};
writeFileSync(receipt, JSON.stringify(report));
for (const path of [
  "/status",
  "/leagues?id=39&season=2026",
  `/fixtures?id=${fixture}`,
  `/fixtures/players?fixture=${fixture}`,
  `/fixtures/events?fixture=${fixture}`,
  `/fixtures/lineups?fixture=${fixture}`,
]) {
  const r = await fetch("https://v3.football.api-sports.io" + path, {
    headers: { "x-apisports-key": key },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  if (text.length > 3000000) throw Error("Oversized response");
  const body = JSON.parse(text),
    errors = body.errors;
  const entry = {
    path,
    status: r.status,
    results: body.results ?? null,
    remaining: r.headers.get("x-ratelimit-requests-remaining"),
    sha256: createHash("sha256").update(text).digest("hex"),
    providerErrors: !!errors && Object.keys(errors).length > 0,
  };
  report.requests.push(entry);
  writeFileSync(receipt, JSON.stringify(report, null, 2));
  if (!r.ok || entry.providerErrors) break;
  // Status includes account details; retain privately and only for approved diagnostic storage.
  writeFileSync(`${dir}/${date}-${report.requests.length}.json`, text);
  if (path.startsWith("/fixtures?id=")) {
    const f = body.response?.[0];
    if (
      f?.league?.id !== 39 ||
      f?.league?.season !== 2026 ||
      f?.fixture?.status?.short !== "FT"
    )
      throw Error("Completed regulation EPL 2026 fixture required");
  }
}
console.log(
  JSON.stringify({
    requests: report.requests.length,
    acceptedForScoring: false,
    receipt: "Ignored private operator receipt",
    next: "Inspect exact fields and rights; no scoring activation",
  }),
);
