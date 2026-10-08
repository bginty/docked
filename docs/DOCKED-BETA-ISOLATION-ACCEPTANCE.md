# Isolated beta implementation and acceptance

9 October 2026. Continues `d991e8b8`. Account activation remains closed; this is not a declaration that invited users can play yet.

## Boundaries

The dedicated production project `pojoymtniryarxxunyvz` now has `beta_public`, `beta_private` and `beta_fantasy` schemas. Original application records remain intact. Beta has separate editions, supply counters, packs, allocations, ownership history, transaction receipts, lifetime starter entitlements, daily claims, competitions, results, community posts, settlements, monthly/lifetime rankings and recognition records.

`scripts/generate-beta-namespace.mjs` deterministically projects 22 pinned, hash-recorded migrations into the new namespace. It copies definitions and original seed catalogues, **not live rows**. Existing migrations are unchanged. Future rule changes must explicitly address both schemas. Beta cannot become official by flipping its release label.

`docked_beta_app` is a restricted server login without elevated attributes or role memberships. It cannot access official records/functions, mutate admissions or approve policies. Browsers have no beta-schema grants. Every beta table has RLS. Narrow transaction functions retain identity/session, ownership, immutability and MFA checks. SQL routing changes trusted SQL text, never bound values; database privileges are the security boundary.

Supabase Auth supplies shared identity/session services. Beta Auth projections are restricted to reserved identities. Beta suspension/erasure cannot delete shared Auth identities or official sessions. No beta gameplay foreign key references an official gameplay table.

## Atomic admission

- Ten lifetime tester reservations serialized by a control-row lock. Pending, expired, revoked and suspended reservations still count; renewal retains its slot/history.
- Only operator-designated administrator UUIDs are exempt. Email addresses and editable metadata confer neither exemptions nor roles.
- Random admission codes, SHA-256 digests, one-hour API expiry, seven-day database maximum and immutable events. Codes are never logged or automatically mailed.
- Exact invited Auth identity, verified email, active session, Australian state/territory, adult attestation and seven current policy versions are required. These attestations do not promise foolproof prevention of multiple accounts or VPN use.
- Concurrent acceptance returns one receipt. Invalid/expired codes fail. Explicit MFA renewal invalidates the old code.
- MFA revocation/suspension denies ongoing application access despite valid provider tokens. Direct profile creation cannot bypass admission.
- Separate gates control owner acceptance and external testers. Both remain disabled.

`POST /api/beta/invitations` supports reserve, renew, revoke and suspend. It requires owner/admin authorization, `aal2`, explicit administrator designation, same-origin requests and rate limits. The response contains a private code only after a successful reservation/renewal and reports `emailSent:false`. Reconcile uncertain responses before renewal; do not blindly resend.

Supabase `generateLink(type: invite)` can prepare an Auth identity/link without sending it; confirm application reservation before delivery. Do not assume manually creating a user and inviting afterward is equivalent. An Auth identity without accepted admission has no gameplay access. Both the verified Auth invitation and beta admission code are required in account setup. The provider journey still requires hosted acceptance after policy approval.

## Evidence

- [Real PostgreSQL tests](qa/beta-isolation/real-postgres.json): disposable loopback database, migration hashes, races for slots/cards/rewards, separate lifetime entitlements, cross-environment denial, official-table snapshots, community persistence, scoring/locks, rankings, rollback, expiry, renewal and suspension. These are not hosted member tests.
- [Hosted migration](qa/beta-isolation/hosted-apply.json) and [forward boundary](qa/beta-isolation/hosted-forward.json): actual approved project; official-record digest unchanged; no accounts created or activation enabled.
- [Hosted runtime](qa/beta-isolation/hosted-runtime.json): TLS-authenticated beta login; official access and admission mutation denied.
- Security advisor: informational RLS-without-policy findings on intentionally inaccessible tables; no warning/error reported. Do not add permissive policies to silence default-deny notices.

The signed durable email queue, certificate authentication and Exchange mailbox scope are preserved. Prepared code supports one exact pinned Vercel origin and at most eleven recipient addresses. Microsoft permissions, certificates and sending activation were unchanged. No new delivery confirmation is claimed. Other-mailbox negative authorization remains untested.

## Remaining activation sequence

1. Owner approves exact policy versions and resolves the outstanding compliance facts in [the policy matrix](DOCKED-BETA-POLICY-APPROVAL.md). Candidate `2026-10-09-beta-rc1` was established in `d991e8b8`; no approval is inferred.
2. Record approved policy versions/digest/evidence; initialize beta-only fantasy and reviewed Australian community policies. Do not alter the official production approval manifest.
3. Pin the verified staging origin in Supabase Auth and the signed email hook. Deploy prepared email-origin support with sending still closed, then perform controlled support-mailbox acceptance. Public signup stays disabled.
4. Owner deliberately confirms the support invitation, sets a password, accepts approved policies and enrolls MFA at `/mfa` using their own device. Never paste authenticator seeds, recovery material or passwords into chat. Verify `aal2` before granting the minimum designated owner role.
5. Complete actual hosted invitation, confirmation, recovery, invalid/expired links, failure/retry and persisted gameplay acceptance. Local/mocked checks are insufficient.
6. After those pass, record external activation evidence, admit at most ten owner-nominated Australian adults and restrict email recipients accordingly. Email allowlists cannot bypass database admission.

`config/hosted-beta.json` defines the protected Vercel Preview boundary independently of production approval. It rejects other projects/teams/branches, production targets, official database credentials and privileged web secrets. Redirects and cookies bind to the real HTTPS deployment hostname. Public signup, payments, trading, live polling and official publication remain disabled.

Android awaits hosted acceptance and a verified protected-origin/session method. No new APK or physical-device testing is claimed. The public holding page remains unchanged; production promotion requires separate authorization.
