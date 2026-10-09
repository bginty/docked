import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { reviewedOpenFootballSources } from "../../src/core/research-source-catalogue";
import {
  fetchResearchDataset,
  researchAdapter,
  researchDueWindow,
  researchJobKey,
  researchRetryAt,
  ResearchFetchError,
} from "../../src/core/research-scheduler";

// Injected responses only. These tests never use global fetch or provider/network data.
const now = "2026-10-04T12:00:00Z";
const source = () => reviewedOpenFootballSources()[1];
const fixture = () => ({
  name: "English Premier League 2026/27",
  matches: [
    {
      round: "Fictional matchday",
      date: "2026-09-01",
      team1: "AUTHORED HOME",
      team2: "AUTHORED AWAY",
      score: { ft: [1, 0] },
    },
  ],
});
const input = () => ({
  enabled: true,
  source: source(),
  jurisdiction: "AU:NSW",
  now,
});
const request = (
  factory: (url: string, init?: RequestInit) => Response | Promise<Response>,
) => (async (url, init) => factory(String(url), init)) as typeof fetch;

test("research job slots are deterministic across retries and change on kickoff/participant revision", () => {
  const key = {
    scheduleId: "fixture-schedule",
    eventId: "fixture-event",
    startAt: "2026-10-05T12:00:00Z",
    participants: ["Home", "Away"],
    window: 86400,
  };
  assert.equal(researchJobKey(key), researchJobKey(structuredClone(key)));
  assert.notEqual(
    researchJobKey(key),
    researchJobKey({ ...key, startAt: "2026-10-05T13:00:00Z" }),
  );
  assert.notEqual(
    researchJobKey(key),
    researchJobKey({ ...key, participants: ["Away", "Home"] }),
  );
  assert.equal(
    researchDueWindow(key.startAt, now, [259200, 86400, 21600]),
    86400,
  );
  assert.equal(
    researchDueWindow(
      key.startAt,
      "2026-10-05T08:00:00Z",
      [259200, 86400, 21600],
    ),
    21600,
  );
  assert.equal(researchDueWindow(key.startAt, key.startAt, [86400]), null);
  assert.equal(researchDueWindow("invalid", now, [86400]), null);
});

test("disabled/unapproved/expired/wrong endpoint paths make zero fetch calls using actual immediate clock", async () => {
  let calls = 0;
  const fetcher = request(() => {
    calls++;
    return new Response(JSON.stringify(fixture()));
  });
  for (const changed of [
    { ...input(), enabled: false },
    {
      ...input(),
      source: { ...source(), rightsState: "APPROVED_MANUAL_ONLY" as const },
    },
    {
      ...input(),
      source: { ...source(), reviewDueAt: "2026-10-04T11:00:00Z" },
      now: "2026-10-04T10:00:00Z",
    },
    {
      ...input(),
      source: {
        ...source(),
        endpoint: "https://raw.githubusercontent.com/unreviewed/data.json",
      },
    },
    { ...input(), jurisdiction: "UNKNOWN" },
  ])
    await assert.rejects(fetchResearchDataset(changed, fetcher, () => now));
  assert.equal(calls, 0);
  assert.throws(() =>
    researchAdapter({
      ...source(),
      endpoint: source().endpoint.replace("https:", "http:"),
    }),
  );
});

test("approved injected dataset keeps actual byte hash, unknown publication/finality and bounded request settings", async () => {
  const raw = ` \n${JSON.stringify(fixture(), null, 2)}\n`;
  let calls = 0;
  const result = await fetchResearchDataset(
    input(),
    request((url, init) => {
      calls++;
      assert.equal(url, source().endpoint);
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      assert.equal(
        (init?.headers as Record<string, string>).Accept,
        "application/json",
      );
      return new Response(raw, {
        status: 200,
        headers: { etag: '"fictional-etag"' },
      });
    }),
    () => now,
  );
  assert.equal(calls, 1);
  assert.equal(result.status, "SUCCESS");
  if (result.status !== "SUCCESS") throw Error("Expected injected fixture");
  assert.equal(result.rawHash, createHash("sha256").update(raw).digest("hex"));
  assert.equal(result.observedAt, now);
  assert.equal(result.dataset.sourcePublishedAt, null);
  assert.equal(result.quality.modelReady, false);
  assert.equal(result.quality.settlementReady, false);
  assert.equal("startAt" in result.dataset.matches[0], false);
  assert.equal("probabilities" in result, false);
});

test("conditional304 carries no invented dataset; only safe supplied validators are transmitted", async () => {
  const result = await fetchResearchDataset(
    {
      ...input(),
      etag: '"stored-fixture-etag"',
      lastModified: "Wed, 30 Sep 2026 00:00:00 GMT",
    },
    request((_url, init) => {
      assert.equal(
        (init?.headers as Record<string, string>)["If-None-Match"],
        '"stored-fixture-etag"',
      );
      return new Response(null, {
        status: 304,
        headers: { etag: '"stored-fixture-etag"' },
      });
    }),
    () => now,
  );
  assert.equal(result.status, "NOT_MODIFIED");
  assert.equal("dataset" in result, false);
  await assert.rejects(
    fetchResearchDataset(
      input(),
      request(() => new Response(null, { status: 304 })),
      () => now,
    ),
    (error: unknown) =>
      error instanceof ResearchFetchError && error.code === "SOURCE_CACHE_MISS",
  );
  await fetchResearchDataset(
    { ...input(), etag: "bad\r\nHeader: x", lastModified: "bad\nvalue" },
    request((_url, init) => {
      assert.equal(
        "If-None-Match" in (init?.headers as Record<string, string>),
        false,
      );
      assert.equal(
        "If-Modified-Since" in (init?.headers as Record<string, string>),
        false,
      );
      return new Response(JSON.stringify(fixture()));
    }),
    () => now,
  );
});

test("429/503 retry information is preserved without internal retries or free extra requests", async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    await assert.rejects(
      fetchResearchDataset(
        input(),
        request(() => {
          calls++;
          return new Response(null, {
            status,
            headers: { "retry-after": "120" },
          });
        }),
        () => now,
      ),
      (error: unknown) =>
        error instanceof ResearchFetchError &&
        error.httpStatus === status &&
        error.retryAt === "2026-10-04T12:02:00.000Z",
    );
    assert.equal(calls, 1);
  }
  assert.equal(
    researchRetryAt("Sun, 04 Oct 2026 12:03:00 GMT", now),
    "2026-10-04T12:03:00.000Z",
  );
  for (const value of [null, "bad", "-1", "Sat, 03 Oct 2026 12:03:00 GMT"])
    assert.equal(researchRetryAt(value, now), null);
});

test("schema drift, wrong season, future reported result and invalid JSON degrade without facts", async () => {
  for (const payload of [
    "{bad-json",
    JSON.stringify({ ...fixture(), marketProbability: "0.7" }),
    JSON.stringify({ ...fixture(), name: "English Premier League 2025/26" }),
    JSON.stringify({
      ...fixture(),
      matches: [{ ...fixture().matches[0], date: "2027-01-01" }],
    }),
  ]) {
    await assert.rejects(
      fetchResearchDataset(
        input(),
        request(() => new Response(payload)),
        () => now,
      ),
      (error: unknown) =>
        error instanceof ResearchFetchError &&
        error.code === "SOURCE_ADAPTER_DEGRADED",
    );
  }
});

test("declared and streamed oversized bodies are rejected before any dataset can be returned", async () => {
  await assert.rejects(
    fetchResearchDataset(
      input(),
      request(
        () =>
          new Response("small", { headers: { "content-length": "2000001" } }),
      ),
      () => now,
    ),
    (error: unknown) =>
      error instanceof ResearchFetchError && error.code === "SOURCE_BODY_LIMIT",
  );
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(2000001));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    fetchResearchDataset(
      input(),
      request(() => new Response(body)),
      () => now,
    ),
    (error: unknown) =>
      error instanceof ResearchFetchError && error.code === "SOURCE_BODY_LIMIT",
  );
  assert.equal(cancelled, true);
});
