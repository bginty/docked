import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  CommercialKycProviderError,
  SumsubCommercialKycProvider,
  type SumsubKycConfig,
} from "../../src/server/commercial-kyc-provider";

// Every identity below is fictional; HTTP is mocked and never contacts Sumsub.
const member = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const applicant = "000000000000000000000001";
const now = new Date("2026-11-21T12:00:00.000Z");
function configuration(
  environment: "commercial" | "acceptance" = "commercial",
): SumsubKycConfig {
  return {
    environment,
    appToken: `${environment === "commercial" ? "prd" : "sbx"}:offline-test-token-only`,
    secretKey: "offline-api-secret-not-a-real-key-0001",
    webhookSecret: "offline-webhook-secret-not-a-real-key-0002",
    identityHashKey: "offline-identity-secret-not-a-real-key-0003",
    clientId: "docked-offline-fixture",
    levelName: "offline-id-selfie-au-address",
    returnUrl:
      environment === "commercial"
        ? "https://docked.com.au/fantasy/withdrawals"
        : "https://docked-acceptance.vercel.app/fantasy/withdrawals",
    ...(environment === "acceptance"
      ? { acceptanceReturnOrigin: "https://docked-acceptance.vercel.app" }
      : {}),
  };
}
function fixture(config = configuration()) {
  const review = {
    reviewId: "offline-review-01",
    attemptId: "offline-attempt-01",
    levelName: config.levelName,
    reviewDate: "2026-11-21 11:00:00+0000",
    reviewStatus: "completed",
    reviewResult: { reviewAnswer: "GREEN" },
  };
  const person = {
    id: applicant,
    clientId: config.clientId,
    externalUserId: `docked:${config.environment}:${member}`,
    type: "individual",
    sandboxMode: config.environment === "acceptance",
    review,
    info: {
      firstName: "Fictional",
      middleName: "Test",
      lastName: "Member",
      dob: "1990-03-04",
      country: "NZL", // Issuing country does not establish residence.
      residenceCountry: "AUS",
      addresses: [{ country: "AUS", street: "PRIVATE SYNTHETIC ADDRESS" }],
      idDocs: [{ idDocType: "PASSPORT", country: "NZL", dob: "1990-03-04" }],
    },
  };
  const steps = {
    IDENTITY: {
      reviewResult: { reviewAnswer: "GREEN" },
      country: "NZL",
      idDocType: "PASSPORT",
    },
    SELFIE: { reviewResult: { reviewAnswer: "GREEN" } },
    PROOF_OF_RESIDENCE: {
      reviewResult: { reviewAnswer: "GREEN" },
      country: "AUS",
      idDocType: "UTILITY_BILL",
    },
  };
  const current = structuredClone(review);
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let link = "https://in.sumsub.com/websdk/p/offline-link-123";
  let override: ((url: string) => Response | Promise<Response>) | undefined;
  const transport: typeof fetch = async (url, init) => {
    const address = String(url);
    calls.push({ url: address, init });
    assert.equal(new URL(address).origin, "https://api.sumsub.com");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal instanceof AbortSignal);
    if (override) return override(address);
    if (address.endsWith("/websdkLink")) return Response.json({ url: link });
    if (address.endsWith("/requiredIdDocsStatus")) return Response.json(steps);
    if (address.endsWith("/status")) return Response.json(current);
    return Response.json(person);
  };
  return {
    person,
    steps,
    current,
    calls,
    transport,
    config,
    provider: new SumsubCommercialKycProvider(config, transport, () => now),
    setLink(url: string) {
      link = url;
    },
    setTransport(handler: (url: string) => Response | Promise<Response>) {
      override = handler;
    },
    setDob(dob: string) {
      person.info.dob = dob;
      person.info.idDocs[0].dob = dob;
    },
    setReviewStatus(status: string, answer = "GREEN") {
      person.review.reviewStatus = current.reviewStatus = status;
      person.review.reviewResult.reviewAnswer =
        current.reviewResult.reviewAnswer = answer;
    },
  };
}
function webhook(
  config = configuration(),
  changes: Record<string, unknown> = {},
) {
  const value = {
    applicantId: applicant,
    applicantType: "individual",
    externalUserId: `docked:${config.environment}:${member}`,
    clientId: config.clientId,
    sandboxMode: config.environment === "acceptance",
    correlationId: "offline-shared-request-01",
    type: "applicantReviewed",
    createdAtMs: "2026-11-21 11:00:00.123",
    reviewStatus: "completed",
    reviewResult: { reviewAnswer: "GREEN" },
    ...changes,
  };
  const raw = Buffer.from(JSON.stringify(value));
  const algorithm = config.webhookAlgorithm ?? "HMAC_SHA256_HEX";
  const digest = createHmac(
    algorithm === "HMAC_SHA512_HEX" ? "sha512" : "sha256",
    config.webhookSecret,
  )
    .update(raw)
    .digest("hex");
  return {
    raw,
    value,
    headers: new Headers({
      "x-payload-digest-alg": algorithm,
      "x-payload-digest": digest,
    }),
  };
}

test("hosted link binds authenticated member, fixed return URL and exact signed request bytes", async () => {
  const f = fixture();
  const result = await f.provider.createHostedVerification(member);
  assert.equal(result.externalUserId, `docked:commercial:${member}`);
  assert.equal(result.expiresAt, "2026-11-21T12:10:00.000Z");
  assert.equal(result.url, "https://in.sumsub.com/websdk/p/offline-link-123");
  const request = f.calls[0];
  const headers = new Headers(request.init?.headers);
  const expectedBody = JSON.stringify({
    levelName: f.config.levelName,
    userId: `docked:commercial:${member}`,
    ttlInSecs: 600,
    redirect: { successUrl: f.config.returnUrl, rejectUrl: f.config.returnUrl },
  });
  assert.equal(request.init?.method, "POST");
  assert.equal(request.init?.body, expectedBody);
  assert.equal(headers.get("X-App-Access-Ts"), String(now.getTime() / 1000));
  assert.equal(
    headers.get("X-App-Access-Sig"),
    createHmac("sha256", f.config.secretKey)
      .update(
        `${now.getTime() / 1000}POST/resources/sdkIntegrations/levels/-/websdkLink${expectedBody}`,
      )
      .digest("hex"),
  );
  assert.ok(!JSON.stringify(f.provider).includes(f.config.secretKey));
  assert.ok(!expectedBody.includes("email"));
  await assert.rejects(
    f.provider.createHostedVerification("../another-member"),
  );
  assert.equal(f.calls.length, 1);
});

test("approved adult AU identity uses authoritative document and residence evidence, with minimal persisted fields", async () => {
  const f = fixture();
  const result = await f.provider.fetchIdentity(member, applicant);
  assert.equal(result.evidence.status, "approved");
  assert.equal(result.evidence.country, "AU");
  assert.equal(result.evidence.adult, true);
  assert.equal(result.evidence.providerReviewedAt, "2026-11-21T11:00:00.000Z");
  assert.equal(
    result.evidence.legalNameHash,
    f.provider.hashLegalName("  fictional  TEST MEMBER "),
  );
  assert.equal(result.verifiedLegalName, "Fictional Test Member");
  assert.equal(result.evidence.providerEnvironment, "production");
  const persisted = JSON.stringify(result.evidence);
  for (const secret of [
    "Fictional",
    "1990-03-04",
    "PRIVATE SYNTHETIC ADDRESS",
    "NZL",
  ])
    assert.ok(!persisted.includes(secret));
  assert.match(f.calls[0].url, /-;externalUserId=docked%3Acommercial%3A/);
  assert.ok(f.calls.at(-1)?.url.endsWith("/status"));
  const again = await f.provider.fetchIdentity(member, applicant);
  assert.equal(
    result.evidence.evidenceReference,
    again.evidence.evidenceReference,
  );
});

for (const status of [
  "init",
  "pending",
  "prechecked",
  "queued",
  "onHold",
  "awaitingService",
  "awaitingUser",
  "unknownFutureStatus",
])
  test(`GREEN with ${status} remains ineligible`, async () => {
    const f = fixture();
    f.setReviewStatus(status);
    const result = await f.provider.fetchIdentity(member);
    assert.equal(result.evidence.status, "pending");
    assert.equal(result.evidence.legalNameHash, null);
    assert.equal(result.verifiedLegalName, null);
  });

test("final provider rejection, deactivation and out-of-order GREEN webhook cannot grant approval", async () => {
  const f = fixture();
  f.current.reviewResult.reviewAnswer = "RED";
  const event = webhook();
  const result = await f.provider.refreshWebhook(event.raw, event.headers);
  assert.equal(result.identity.evidence.status, "rejected");
  assert.equal(result.identity.eligibilityReason, "provider_rejected");
  f.current.reviewResult.reviewAnswer = "GREEN";
  (f.person as unknown as Record<string, unknown>).deleted = true;
  assert.equal(
    (await f.provider.fetchIdentity(member)).eligibilityReason,
    "provider_inactive",
  );
});

test("re-review or hold during the authoritative read prevents a stale positive snapshot", async () => {
  const f = fixture();
  f.current.reviewId = "new-provider-review";
  let result = await f.provider.fetchIdentity(member);
  assert.equal(result.evidence.status, "pending");
  assert.equal(result.eligibilityReason, "review_changed");
  f.current.reviewStatus = "onHold";
  result = await f.provider.fetchIdentity(member);
  assert.equal(result.evidence.status, "pending");
});

for (const change of [
  "member",
  "account",
  "environment",
  "applicant",
  "company",
])
  test(`rejects provider ${change} binding mismatch`, async () => {
    const f = fixture();
    if (change === "member")
      f.person.externalUserId = `docked:commercial:${other}`;
    if (change === "account") f.person.clientId = "another-account";
    if (change === "environment") f.person.sandboxMode = true;
    if (change === "applicant") f.person.id = "000000000000000000000002";
    if (change === "company") f.person.type = "company";
    await assert.rejects(
      f.provider.fetchIdentity(member, applicant),
      (error) =>
        error instanceof CommercialKycProviderError &&
        error.code === "unverified",
    );
  });

test("wrong KYC level and missing required steps cannot approve", async () => {
  const f = fixture();
  f.current.levelName = f.person.review.levelName =
    "data-only-without-id-verification";
  assert.equal(
    (await f.provider.fetchIdentity(member)).eligibilityReason,
    "level_mismatch",
  );
  for (const step of ["IDENTITY", "SELFIE", "PROOF_OF_RESIDENCE"] as const) {
    const g = fixture();
    g.steps[step].reviewResult.reviewAnswer = "YELLOW";
    assert.equal(
      (await g.provider.fetchIdentity(member)).eligibilityReason,
      "steps_incomplete",
    );
  }
});

for (const dob of [
  "2020-01-01",
  "2008-11-22",
  "2000-02-30",
  "2099-01-01",
  "",
  "01/01/1990",
])
  test(`DOB ${dob || "missing"} never approves an adult withdrawal`, async () => {
    const f = fixture();
    f.setDob(dob);
    const result = await f.provider.fetchIdentity(member);
    assert.notEqual(result.evidence.status, "approved");
    assert.equal(result.evidence.adult, false);
  });
test("adult birthday is checked by calendar date and missing/replaced identity data fails closed", async () => {
  const f = fixture();
  f.setDob("2008-11-21");
  assert.equal(
    (await f.provider.fetchIdentity(member)).evidence.status,
    "approved",
  );
  f.person.info.idDocs[0].country = "USA";
  assert.equal(
    (await f.provider.fetchIdentity(member)).eligibilityReason,
    "identity_incomplete",
  );
  f.person.info.idDocs[0].country = "NZL";
  delete (f.current as { reviewId?: string }).reviewId;
  delete (f.person.review as { reviewId?: string }).reviewId;
  assert.equal(
    (await f.provider.fetchIdentity(member)).evidence.providerReviewId,
    null,
  );
  assert.equal(
    (await f.provider.fetchIdentity(member)).evidence.status,
    "pending",
  );
});

test("Australian identity document or self-entered address alone does not establish AU residence", async () => {
  const f = fixture();
  f.person.info.country = "AUS";
  f.person.info.residenceCountry = "USA";
  f.person.info.addresses[0].country = "USA";
  f.steps.PROOF_OF_RESIDENCE.country = "USA";
  assert.equal(
    (await f.provider.fetchIdentity(member)).eligibilityReason,
    "outside_australia",
  );
  f.person.info.addresses = [];
  f.person.info.residenceCountry = "AUS";
  f.steps.PROOF_OF_RESIDENCE.country = "AUS";
  (f.person as unknown as Record<string, unknown>).fixedInfo = {
    dob: "1990-01-01",
    addresses: [{ country: "AUS" }],
  };
  assert.equal(
    (await f.provider.fetchIdentity(member)).evidence.status,
    "pending",
  );
});

for (const url of [
  "http://in.sumsub.com/websdk/p/123",
  "https://in.sumsub.com.attacker.example/websdk/p/123",
  "https://attacker.example/websdk/p/123",
  "https://user:pass@in.sumsub.com/websdk/p/123",
  "https://in.sumsub.com:8443/websdk/p/123",
  "https://in.sumsub.com/websdk/p/123?redirect=https://attacker.example",
  "https://in.sumsub.com/another/path",
])
  test(`rejects unsafe hosted link ${url}`, async () => {
    const f = fixture();
    f.setLink(url);
    await assert.rejects(
      f.provider.createHostedVerification(member),
      (error) =>
        error instanceof CommercialKycProviderError &&
        error.code === "unverified",
    );
  });

test("credentials, configured callback and acceptance environment cannot cross production boundary", async () => {
  const acceptance = fixture(configuration("acceptance"));
  assert.equal(
    (await acceptance.provider.fetchIdentity(member)).evidence
      .providerEnvironment,
    "acceptance",
  );
  const variants: SumsubKycConfig[] = [
    { ...configuration(), appToken: configuration("acceptance").appToken },
    { ...configuration("acceptance"), appToken: configuration().appToken },
    {
      ...configuration(),
      returnUrl: "https://docked.com.au.attacker.example/return",
    },
    {
      ...configuration(),
      returnUrl: "https://docked.com.au/return?next=https://attacker.example",
    },
    {
      ...configuration("acceptance"),
      returnUrl: "https://docked.com.au/fantasy/withdrawals",
      acceptanceReturnOrigin: "https://docked.com.au",
    },
    {
      ...configuration("acceptance"),
      returnUrl: "http://localhost/return",
      acceptanceReturnOrigin: "http://localhost",
    },
    { ...configuration(), secretKey: "" },
    { ...configuration(), webhookSecret: configuration().secretKey },
  ];
  for (const config of variants)
    assert.throws(
      () => new SumsubCommercialKycProvider(config),
      (error) =>
        error instanceof CommercialKycProviderError &&
        error.code === "configuration",
    );
});

test("raw webhook HMAC, pinned algorithm, environment, account and event bindings are verified", () => {
  const f = fixture();
  const good = webhook();
  const event = f.provider.verifyWebhook(good.raw, good.headers);
  assert.equal(event.memberId, member);
  assert.equal(event.eventCreatedAt, "2026-11-21T11:00:00.123Z");
  assert.equal(event.providerEnvironment, "production");
  assert.equal("reviewResult" in event, false);
  for (const headers of [
    new Headers(),
    new Headers({
      "x-payload-digest-alg": "HMAC_SHA1_HEX",
      "x-payload-digest": "a".repeat(40),
    }),
    new Headers({
      "x-payload-digest-alg": "HMAC_SHA256_HEX",
      "x-payload-digest": "a".repeat(64),
    }),
    new Headers({
      "x-payload-digest-alg": "HMAC_SHA256_HEX",
      "x-payload-digest": "00",
    }),
    new Headers({
      "x-payload-digest-alg": "HMAC_SHA256_HEX",
      "x-payload-digest": good.headers.get("x-payload-digest") + ",another",
    }),
  ])
    assert.throws(() => f.provider.verifyWebhook(good.raw, headers));
  // Re-serializing before signature validation would incorrectly accept this.
  assert.throws(() =>
    f.provider.verifyWebhook(
      Buffer.from(JSON.stringify(good.value, null, 2)),
      good.headers,
    ),
  );
  for (const changes of [
    { clientId: "wrong-account" },
    { sandboxMode: true },
    { testMode: true },
    { testMode: false },
    { externalUserId: `docked:acceptance:${member}` },
    { externalUserId: "arbitrary-member" },
    { applicantType: "company" },
    { createdAtMs: "2026-11-21 13:00:00.000" },
    { createdAtMs: "2026-02-30 11:00:00.000" },
  ]) {
    const invalid = webhook(configuration(), changes);
    assert.throws(() => f.provider.verifyWebhook(invalid.raw, invalid.headers));
  }
});

test("SHA512 requires explicit configuration; replay IDs distinguish events sharing correlation IDs", () => {
  const config = {
    ...configuration(),
    webhookAlgorithm: "HMAC_SHA512_HEX" as const,
  };
  const f = fixture(config);
  const a = webhook(config),
    b = webhook(config, { type: "applicantOnHold" });
  const first = f.provider.verifyWebhook(a.raw, a.headers);
  assert.equal(
    first.replayId,
    f.provider.verifyWebhook(a.raw, a.headers).replayId,
  );
  assert.notEqual(
    first.replayId,
    f.provider.verifyWebhook(b.raw, b.headers).replayId,
  );
  assert.throws(() => fixture().provider.verifyWebhook(a.raw, a.headers));
  // Delayed legitimate retries are handled through fresh state, not old GREEN.
  const delayed = webhook(config, { createdAtMs: "2026-11-18 11:00:00.000" });
  assert.ok(f.provider.verifyWebhook(delayed.raw, delayed.headers).replayId);
});

test("malformed data, network failure, 404 and oversized responses cannot leak provider secrets or grant identity", async () => {
  for (const mode of [
    "network",
    "not-found",
    "bad-json",
    "too-large",
    "wrong-content-type",
  ]) {
    const f = fixture();
    f.setTransport(() => {
      if (mode === "network")
        throw Error(`PRIVATE ${f.config.secretKey} PRIVATE ADDRESS`);
      if (mode === "not-found")
        return Response.json(
          { description: "PRIVATE ADDRESS" },
          { status: 404 },
        );
      if (mode === "bad-json")
        return new Response("{PRIVATE ADDRESS", {
          headers: { "content-type": "application/json" },
        });
      if (mode === "too-large")
        return Response.json({ data: "x".repeat(600 * 1024) });
      return new Response("PRIVATE ADDRESS", {
        headers: { "content-type": "text/html" },
      });
    });
    await assert.rejects(
      f.provider.fetchIdentity(member),
      (error) =>
        error instanceof CommercialKycProviderError &&
        error.code === (mode === "not-found" ? "not_found" : "unavailable") &&
        !error.message.includes("PRIVATE") &&
        !error.message.includes(f.config.secretKey) &&
        error.cause === undefined,
    );
  }
  const f = fixture();
  assert.throws(() =>
    f.provider.verifyWebhook(Buffer.alloc(129 * 1024), new Headers()),
  );
});
