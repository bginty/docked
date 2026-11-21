import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community.ts";

// Optional testing dependency stays outside the application package. Install
// jsdom@31.0.1 into an isolated fixture directory, then point this variable at
// that directory's package.json and run with Node 22 and --import tsx.
const fixtureRequire = createRequire(
  process.env.DOCKED_UI_RUNTIME_PACKAGE ?? import.meta.url,
);
const { JSDOM, VirtualConsole } = fixtureRequire("jsdom");

// Actual bundled application components. Every fetch is a synthetic in-memory
// fixture; JSDOM does not load resources or open a real browser here.
const script = await bundleCommunityFixture("tests/fixtures/withdrawal-ui.tsx");
const member = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const destination = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const bank = {
  holder: "Synthetic Customer",
  bsb: "123456",
  account: "987654321",
};
const policy = {
  version: "ISOLATED-UI-CASH-POLICY",
  currency: "AUD",
  eligibleSource: "settled-sale-proceeds-only",
  rate: { credits: 100, audCents: 100 },
  minimumCredits: 1000,
  maximumCredits: 10000,
  dailyMaximumCredits: 20000,
  feeCents: 0,
};
const setup = {
  published: true,
  identityConfigured: true,
  bankProtectionConfigured: true,
};
const receipt = {
  id: requestId,
  memberId: member,
  status: "REQUESTED",
  revision: 1,
  credits: 1500,
  grossAudCents: 1500,
  feeCents: 0,
  audCents: 1500,
  policyVersion: policy.version,
  identityRevision: 1,
  destination,
  destinationMask: "****4321",
  claimedBy: owner,
  createdAt: "2026-11-21T00:00:00Z",
  updatedAt: "2026-11-21T00:00:00Z",
  claimedAt: "2026-11-21T00:00:00Z",
  sentAt: null,
  reconciledAt: null,
  returnedAt: null,
};
const customer = {
  member,
  enabled: true,
  reason: null,
  setup,
  policy,
  money: { available: 9000, eligible: 5000, pending: 0 },
  identity: { status: "approved", revision: 1 },
  destinations: [
    { id: destination, mask: "****4321", identityRevision: 1, verified: true },
  ],
  requests: [],
};
const operations = {
  owner,
  requestsEnabled: true,
  paymentsEnabled: true,
  reason: null,
  setup,
  policy,
  configuredPolicyVersion: policy.version,
  totalRequests: 1,
  openRequests: 1,
  hasMore: false,
  requests: [{ ...receipt, status: "PAYMENT_IN_PROGRESS" }],
  destinations: [
    {
      id: destination,
      memberId: member,
      mask: "****4321",
      identityRevision: 1,
      currentIdentityRevision: 1,
      currentIdentityStatus: "approved",
      verified: true,
    },
  ],
  exposures: [],
};
const requests = [],
  ownerCommands = [],
  ownerLookups = [],
  checks = [],
  errors = [],
  windows = [];
let bankSaves = 0,
  reveals = 0,
  lost = false;
const cleanText = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const until = async (check, message) => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 3000)
      throw Error(message + "\nErrors: " + errors.join("; "));
    await delay(10);
  }
};
const mockResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => structuredClone(body),
});

function load(path, unverified = false, feeCents = 0) {
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="fixture-root"></div></body></html>',
    {
      url: "https://isolated.invalid" + path,
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: console,
    },
  );
  const win = dom.window;
  windows.push(win);
  win.fetch = async (url, init = {}) => {
    assert(String(url).startsWith("/api/"), "No external fetch allowed");
    const body = init.body ? JSON.parse(init.body) : null;
    if (url === "/api/commercial-withdrawals") {
      if (init.method === "POST") {
        requests.push(body);
        customer.requests = [{ ...receipt }];
        customer.money.pending = 1500;
        if (!lost) {
          lost = true;
          throw Error("Synthetic lost response");
        }
        assert.deepEqual(body, requests[0]);
        return mockResponse({ result: receipt });
      }
      return mockResponse({
        ...customer,
        policy: { ...policy, feeCents },
        destinations: unverified
          ? [{ ...customer.destinations[0], verified: false }]
          : customer.destinations,
      });
    }
    if (url === "/api/commercial-withdrawals/destination") {
      bankSaves++;
      assert.deepEqual(body.bank, bank);
      return bankSaves === 1
        ? mockResponse(
            {
              error: "Synthetic ownership review response unavailable",
              outcome: "rejected",
            },
            409,
          )
        : mockResponse({ result: { id: destination } });
    }
    if (url === "/api/admin/withdrawals" || String(url).startsWith("/api/admin/withdrawals?id=")) {
      if (init.method === "POST") {
        ownerCommands.push(body);
        assert.equal(body.command.kind, "record-sent");
        assert.equal(body.command.confirmed, true);
        operations.requests[0] = {
          ...operations.requests[0],
          status: "SENT",
          revision: 2,
        };
        return mockResponse({ result: operations.requests[0] });
      }
      const query = new URL(String(url), "https://isolated.invalid").searchParams.get("id");
      if (query) {
        ownerLookups.push(query);
        const found = operations.requests.filter((row) => row.id === query);
        return mockResponse({ ...operations, requests: found, destinations: found.length ? operations.destinations : [], exposures: [], hasMore: false });
      }
      return mockResponse(operations);
    }
    if (url === "/api/admin/withdrawals/bank") {
      reveals++;
      return mockResponse({
        bank,
        expiresAt: new Date(
          Date.now() + (reveals === 1 ? 30000 : 500),
        ).toISOString(),
      });
    }
    throw Error("Unexpected fixture fetch: " + url);
  };
  win.eval(script);
  return win;
}

const label = (win, name) => {
  const element = [...win.document.querySelectorAll("label")].find((el) =>
    cleanText(el).startsWith(name),
  );
  assert(element, "Missing field label: " + name);
  const field =
    element.control ?? element.querySelector("input,select,textarea");
  assert(field, "Missing field: " + name);
  return field;
};
const button = (win, name) => {
  const element = [...win.document.querySelectorAll("button")].find(
    (el) => cleanText(el) === name,
  );
  assert(element, "Missing button: " + name);
  return element;
};
const fill = async (win, name, value) => {
  const el = label(win, name);
  const prototype =
    el.tagName === "SELECT"
      ? win.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA"
        ? win.HTMLTextAreaElement.prototype
        : win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, value);
  el.dispatchEvent(
    new win.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  await delay(15);
};
const click = async (win, name) => {
  const el = button(win, name);
  assert(!el.matches(":disabled"), name + " disabled");
  el.click();
  await delay(15);
};

try {
  const win = load("/customer");
  await until(
    () => cleanText(win.document.body).includes("Current withdrawal terms"),
    "Customer did not load",
  );
  await fill(win, "Verified bank account", destination);
  await fill(win, "Credits to withdraw", "500");
  assert(button(win, "Confirm withdrawal request").matches(":disabled"));
  await fill(win, "Credits to withdraw", "6000");
  assert(button(win, "Confirm withdrawal request").matches(":disabled"));
  await fill(win, "Credits to withdraw", "1500");
  assert(
    cleanText(win.document.body).includes(
      "Bank payment: $15.00 after a $0.00 withdrawal fee.",
    ),
  );
  assert(!button(win, "Confirm withdrawal request").matches(":disabled"));
  checks.push(
    "Actual customer component enforces minimum/eligible maximum and displays exact AUD quote and fee",
  );

  const withFee = load("/customer", false, 123);
  await until(
    () => cleanText(withFee.document.body).includes("Current withdrawal terms"),
    "Fee fixture did not load",
  );
  await fill(withFee, "Verified bank account", destination);
  await fill(withFee, "Credits to withdraw", "1500");
  assert(
    cleanText(withFee.document.body).includes(
      "Bank payment: $13.77 after a $1.23 withdrawal fee.",
    ),
  );
  await fill(withFee, "Credits to withdraw", "1500.5");
  assert(button(withFee, "Confirm withdrawal request").matches(":disabled"));
  checks.push(
    "Nonzero fee is deducted exactly and fractional credits cannot be requested",
  );

  const restricted = load("/customer", true);
  await until(
    () =>
      cleanText(restricted.document.body).includes("Current withdrawal terms"),
    "Unverified customer did not load",
  );
  await fill(restricted, "Credits to withdraw", "1500");
  assert.equal(label(restricted, "Verified bank account").options.length, 1);
  assert(button(restricted, "Confirm withdrawal request").matches(":disabled"));
  checks.push("Unverified bank destination cannot be selected or used");

  for (let i = 0; i < 2; i++) {
    await fill(win, "Account holder", bank.holder);
    await fill(win, "BSB — 6 digits", bank.bsb);
    await fill(win, "Account number", bank.account);
    await click(win, "Save for ownership review");
    await until(
      () => label(win, "Account holder").value === "",
      "Bank form not cleared",
    );
    assert.equal(label(win, "BSB — 6 digits").value, "");
    assert.equal(label(win, "Account number").value, "");
  }
  checks.push(
    "Raw bank form inputs clear after both rejected save and successful save",
  );

  await click(win, "Confirm withdrawal request");
  await until(
    () => cleanText(win.document.body).includes("Retry the same request"),
    "Unknown result did not offer safe retry",
  );
  assert(button(win, "Confirm withdrawal request").matches(":disabled"));
  await click(win, "Retry the same request");
  await until(
    () =>
      cleanText(win.document.body).includes("Your request has been recorded."),
    "Same request recovery failed",
  );
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  checks.push(
    "Lost-response retry sends exactly the same request UUID and command",
  );
  const history = [...win.document.querySelectorAll("h2")].find(
    (el) => cleanText(el) === "Withdrawal history",
  ).parentElement;
  assert(cleanText(history).includes("Account ****4321"));
  for (const value of Object.values(bank))
    assert(!cleanText(history).includes(value));
  const stores = JSON.stringify({
    local: { ...win.localStorage },
    session: { ...win.sessionStorage },
  });
  for (const value of Object.values(bank)) assert(!stores.includes(value));
  checks.push("Customer history and web storage contain no raw bank values");

  const admin = load("/owner");
  await until(
    () => cleanText(admin.document.body).includes("Reason for the action"),
    "Owner component did not load",
  );
  await fill(admin, "Find a withdrawal by reference", requestId);
  await click(admin, "Find request");
  await until(() => ownerLookups.at(-1) === requestId && label(admin, "Withdrawal").value === requestId, "Exact Owner reference lookup did not select its request");
  const unknownReference = "55555555-5555-4555-8555-555555555555";
  await fill(admin, "Find a withdrawal by reference", unknownReference);
  await click(admin, "Find request");
  await until(() => ownerLookups.at(-1) === unknownReference && !cleanText(admin.document.body).includes("Unique bank transaction reference"), "Unknown reference retained a stale payment form");
  await click(admin, "Show open queue");
  await until(() => label(admin, "Withdrawal").querySelectorAll("option").length === 2, "Open Owner queue did not return after exact lookup");
  checks.push("Exact Owner reference retrieval selects the matching obligation, clears stale forms for unknown references and returns to the queue");
  await fill(
    admin,
    "Reason for the action",
    "Synthetic bank statement checked for this isolated fixture",
  );
  await fill(admin, "Evidence reference", "ISOLATED-EVIDENCE-ONLY");
  await fill(admin, "Withdrawal", requestId);
  await fill(
    admin,
    "Unique bank transaction reference",
    "ISOLATED-BANK-REFERENCE",
  );
  assert(button(admin, "Record payment already sent").matches(":disabled"));
  label(admin, "I checked the bank and personally confirm").click();
  await delay(20);
  assert(!button(admin, "Record payment already sent").matches(":disabled"));
  checks.push(
    "Owner must personally confirm payment before record-sent becomes available",
  );
  await click(admin, "Reveal this payment’s bank details");
  await until(
    () => admin.document.querySelector('[aria-label="Sensitive bank details"]'),
    "Bank reveal not shown",
  );
  assert(
    cleanText(
      admin.document.querySelector('[aria-label="Sensitive bank details"]'),
    ).includes(bank.account),
  );
  admin.dispatchEvent(new admin.Event("blur"));
  await until(
    () =>
      !admin.document.querySelector('[aria-label="Sensitive bank details"]'),
    "Blur did not hide raw bank",
  );
  await click(admin, "Reveal this payment’s bank details");
  await until(
    () => admin.document.querySelector('[aria-label="Sensitive bank details"]'),
    "Second bank reveal not shown",
  );
  await until(
    () =>
      !admin.document.querySelector('[aria-label="Sensitive bank details"]'),
    "Expiry did not hide raw bank",
  );
  checks.push(
    "Raw bank details disappear on window blur and actual server expiry timer",
  );
  await click(admin, "Record payment already sent");
  await until(
    () => cleanText(admin.document.body).includes("Operation recorded."),
    "Owner operation not recorded",
  );
  assert.equal(ownerCommands.length, 1);
  for (const value of Object.values(bank))
    assert(!cleanText(admin.document.body).includes(value));
  checks.push(
    "Owner receipt/history returns only masked bank data after recording sent",
  );
  assert.deepEqual(errors, []);
  mkdirSync("docs/qa/marketplace-withdrawals-20261121", { recursive: true });
  const sourceFiles = [
    "src/components/commercial-withdrawals.tsx",
    "src/components/commercial-withdrawal-operations.tsx",
    "tests/fixtures/withdrawal-ui.tsx",
    "scripts/commercial-withdrawal-dom.mjs",
  ];
  const sources = Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash("sha256").update(readFileSync(path)).digest("hex"),
    ]),
  );
  const output = {
    scope:
      "Actual bundled React components in JSDOM with synthetic in-memory fetch fixtures",
    status: "PASS",
    checkedAt: new Date().toISOString(),
    sources,
    checks,
    realBrowser: false,
    renderedLayout: false,
    screenshots: [],
    hostedAuthentication: false,
    production: false,
    externalCalls: false,
    realKyc: false,
    realBankTransfer: false,
    browserAttempt:
      "Chromium could not start: executor rejected process singleton socket(). No browser checks passed.",
  };
  writeFileSync(
    "docs/qa/marketplace-withdrawals-20261121/MOCKED_COMPONENT_UI.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks: checks.length,
      scope: output.scope,
    }),
  );
} finally {
  for (const win of windows) win.close();
}
