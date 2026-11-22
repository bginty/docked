import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import vm from "node:vm";
import { ownerRosterCsv } from "../../src/core/owner-roster-export";
import {
  ownerRosterQuery,
  type OwnerRosterReport,
  type OwnerRosterRow,
} from "../../src/core/commercial-player-roster";

const nativeRequire = createRequire(import.meta.url);
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
const command = {
  request: "44444444-4444-4444-8444-444444444444",
  reference: "Official club review fixture",
  confirmed: true,
  changes: [
    {
      playerId: other,
      sport: "afl",
      expectedRevision: null,
      registration: "DELISTED",
      availability: "UNKNOWN",
      currentClub: null,
      source: {
        url: "https://www.afl.com.au/news/fixture",
        hash: "a".repeat(64),
        observedAt: "2026-11-22T00:00:00Z",
        effectiveAt: "2026-11-21T00:00:00Z",
      },
    },
  ],
};
const base: OwnerRosterRow = {
  playerId: other,
  sport: "afl",
  name: "Synthetic player",
  currentClubId: "ADE",
  currentClubName: "Adelaide",
  savedClubs: ["Old club"],
  registration: "ACTIVE",
  availability: "AVAILABLE",
  verification: "VERIFIED",
  eligibility: true,
  eligibilityReason: "Approved supply and current registration",
  observedAt: "2026-11-22T00:00:00Z",
  effectiveAt: "2026-11-21T00:00:00Z",
  reviewedAt: "2026-11-22T00:01:00Z",
  evidenceUrl: "https://www.afl.com.au/news/fixture",
  evidenceHash: "a".repeat(64),
  revision: session,
  existingCards: 7,
  definitionCount: 5,
  approvedDefinitions: 5,
  lifetimeIssued: 12,
  aliases: [{ provider: "fixture", providerId: "synthetic-1" }],
  supply: [],
};
function report(rows: OwnerRosterRow[]): OwnerRosterReport {
  return {
    generatedAt: "2026-11-22T00:02:00Z",
    filters: ownerRosterQuery.parse({}),
    rows,
    total: rows.length,
    page: 1,
    pageSize: 100,
    hasMore: false,
    clubs: [],
    summary: {
      verified: rows.length,
      legacy: 0,
      eligible: rows.length,
      excluded: 0,
    },
  };
}
function csvRecords(value: string): string[][] {
  const rows: string[][] = [],
    row: string[] = [];
  let cell = "",
    quoted = false;
  const text = value.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n" && !quoted) {
      row.push(cell);
      rows.push([...row]);
      row.length = 0;
      cell = "";
      i++;
    } else cell += c;
  }
  assert.equal(quoted, false);
  return rows;
}

test("complete roster CSV preserves audited identities, Unicode and counts while neutralising spreadsheet formulas", () => {
  const data = report([
    {
      ...base,
      name: '\t=HYPERLINK("https://example.invalid","é")',
      currentClubName: 'Club, "A"\nEast',
    },
    { ...base, playerId: session, currentClubName: "Zebra", name: "Zoë" },
  ]);
  const text = ownerRosterCsv(data);
  assert(text.startsWith("\uFEFF"));
  const records = csvRecords(text);
  assert.equal(records.length, 3);
  const heading = records[0];
  const first = Object.fromEntries(
    heading.map((key, i) => [key, records[1][i]]),
  );
  assert.equal(
    first.player_name,
    '\'\t=HYPERLINK("https://example.invalid","é")',
  );
  assert.equal(first.current_club_name, 'Club, "A"\nEast');
  assert.equal(first.canonical_player_id, other);
  assert.equal(first.existing_commercial_cards, "7");
  assert.equal(first.lifetime_issued_including_history, "12");
  assert.equal(first.saved_card_clubs, "Old club");
  assert.equal(records[2][heading.indexOf("player_name")], "Zoë");
  for (const row of records) assert.equal(row.length, heading.length);
  assert.deepEqual(JSON.parse(first.provider_aliases), base.aliases);
});

test("roster audit export refuses silent pagination and duplicate canonical identities", () => {
  assert.throws(
    () => ownerRosterCsv({ ...report([base]), total: 101 }),
    /complete filtered roster/,
  );
  assert.throws(
    () => ownerRosterCsv(report([base, base])),
    /Duplicate canonical player/,
  );
  assert.equal(csvRecords(ownerRosterCsv(report([]))).length, 1);
});

async function load(
  entry: string,
  stubs: Record<string, unknown>,
  env: Record<string, string> = {},
) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "roster-boundaries",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(stubs, args.path)
              ? { path: args.path, external: true }
              : undefined,
          );
        },
      },
    ],
  });
  const module = {
    exports: {} as Record<string, (...args: any[]) => Promise<any>>,
  };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    Error,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    Buffer,
    TextDecoder,
    AbortController,
    AbortSignal,
    setTimeout,
    clearTimeout,
    console,
    process: { env },
    require: (name: string) =>
      Object.hasOwn(stubs, name) ? stubs[name] : nativeRequire(name),
  });
  return module.exports;
}
class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 429,
  ) {
    super(message);
  }
}

test("Owner roster GET exports all matching rows and rejects absent binding, unknown or duplicate filters", async () => {
  let calls = 0;
  const data = report(
    Array.from({ length: 201 }, (_, index) => ({
      ...base,
      playerId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    })),
  );
  const route = await load("src/app/api/admin/rosters/route.ts", {
    "@/server/owner-rosters": {
      OwnerRosterAccessError: AccessError,
      ownerRosters: async (filters: any, options: any) => {
        calls++;
        assert.equal(filters.club, "afl:ADE");
        assert.equal(options.all, true);
        assert.equal(options.expectedOwner, owner);
        return data;
      },
    },
  });
  const get = (query: string, actor: string | null = owner) =>
    new Request(`https://fixture.invalid/api/admin/rosters${query}`, {
      headers: actor ? { "x-docked-owner": actor } : {},
    });
  for (const query of [
    "?sport=afl&sport=nfl",
    "?limit=1",
    "?page=0",
    "?format=html",
  ])
    assert.equal((await route.GET(get(query))).status, 400);
  assert.equal(
    (await route.GET(get("?club=afl:ADE&format=csv", null))).status,
    403,
  );
  assert.equal(calls, 0);
  const response = await route.GET(get("?club=afl:ADE&format=csv&page=2"));
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-type")!, /^text\/csv/);
  assert.equal(csvRecords(await response.text()).length, 202);
});

function mutationRequest(
  body: string,
  origin = "https://fixture.invalid",
  actor: string | null = owner,
) {
  return new Request("https://fixture.invalid/api/admin/rosters/decisions", {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json",
      ...(actor ? { "x-docked-owner": actor } : {}),
    },
  });
}
test("reviewed roster mutation boundary rejects CSRF, missing binding and malformed/oversize input before mutation", async () => {
  let calls = 0;
  const route = await load("src/server/owner-roster-request.ts", {
    "server-only": {},
    "./auth": {
      sameOrigin: (request: Request) =>
        request.headers.get("origin") === new URL(request.url).origin,
    },
    "./owner-rosters": {
      OwnerRosterAccessError: AccessError,
      ownerRosterDecisions: async (input: any, expectedOwner: string) => {
        calls++;
        assert.equal(input.request, command.request);
        assert.equal(expectedOwner, owner);
        return { id: session, request: input.request };
      },
    },
  });
  for (const [request, status] of [
    [
      mutationRequest(JSON.stringify(command), "https://elsewhere.invalid"),
      403,
    ],
    [mutationRequest(JSON.stringify(command), undefined, null), 403],
    [mutationRequest("{"), 400],
    [mutationRequest(JSON.stringify({ padding: "x".repeat(524288) })), 400],
  ] as const)
    assert.equal(
      (await route.ownerRosterMutationRequest(request, "decisions")).status,
      status,
    );
  assert.equal(calls, 0);
  const response = await route.ownerRosterMutationRequest(
    mutationRequest(JSON.stringify(command)),
    "decisions",
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("uncertain roster mutation failure never claims rejection or exposes database details", async () => {
  const route = await load("src/server/owner-roster-request.ts", {
    "server-only": {},
    "./auth": { sameOrigin: () => true },
    "./owner-rosters": {
      OwnerRosterAccessError: AccessError,
      ownerRosterActivation: async () => {
        throw Error("internal database host secret query");
      },
    },
  });
  const response = await route.ownerRosterMutationRequest(
    mutationRequest("{}"),
    "activation",
  );
  assert.equal(response.status, 503);
  const value = await response.json();
  assert.equal(value.outcome, undefined);
  assert.match(value.error, /same saved request/);
  assert(!JSON.stringify(value).includes("secret query"));
});

test("actual roster adapter binds verified Owner session, refuses stale tabs and keeps scoped Preview read-only", async () => {
  let allowed = true,
    limited = false,
    preview = false,
    runtimeCalls = 0,
    writes = 0;
  const claims: unknown[][] = [];
  const tx: any = async (
    _parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    claims.push(values);
    return [];
  };
  const env = {
    DOCKED_COMMERCIAL_SERVICE: "true",
    DOCKED_BETA_STAGING: "false",
  };
  const adapter = await load(
    "src/server/owner-rosters.ts",
    {
      "server-only": {},
      "./auth": {
        requireRole: async (roles: string[]) => {
          assert.equal(JSON.stringify(roles), '["owner"]');
          if (!allowed) throw Error("Privileged MFA required");
          return { user: { id: owner }, sessionId: session, aal: "aal2" };
        },
      },
      "./db": { rateLimit: async () => !limited },
      "@/core/isolated-public-preview.mjs": {
        assertIsolatedPublicPreview: () => preview,
      },
      "./commercial-runtime": {
        commercialRuntime: async () => {
          runtimeCalls++;
          return { ledger: { sql: tx } };
        },
      },
      "./commercial-player-roster": {
        CommercialPlayerRosterStore: class {
          async apply(
            actor: string,
            input: any,
            authorize: (tx: any) => Promise<void>,
          ) {
            assert.equal(actor, owner);
            assert.equal(input.request, command.request);
            await authorize(tx);
            writes++;
            return { request: input.request };
          }
          async read(_actor: string, authorize: (tx: any) => Promise<void>) {
            await authorize(tx);
            return report([]);
          }
        },
      },
    },
    env,
  );
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, other),
    /Owner changed/,
  );
  assert.equal(runtimeCalls, 0);
  await adapter.ownerRosterDecisions(command, owner);
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(claims[0][1] as string), {
    sub: owner,
    session_id: session,
    aal: "aal2",
  });
  assert.equal(claims[0][0], owner);
  await assert.rejects(() =>
    adapter.ownerRosterDecisions({ ...command, actor: other }, owner),
  );
  allowed = false;
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, owner),
    /MFA required/,
  );
  allowed = true;
  limited = true;
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, owner),
    /Too many/,
  );
  limited = false;
  preview = true;
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, owner),
    /read-only/,
  );
  await adapter.ownerRosters({}, { expectedOwner: owner });
  preview = false;
  env.DOCKED_BETA_STAGING = "true";
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, owner),
    /unavailable in this environment/,
  );
  env.DOCKED_BETA_STAGING = "false";
  env.DOCKED_COMMERCIAL_SERVICE = "false";
  await assert.rejects(
    () => adapter.ownerRosterDecisions(command, owner),
    /unavailable in this environment/,
  );
  assert.equal(writes, 1);
});
