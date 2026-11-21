import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingEnvironment } from "../core/commercial-billing";

/** Server adapter only. This module never accepts documents, browser approval,
 * or a caller-supplied applicant identity. See docs/qa/withdrawal-kyc-20261121/README.md. */
export type CommercialKycEvidence = {
  provider: "sumsub";
  providerEnvironment: "acceptance" | "production";
  providerApplicantId: string;
  providerReviewId: string | null;
  providerReviewedAt: string | null;
  checkedAt: string;
  status: "pending" | "approved" | "rejected";
  country: string | null;
  adult: boolean;
  evidenceReference: string;
  legalNameHash: string | null;
};
export type CommercialKycIdentity = {
  evidence: CommercialKycEvidence;
  /** Sensitive server-only value for destination ownership review. Do not log,
   * include in member JSON, or persist unencrypted with the evidence record. */
  verifiedLegalName: string | null;
  eligibilityReason:
    | "verified"
    | "provider_pending"
    | "provider_rejected"
    | "provider_inactive"
    | "review_changed"
    | "level_mismatch"
    | "steps_incomplete"
    | "identity_incomplete"
    | "underage"
    | "outside_australia";
};
export type SumsubKycConfig = {
  environment: BillingEnvironment;
  appToken: string;
  secretKey: string;
  webhookSecret: string;
  /** A separate stable random secret (at least 32 characters), not the API key. */
  identityHashKey: string;
  clientId: string;
  levelName: string;
  /** Fixed server configuration; never derive this from Host or user input. */
  returnUrl: string;
  /** Required only for acceptance; must match the fixed returnUrl exactly. */
  acceptanceReturnOrigin?: string;
  webhookAlgorithm?: "HMAC_SHA256_HEX" | "HMAC_SHA512_HEX";
  timeoutMs?: number;
  linkTtlSeconds?: number;
};
export type VerifiedSumsubWebhook = {
  provider: "sumsub";
  providerEnvironment: "acceptance" | "production";
  memberId: string;
  providerApplicantId: string;
  type: string;
  correlationId: string;
  eventCreatedAt: string;
  /** Persist atomically with processing; correlationId alone is NOT unique. */
  replayId: string;
};
export class CommercialKycProviderError extends Error {
  constructor(
    readonly code:
      | "configuration"
      | "unavailable"
      | "not_found"
      | "unverified"
      | "invalid_webhook",
  ) {
    super(
      code === "configuration"
        ? "Identity verification provider is not configured"
        : code === "invalid_webhook"
          ? "Identity verification notification was not authenticated"
          : "Identity verification could not be confirmed",
    );
    this.name = "CommercialKycProviderError";
  }
}

const applicantId = z.string().regex(/^[a-z0-9]{24}$/);
const boundedText = z.string().min(1).max(256);
const reviewSchema = z.object({
  reviewId: boundedText.optional(),
  levelName: boundedText,
  attemptId: boundedText.optional(),
  reviewStatus: boundedText,
  reviewDate: z.string().max(64).optional(),
  reviewResult: z
    .object({ reviewAnswer: z.string().max(20).optional() })
    .nullish(),
});
const namePart = z.string().max(256);
const applicantSchema = z.object({
  id: applicantId,
  clientId: boundedText,
  externalUserId: boundedText,
  type: z.literal("individual"),
  deleted: z.boolean().optional(),
  // Some provider responses include sandboxMode; the environment-specific app
  // token and externalUserId namespace remain mandatory even if it is omitted.
  sandboxMode: z.boolean().optional(),
  review: reviewSchema,
  info: z
    .object({
      firstName: namePart.optional(),
      middleName: namePart.optional(),
      lastName: namePart.optional(),
      dob: z.string().max(16).optional(),
      residenceCountry: z.string().max(3).optional(),
      addresses: z
        .array(z.object({ country: z.string().max(3).optional() }))
        .max(50)
        .optional(),
      idDocs: z
        .array(
          z.object({
            idDocType: boundedText,
            country: z.string().max(3),
            dob: z.string().max(16).optional(),
          }),
        )
        .max(50)
        .optional(),
    })
    .optional(),
});
const stepSchema = z
  .object({
    reviewResult: z
      .object({ reviewAnswer: z.string().max(20).optional() })
      .nullish(),
    country: z.string().max(3).nullish(),
    idDocType: boundedText.nullish(),
    forbidden: z.boolean().nullish(),
  })
  .nullish();
const stepsSchema = z.object({
  IDENTITY: stepSchema,
  SELFIE: stepSchema,
  PROOF_OF_RESIDENCE: stepSchema,
});
const webhookTypes = [
  "applicantCreated",
  "applicantPending",
  "applicantReviewed",
  "applicantOnHold",
  "applicantReset",
  "applicantStepsReset",
  "applicantPrechecked",
  "applicantLevelChanged",
  "applicantPersonalInfoChanged",
  "applicantActivated",
  "applicantDeactivated",
  "applicantDeleted",
  "applicantAwaitingService",
  "applicantAwaitingUser",
  "applicantWorkflowCompleted",
  "applicantWorkflowFailed",
] as const;
const webhookSchema = z.object({
  applicantId,
  applicantType: z.literal("individual"),
  clientId: boundedText,
  externalUserId: boundedText,
  correlationId: boundedText,
  type: z.enum(webhookTypes),
  sandboxMode: z.boolean(),
  // Manually sent dashboard tests are not real applicant evidence in either mode.
  testMode: z.never().optional(),
  createdAtMs: z.string().max(64).optional(),
  createdAt: z.string().max(64).optional(),
});
const apiOrigin = "https://api.sumsub.com";
const sdkOrigin = "https://in.sumsub.com";
const maxBodyBytes = 512 * 1024;
const maxWebhookBytes = 128 * 1024;
const memberPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function memberReference(environment: BillingEnvironment, member: string) {
  if (!memberPattern.test(member))
    throw new CommercialKycProviderError("unverified");
  return `docked:${environment}:${member}`;
}
function utcDate(value: string): string | null {
  // Sumsub documents UTC yyyy-MM-dd HH:mm:ss[.fff][+0000]. Be explicit: never
  // let a timezone-less provider date inherit the server's local timezone.
  const m =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,3})?(?:Z|\+00:?00)?$/.exec(
      value,
    );
  if (!m) return null;
  const expected = `${m[1]}T${m[2]}${(m[3] ?? ".000").padEnd(4, "0")}Z`;
  const time = new Date(expected);
  return Number.isFinite(time.getTime()) && time.toISOString() === expected
    ? expected
    : null;
}
function adultFromDob(dob: string | undefined, now: Date): boolean | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const date = new Date(`${dob}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dob ||
    date > now ||
    now.getUTCFullYear() - date.getUTCFullYear() > 150
  )
    return null;
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.toISOString().slice(5, 10) < dob.slice(5, 10)) age--;
  return age >= 18;
}
function normalizedName(name: string): string | null {
  if (name.length > 768 || /[\p{Cc}\p{Cf}]/u.test(name)) return null;
  const value = name.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return value.length > 0 ? value.toUpperCase() : null;
}
function isApproved(review: z.infer<typeof reviewSchema>) {
  return (
    review.reviewStatus === "completed" &&
    review.reviewResult?.reviewAnswer === "GREEN"
  );
}
function sameReview(
  a: z.infer<typeof reviewSchema>,
  b: z.infer<typeof reviewSchema>,
) {
  return (
    a.reviewId === b.reviewId &&
    a.attemptId === b.attemptId &&
    a.levelName === b.levelName &&
    a.reviewDate === b.reviewDate &&
    a.reviewStatus === b.reviewStatus &&
    a.reviewResult?.reviewAnswer === b.reviewResult?.reviewAnswer
  );
}

/** The transport/clock arguments are dependency injection for offline tests.
 * Runtime construction must use the real fetch and real clock. */
export class SumsubCommercialKycProvider {
  readonly environment: BillingEnvironment;
  readonly providerEnvironment: "acceptance" | "production";
  #config: Readonly<SumsubKycConfig>;
  #transport: typeof fetch;
  #now: () => Date;

  constructor(
    config: SumsubKycConfig,
    transport: typeof fetch = fetch,
    now = () => new Date(),
  ) {
    try {
      const expectedPrefix =
        config.environment === "commercial" ? "prd:" : "sbx:";
      const clean = (s: string, min = 1) =>
        typeof s === "string" &&
        s.length >= min &&
        s.length <= 4096 &&
        !/[\s\x00-\x1f\x7f]/.test(s);
      if (
        !(["commercial", "acceptance"] as const).includes(config.environment) ||
        !clean(config.appToken, 12) ||
        !config.appToken.startsWith(expectedPrefix) ||
        !clean(config.secretKey, 32) ||
        !clean(config.webhookSecret, 32) ||
        !clean(config.identityHashKey, 32) ||
        new Set([
          config.secretKey,
          config.webhookSecret,
          config.identityHashKey,
        ]).size !== 3 ||
        !clean(config.clientId) ||
        config.clientId.length > 256 ||
        !config.levelName ||
        config.levelName.length > 256 ||
        /[\x00-\x1f\x7f]/.test(config.levelName)
      )
        throw Error();
      const back = new URL(config.returnUrl);
      if (
        back.protocol !== "https:" ||
        back.username ||
        back.password ||
        back.port ||
        back.search ||
        back.hash ||
        back.href !== config.returnUrl
      )
        throw Error();
      if (config.environment === "commercial") {
        if (
          back.origin !== "https://docked.com.au" ||
          config.acceptanceReturnOrigin
        )
          throw Error();
      } else {
        const allowed = new URL(config.acceptanceReturnOrigin ?? "");
        if (
          allowed.origin !== config.acceptanceReturnOrigin ||
          allowed.protocol !== "https:" ||
          allowed.username ||
          allowed.password ||
          allowed.port ||
          ["docked.com.au", "www.docked.com.au", "localhost"].includes(
            allowed.hostname,
          ) ||
          !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(allowed.hostname) ||
          back.origin !== allowed.origin
        )
          throw Error();
      }
      if (
        config.webhookAlgorithm &&
        !["HMAC_SHA256_HEX", "HMAC_SHA512_HEX"].includes(
          config.webhookAlgorithm,
        )
      )
        throw Error();
      for (const [value, min, max] of [
        [config.timeoutMs ?? 10000, 1000, 20000],
        [config.linkTtlSeconds ?? 600, 60, 1800],
      ])
        if (!Number.isInteger(value) || value < min || value > max)
          throw Error();
      this.environment = config.environment;
      this.providerEnvironment =
        config.environment === "commercial" ? "production" : "acceptance";
      this.#config = Object.freeze({ ...config });
      this.#transport = transport;
      this.#now = now;
    } catch {
      throw new CommercialKycProviderError("configuration");
    }
  }

  /** Use for exact name comparison only; a name match does not verify bank ownership. */
  hashLegalName(name: string): string {
    const normalized = normalizedName(name);
    if (!normalized) throw new CommercialKycProviderError("unverified");
    return createHmac("sha256", this.#config.identityHashKey)
      .update(`docked-kyc-name-v1\0${this.providerEnvironment}\0${normalized}`)
      .digest("hex");
  }

  async #request(
    path: string,
    method: "GET" | "POST" = "GET",
    input?: unknown,
  ): Promise<unknown> {
    try {
      if (
        !path.startsWith("/resources/") ||
        path.includes("..") ||
        path.includes("\\")
      )
        throw Error();
      const body = input === undefined ? undefined : JSON.stringify(input);
      const timestamp = Math.floor(this.#now().getTime() / 1000).toString();
      const signature = createHmac("sha256", this.#config.secretKey)
        .update(timestamp + method + path + (body ?? ""))
        .digest("hex");
      const response = await this.#transport(apiOrigin + path, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-App-Token": this.#config.appToken,
          "X-App-Access-Ts": timestamp,
          "X-App-Access-Sig": signature,
        },
        body,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(this.#config.timeoutMs ?? 10000),
      });
      if (response.status === 404)
        throw new CommercialKycProviderError("not_found");
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json") ||
        Number(response.headers.get("content-length") ?? 0) > maxBodyBytes
      )
        throw Error();
      const reader = response.body?.getReader();
      if (!reader) throw Error();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          length += next.value.byteLength;
          if (length > maxBodyBytes) throw Error();
          chunks.push(next.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch (error) {
      // Provider error bodies can contain personal information and credentials.
      // Do not attach the original cause or echo the request URL/body.
      if (
        error instanceof CommercialKycProviderError &&
        error.code === "not_found"
      )
        throw error;
      throw new CommercialKycProviderError("unavailable");
    }
  }

  async createHostedVerification(member: string) {
    const externalUserId = memberReference(this.environment, member);
    const startedAt = this.#now();
    const ttlInSecs = this.#config.linkTtlSeconds ?? 600;
    const response = await this.#request(
      "/resources/sdkIntegrations/levels/-/websdkLink",
      "POST",
      {
        levelName: this.#config.levelName,
        userId: externalUserId,
        ttlInSecs,
        redirect: {
          successUrl: this.#config.returnUrl,
          rejectUrl: this.#config.returnUrl,
        },
      },
    );
    try {
      const { url } = z.object({ url: z.string().max(4096) }).parse(response);
      const link = new URL(url);
      if (
        link.origin !== sdkOrigin ||
        link.username ||
        link.password ||
        link.port ||
        link.hash ||
        link.search ||
        !/^\/websdk\/p\/[A-Za-z0-9_-]+$/.test(link.pathname) ||
        link.href !== url
      )
        throw Error();
      return {
        provider: "sumsub" as const,
        providerEnvironment: this.providerEnvironment,
        externalUserId,
        url: link.href,
        expiresAt: new Date(
          startedAt.getTime() + ttlInSecs * 1000,
        ).toISOString(),
      };
    } catch {
      throw new CommercialKycProviderError("unverified");
    }
  }

  /** Fresh authoritative read. A 404/outage is NOT permission to preserve an old
   * approved identity: callers must fail closed and retry reconciliation. */
  async fetchIdentity(
    member: string,
    expectedApplicantId?: string,
  ): Promise<CommercialKycIdentity> {
    const externalUserId = memberReference(this.environment, member);
    try {
      if (expectedApplicantId) applicantId.parse(expectedApplicantId);
      const person = applicantSchema.parse(
        await this.#request(
          `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`,
        ),
      );
      if (
        person.externalUserId !== externalUserId ||
        person.clientId !== this.#config.clientId ||
        (expectedApplicantId && person.id !== expectedApplicantId) ||
        (person.sandboxMode !== undefined &&
          person.sandboxMode !== (this.environment === "acceptance"))
      )
        throw Error();
      const steps = isApproved(person.review)
        ? stepsSchema.parse(
            await this.#request(
              `/resources/applicants/${person.id}/requiredIdDocsStatus`,
            ),
          )
        : null;
      // Status is read last: a late GREEN event, profile reset or re-review does
      // not overwrite a newer rejection/hold using the old webhook payload.
      const review = reviewSchema.parse(
        await this.#request(`/resources/applicants/${person.id}/status`),
      );
      const now = this.#now();
      let reviewedAt = review.reviewDate ? utcDate(review.reviewDate) : null;
      if (reviewedAt && new Date(reviewedAt).getTime() > now.getTime() + 60000)
        reviewedAt = null;
      let reason: CommercialKycIdentity["eligibilityReason"] =
        "provider_pending";
      let status: CommercialKycEvidence["status"] = "pending";
      let legalName: string | null = null;
      let country: string | null = null;
      let adult = false;
      if (person.deleted === true) {
        status = "rejected";
        reason = "provider_inactive";
      } else if (
        review.reviewStatus === "completed" &&
        review.reviewResult?.reviewAnswer === "RED"
      ) {
        status = "rejected";
        reason = "provider_rejected";
      } else if (
        review.levelName !== this.#config.levelName ||
        person.review.levelName !== this.#config.levelName
      ) {
        reason = "level_mismatch";
      } else if (!sameReview(person.review, review)) {
        reason = "review_changed";
      } else if (isApproved(review)) {
        const approvedSteps =
          steps &&
          [steps.IDENTITY, steps.SELFIE, steps.PROOF_OF_RESIDENCE].every(
            (step) =>
              step?.reviewResult?.reviewAnswer === "GREEN" &&
              step.forbidden !== true,
          );
        if (!approvedSteps) reason = "steps_incomplete";
        else {
          const info = person.info;
          const matchesApprovedDocument = info?.idDocs?.some(
            (doc) =>
              doc.idDocType === steps.IDENTITY?.idDocType &&
              doc.country === steps.IDENTITY?.country &&
              doc.dob === info.dob,
          );
          const birthAdult = matchesApprovedDocument
            ? adultFromDob(info?.dob, now)
            : null;
          const name = [info?.firstName, info?.middleName, info?.lastName]
            .filter(Boolean)
            .join(" ");
          const addresses =
            info?.addresses?.map((address) => address.country) ?? [];
          const residence = info?.residenceCountry;
          const auAddress =
            addresses.length > 0 && addresses.every((c) => c === "AUS");
          const nonAu =
            (residence && residence !== "AUS") ||
            (steps.PROOF_OF_RESIDENCE?.country &&
              steps.PROOF_OF_RESIDENCE.country !== "AUS") ||
            addresses.some((c) => c && c !== "AUS");
          adult = birthAdult === true;
          if (
            auAddress &&
            !nonAu &&
            steps.PROOF_OF_RESIDENCE?.country === "AUS"
          )
            country = "AU";
          if (
            !review.reviewId ||
            !reviewedAt ||
            birthAdult === null ||
            !normalizedName(name)
          )
            reason = "identity_incomplete";
          else if (!birthAdult) {
            status = "rejected";
            reason = "underage";
          } else if (nonAu) {
            status = "rejected";
            reason = "outside_australia";
          } else if (!country) reason = "identity_incomplete";
          else {
            status = "approved";
            reason = "verified";
            legalName = name.normalize("NFKC").trim().replace(/\s+/gu, " ");
          }
        }
      }
      const evidence: CommercialKycEvidence = {
        provider: "sumsub",
        providerEnvironment: this.providerEnvironment,
        providerApplicantId: person.id,
        providerReviewId: review.reviewId ?? null,
        providerReviewedAt: reviewedAt,
        checkedAt: now.toISOString(),
        status,
        country,
        adult,
        // Do not put names, DOB, addresses, document numbers or provider comments
        // in evidence. A keyed digest permits stable audit references without PII.
        evidenceReference: "",
        legalNameHash: legalName ? this.hashLegalName(legalName) : null,
      };
      evidence.evidenceReference =
        `sumsub:${this.providerEnvironment}:` +
        createHmac("sha256", this.#config.identityHashKey)
          .update(
            JSON.stringify({
              ...evidence,
              checkedAt: undefined,
              eligibilityReason: reason,
            }),
          )
          .digest("hex");
      return {
        evidence,
        verifiedLegalName: legalName,
        eligibilityReason: reason,
      };
    } catch (error) {
      if (error instanceof CommercialKycProviderError) throw error;
      throw new CommercialKycProviderError("unverified");
    }
  }

  /** Authenticate raw bytes only. Return value is a reconciliation trigger,
   * NEVER an approval. Persist replayId with the refresh result transactionally. */
  verifyWebhook(rawBody: Uint8Array, headers: Headers): VerifiedSumsubWebhook {
    try {
      if (
        !(rawBody instanceof Uint8Array) ||
        rawBody.byteLength === 0 ||
        rawBody.byteLength > maxWebhookBytes
      )
        throw Error();
      const algorithm = this.#config.webhookAlgorithm ?? "HMAC_SHA256_HEX";
      if (headers.get("x-payload-digest-alg") !== algorithm) throw Error();
      const hash = algorithm === "HMAC_SHA512_HEX" ? "sha512" : "sha256";
      const provided = headers.get("x-payload-digest") ?? "";
      if (
        !(hash === "sha256" ? /^[a-fA-F0-9]{64}$/ : /^[a-fA-F0-9]{128}$/).test(
          provided,
        )
      )
        throw Error();
      const expected = createHmac(hash, this.#config.webhookSecret)
        .update(rawBody)
        .digest();
      if (!timingSafeEqual(expected, Buffer.from(provided, "hex")))
        throw Error();
      const payload = webhookSchema.parse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)),
      );
      if (
        payload.clientId !== this.#config.clientId ||
        payload.sandboxMode !== (this.environment === "acceptance")
      )
        throw Error();
      const prefix = `docked:${this.environment}:`;
      const member = payload.externalUserId.slice(prefix.length);
      if (
        !payload.externalUserId.startsWith(prefix) ||
        memberReference(this.environment, member) !== payload.externalUserId
      )
        throw Error();
      const createdAt = utcDate(payload.createdAtMs ?? payload.createdAt ?? "");
      if (
        !createdAt ||
        new Date(createdAt).getTime() > this.#now().getTime() + 5 * 60000
      )
        throw Error();
      // Old authentic events may be legitimate retries. A durable replay record
      // and fresh API read prevent them from restoring a superseded approval.
      const replayId =
        `sumsub:${this.providerEnvironment}:` +
        createHash("sha256")
          .update(this.#config.clientId + "\0")
          .update(rawBody)
          .digest("hex");
      return {
        provider: "sumsub",
        providerEnvironment: this.providerEnvironment,
        memberId: member,
        providerApplicantId: payload.applicantId,
        type: payload.type,
        correlationId: payload.correlationId,
        eventCreatedAt: createdAt,
        replayId,
      };
    } catch {
      throw new CommercialKycProviderError("invalid_webhook");
    }
  }

  /** Convenience for authenticated webhook work. Caller must serialize by
   * member and record replayId durably, so concurrent old/new reads cannot commit
   * in the opposite order. Errors must close withdrawal eligibility. */
  async refreshWebhook(rawBody: Uint8Array, headers: Headers) {
    const event = this.verifyWebhook(rawBody, headers);
    const identity = await this.fetchIdentity(
      event.memberId,
      event.providerApplicantId,
    );
    return { event, identity };
  }
}
