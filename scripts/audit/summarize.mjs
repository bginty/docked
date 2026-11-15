import fs from "node:fs";
const dir = "docs/qa/overnight-audit-20261115";
const perf = JSON.parse(
  fs.readFileSync(dir + "/public-performance/measurements.json", "utf8"),
);
perf.limitations = perf.limitations.map((x) =>
  x.includes("login redirect")
    ? "Anonymous /fantasy/cards renders the sign-in recovery screen, not a logged-in collection"
    : x,
);
fs.writeFileSync(
  dir + "/public-performance/measurements.json",
  JSON.stringify(perf, null, 2) + "\n",
);
const median = (a) => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
const rows = [];
for (const profile of ["desktop", "android-simulated"])
  for (const route of ["/", "/login", "/privacy", "/fantasy/cards"]) {
    const xs = perf.results.filter(
      (x) => x.profile === profile && x.route === route,
    );
    const bytes = (x, kind, field) =>
      x.metrics.resources
        .filter((r) =>
          kind === "js" ? r.path.endsWith(".js") : r.path.endsWith(".css"),
        )
        .reduce((n, r) => n + r[field], 0);
    rows.push({
      profile,
      route,
      n: xs.length,
      lcpMedianMs: median(xs.map((x) => x.metrics.lcp)),
      ttfbMedianMs: median(xs.map((x) => x.metrics.navigation.ttfb)),
      loadEventMedianMs: median(xs.map((x) => x.metrics.navigation.loadEvent)),
      clsWindowMax: Math.max(...xs.map((x) => x.metrics.cls)),
      jsEncodedMedianBytes: median(
        xs.map((x) => bytes(x, "js", "encodedBytes")),
      ),
      jsDecodedMedianBytes: median(
        xs.map((x) => bytes(x, "js", "decodedBytes")),
      ),
      cssEncodedMedianBytes: median(
        xs.map((x) => bytes(x, "css", "encodedBytes")),
      ),
      cssDecodedMedianBytes: median(
        xs.map((x) => bytes(x, "css", "decodedBytes")),
      ),
      maxLongTaskMs: Math.max(0, ...xs.flatMap((x) => x.metrics.longTasks)),
      eventSampleDurationsMs: xs.flatMap((x) => x.metrics.events),
      horizontalOverflow: xs.some((x) => x.metrics.horizontalOverflow),
      scriptErrors: xs.flatMap((x) => x.consoleErrors),
    });
  }
fs.writeFileSync(
  dir + "/performance-summary.json",
  JSON.stringify(
    {
      at: perf.at,
      source: perf.source,
      notes: [
        "Resource bytes include observed Next prefetches; these are downloaded JS totals, not one bundle.",
        "encodedBytes are payload bytes before decompression, excluding HTTP headers.",
        "loadEvent is Navigation Timing, whereas loadedMs in raw data includes the intentional 2.5-second observation wait.",
        "TTFB includes browser scheduling/redirect/network/server time; it is not pure database time.",
        "This small lab sample is not field INP or a field percentile.",
        "No authenticated Production transaction or real Android test was performed.",
      ],
      rows,
    },
    null,
    2,
  ) + "\n",
);
const tests = fs.readFileSync(
  "private-data/overnight-audit-20261115/focused-tests.log",
  "utf8",
);
const repeat = fs.readFileSync(
  "private-data/overnight-audit-20261115/community-repeat.log",
  "utf8",
);
fs.writeFileSync(
  dir + "/focused-test-summary.json",
  JSON.stringify(
    {
      source: perf.source,
      initial: {
        tests: 142,
        passed: 141,
        failed: 1,
        failure:
          "community-social anonymous body-denial subprocess exceeded its existing 20-second timeout",
      },
      isolatedRepeat: { tests: 8, passed: 8, failed: 0, unchangedSource: true },
      testNames: tests
        .split(/\r?\n/)
        .filter((x) => /^# Subtest:/.test(x))
        .map((x) => x.slice(11)),
      initialTail: tests.split(/\r?\n/).slice(-10),
      repeatTail: repeat.split(/\r?\n/).slice(-10),
    },
    null,
    2,
  ) + "\n",
);
const deps = JSON.parse(
  fs
    .readFileSync(
      "private-data/overnight-audit-20261115/npm-audit.json",
      "utf8",
    )
    .replace(/^\uFEFF/, ""),
);
fs.writeFileSync(
  dir + "/dependency-audit.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      command: "npm audit --omit=dev --json",
      ...deps,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    rows.map(
      ({
        profile,
        route,
        lcpMedianMs,
        jsEncodedMedianBytes,
        cssEncodedMedianBytes,
      }) => ({
        profile,
        route,
        lcpMedianMs,
        jsEncodedMedianBytes,
        cssEncodedMedianBytes,
      }),
    ),
  ),
);
