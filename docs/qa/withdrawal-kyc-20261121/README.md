# Hosted identity verification adapter

This change prepares the server adapter for Sumsub-hosted identity verification. It does not create a Sumsub account, configure a verification level, upload an identity document, invoke a live check, change a commercial control or establish that withdrawals are ready to activate. No production credentials or provider account were available for this implementation.

## Integration contract

`src/server/commercial-kyc-provider.ts` exports `SumsubCommercialKycProvider` and the `SumsubKycConfig`, `CommercialKycEvidence`, `CommercialKycIdentity` and `VerifiedSumsubWebhook` types. Construct the provider with the real `fetch` and clock in runtime code. The extra constructor arguments are solely dependency injection for offline tests.

| Method                                          | Contract                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createHostedVerification(memberId)`            | Creates a short-lived hosted link for `docked:{commercial\|acceptance}:{authenticated member UUID}`. The member comes from the authenticated server identity. The redirect comes exclusively from fixed server configuration. Returns a link and expiry, never an approval. |
| `fetchIdentity(memberId, expectedApplicantId?)` | Reads the member's applicant from Sumsub, reads the required verification steps, then reads the latest review status. Checks member, provider account, applicant, level and environment. Returns minimal evidence plus a sensitive, temporary server-only legal name.       |
| `hashLegalName(name)`                           | Computes a stable, environment-bound HMAC of the normalized name. This supports comparison with identity evidence. It does not establish bank-account ownership.                                                                                                            |
| `verifyWebhook(rawBytes, headers)`              | Validates the raw-byte HMAC, pinned algorithm, environment, account and external member reference. Returns a reconciliation trigger and replay identifier. It deliberately does not return the webhook's approval claim.                                                    |
| `refreshWebhook(rawBytes, headers)`             | Convenience wrapper that authenticates the event and obtains a fresh identity result bound to its applicant ID. The caller still owns durable replay handling and per-member serialization.                                                                                 |

`CommercialKycEvidence` is the persistence boundary. It includes the provider/environment, actual applicant/review IDs, provider review time, check time, eligibility status, AU country/adult flags, HMAC legal-name fingerprint and an opaque evidence reference. A pending review may have a null review ID; an approved result must have the real review ID and review time. Names, DOB, addresses, document numbers, document images and provider comments are absent from this record.

`CommercialKycIdentity.verifiedLegalName` exists only for the server's destination ownership review. Do not log it, return it in member JSON or persist it unencrypted. Store only the evidence record in the identity revision table. A staff statement about bank ownership must remain a separate, attributable check with its own evidence reference; matching a typed account-holder name is insufficient.

## Required configuration

The root runtime owns mapping secret environment variables into `SumsubKycConfig`. This module reads no environment variables and contains no fallback credentials.

Runtime configuration uses `DOCKED_SUMSUB_APP_TOKEN`, `DOCKED_SUMSUB_SECRET_KEY`, `DOCKED_SUMSUB_WEBHOOK_SECRET`, `DOCKED_SUMSUB_IDENTITY_HASH_KEY`, `DOCKED_SUMSUB_CLIENT_ID` and `DOCKED_SUMSUB_LEVEL_NAME`. Acceptance uses the separate `DOCKED_ACCEPTANCE_SUMSUB_` prefix for each setting, plus the fixed HTTPS `DOCKED_WITHDRAWAL_ACCEPTANCE_ORIGIN`. The optional webhook algorithm uses `DOCKED_SUMSUB_WEBHOOK_ALGORITHM` or `DOCKED_ACCEPTANCE_SUMSUB_WEBHOOK_ALGORITHM`. The commercial return URL is fixed to `https://docked.com.au/profile/withdrawals`.

Bank encryption uses separate keys: `DOCKED_WITHDRAWAL_BANK_KEY_ID` with `DOCKED_WITHDRAWAL_BANK_KEYS` (a JSON map of key IDs to hexadecimal keys), or the corresponding `DOCKED_ACCEPTANCE_WITHDRAWAL_BANK_KEY_ID` and `DOCKED_ACCEPTANCE_WITHDRAWAL_BANK_KEYS`. None of these credentials, keys or provider approval references belongs in a client projection.

| Setting                  | Required behavior                                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment`            | `commercial` uses Production; `acceptance` uses Sandbox.                                                                                                                                                                                                                                             |
| `appToken`               | Use the environment's actual app token. This global-region adapter accepts `prd:` for commercial and `sbx:` for acceptance. API permissions needed are **Create applicants** and **View applicants**. Do not give the runtime authority to approve, import completed checks, or alter identity data. |
| `secretKey`              | API signing secret, at least 32 characters.                                                                                                                                                                                                                                                          |
| `webhookSecret`          | Separate webhook HMAC secret, at least 32 characters.                                                                                                                                                                                                                                                |
| `identityHashKey`        | Separate stable random secret, at least 32 characters, for name and evidence HMACs. Rotate with an explicit evidence/destination re-verification plan because fingerprints will change.                                                                                                              |
| `clientId`               | Exact Sumsub account ID expected in applicant and webhook data.                                                                                                                                                                                                                                      |
| `levelName`              | Exact, case-sensitive level created in the relevant provider environment. Configure document identity, selfie/liveness and document proof of residence for this implementation.                                                                                                                      |
| `returnUrl`              | Fixed canonical HTTPS return URL without query, fragment, credentials or port. Commercial must use `https://docked.com.au`. The browser return is a navigation event, never evidence.                                                                                                                |
| `acceptanceReturnOrigin` | Required for acceptance, and must exactly equal the configured return URL's HTTPS origin. Production Docked and localhost are rejected. Bind this to the restricted disposable Preview, not a user-supplied host.                                                                                    |
| `webhookAlgorithm`       | Pin `HMAC_SHA256_HEX` (default) or `HMAC_SHA512_HEX` to the provider configuration. SHA-1 and algorithm substitution are rejected.                                                                                                                                                                   |
| `timeoutMs`              | Default 10 seconds per provider request; allowed 1–20 seconds.                                                                                                                                                                                                                                       |
| `linkTtlSeconds`         | Default 600 seconds; allowed 60–1,800 seconds.                                                                                                                                                                                                                                                       |

The API origin is fixed to `https://api.sumsub.com`. Hosted links must be canonical `https://in.sumsub.com/websdk/p/...` URLs with no credentials, query, fragment or alternate port. Regional Sumsub endpoints and branded/custom SDK hosts need an explicit additional integration review; arbitrary host configuration is intentionally absent. Verify the actual hosted link format in the provider's Sandbox before customer rollout.

Sumsub distinguishes account environments through its tokens; external member references are additionally namespaced. When present, the API's sandbox marker must agree. Webhooks must include the matching `sandboxMode`. Dashboard-generated `testMode` payloads cannot establish an identity in either environment. Tests in this repository mock HTTP only; the adapter contains no production fixture mode, document upload endpoint or local identity override.

## AU and adult eligibility

An eligible result requires all of the following from fresh provider reads:

- The configured individual KYC level has overall `completed` / `GREEN` status, a real review ID and a valid review completion timestamp.
- The `IDENTITY`, `SELFIE` and `PROOF_OF_RESIDENCE` steps each have `GREEN` results and are not forbidden.
- The extracted document DOB corresponds to the approved identity document type and issuing country. The date must be valid, plausible and at least 18 years ago by UTC calendar date. Invalid or absent DOB never passes.
- The approved proof-of-residence document is Australian and the document-extracted address data establish Australia without conflicting residence data.
- The provider returned a usable document-derived legal name and the final review still matches the initial applicant snapshot.

`info.country` describes the identity document's issuing country. It is not treated as proof of residence or nationality eligibility. A New Zealand passport with verified Australian residence can pass; an Australian passport with foreign residence does not. Applicant-entered `fixedInfo` is never substituted for missing extracted identity or address evidence. Missing data or an unknown/new review status stays pending. Underage, foreign-resident, deactivated and provider-rejected identities remain ineligible.

The configured flow is deliberately document based. Non-document verification or an alternative residence check requires a separately implemented and verified evidence mapping; selecting a weaker provider level cannot silently approve it.

## Webhook processing and fresh-state requirements

Preserve the raw HTTP body bytes. Validate them before JSON interpretation. Do not deserialize and reserialize the body before verifying its HMAC. Bound the route body to 128 KiB before buffering; the adapter also enforces this size. Provider JSON reads are limited to 512 KiB. Outgoing requests use HTTPS, no redirect following, no cache and a finite timeout. Errors omit provider bodies, private comments and original exception causes.

Persist `replayId` under a unique constraint and bind it to the processing result atomically. Sumsub documents that multiple events can share a `correlationId`, so the replay identifier includes the provider account/environment and a digest of the authenticated raw event. Duplicate deliveries can acknowledge an already completed record; failed processing must remain retryable.

Serialize the complete authoritative refresh and record operation for a member, not only the final database insert. Otherwise two concurrent reads could commit in reverse order. Store a server-bound verification session before issuing the link to the member. The provider applicant may only be created when the member opens the link. Once known, preserve its member/applicant binding. An event referring to a different applicant ID must fail closed and reconcile rather than replace the established identity implicitly.

Do not grant eligibility from a redirect query, SDK event or webhook `GREEN` value. A delayed genuine `GREEN` event can arrive after a rejection. The refresh reads the current review and returns the current rejection/hold. The adapter permits old authentic retry notifications because only the fresh API result can affect eligibility. Future timestamps beyond five minutes are rejected.

A 404, provider outage, malformed response or changed binding cannot preserve withdrawal approval. Runtime handling must make the identity unavailable for payout, retain completed records, and retry reconciliation. Subscribe to changes and resets as well as `applicantReviewed`; refresh again before an irreversible payout. Provider identity checks remain separate from available seller proceeds, cash reserves, transaction/refund holds and destination ownership.

## Verification performed

`node --import tsx --test tests/platform/commercial-kyc-provider.test.ts`: **37 passed, zero failed or skipped**. All HTTP responses are synthetic and local. Coverage includes signed hosted requests, member/account/environment binding, rejection after an old approval event, reset races, pending statuses, minimum age and malformed dates, proof of residence versus document issuing country, URL allowlisting, raw HMAC verification and downgrade rejection, replay identifiers, oversized input and secret-free failures.

Focused strict TypeScript and ESLint checks passed for the two new TypeScript files. The initial whole-repository check found missing baseline roster/artwork JSON in the partial checkout. Those fixtures were restored and the subsequent whole-repository TypeScript checks passed. Final integrated build and native database results are recorded separately in `CASH_RELEASE_READINESS.md`; no offline check is a claim that a live provider flow passed. The `tsx` CLI could not create its IPC socket in this workspace; the Node `--import tsx` test invocation ran successfully without that IPC dependency.

## Official sources checked on 2026-11-21

The implementation uses the provider's current primary API documentation. No account-specific production behavior has been observed yet.

- [API authentication and signing](https://docs.sumsub.com/reference/authentication): timestamp, method, path/query and exact body bytes in HMAC-SHA256.
- [Generate external WebSDK link](https://docs.sumsub.com/reference/generate-websdk-external-link): server external user ID, level, expiry and redirects.
- [Get applicant data by external user ID](https://docs.sumsub.com/reference/get-applicant-data-via-externaluserid) and [Get applicant data](https://docs.sumsub.com/reference/get-applicant-data): authoritative applicant, extracted identity and address data.
- [Get review status](https://docs.sumsub.com/reference/get-applicant-review-status): overall completion, review ID/date and answer.
- [Get verification-step status](https://docs.sumsub.com/reference/get-status-of-verification-steps): approved document type/country, ID/selfie/residence results and forbidden flags.
- [Webhook manager](https://docs.sumsub.com/docs/webhook-manager): raw-byte HMAC verification and digest algorithm headers.
- [User verification webhooks](https://docs.sumsub.com/docs/user-verification-webhooks): environment markers, manual test marker, timestamps, status changes and shared correlation IDs.
- [Receive verification results](https://docs.sumsub.com/docs/receive-verification-results): repeated final events, late rejection and delivery retries.
- [App tokens](https://docs.sumsub.com/docs/app-tokens) and [Sandbox](https://docs.sumsub.com/docs/test-in-sandbox): separate environments and test-only verification.
- [Deactivate applicant](https://docs.sumsub.com/reference/deactivate-applicant-profile): `deleted` marks an inactive applicant.
- [Documented app-token prefix examples](https://docs.sumsub.com/reference/manage-case-assignees) and [Sandbox token prefix](https://docs.sumsub.com/docs/transaction-monitoring-quick-start-guide).
