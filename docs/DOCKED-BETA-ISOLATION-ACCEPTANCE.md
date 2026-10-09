> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

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
## Focused review and corrected hosted attempt

The single bounded reviewer ran on **Astra High**, read-only, with no nested delegation, remote access, edits or data changes. No Ultra review was used. It identified a high-severity stale-snapshot admission race: a control-row lock alone allowed `REPEATABLE READ` requests to count obsolete reservations. A disposable PostgreSQL reproduction committed all twenty simultaneous requests despite only six available slots. The forward migration `20261008232200_beta_admission_snapshot_serialization.sql` now writes an admission revision before capacity checks, causing stale callers to abort with SQLSTATE `40001`. Fresh retries preserve the cap and idempotency. A narrow reviewer readback confirmed the correction; the main agent implemented and tested it.

The final local run covers **19 scenarios**, including actual restricted-role administrator reservation/recovery, non-MFA/member denial, twenty simultaneous seventh claims producing one beta card, and byte-equivalent final snapshots of all official tables. Historic claim dates are fixtures in a disposable local database, not modified hosted data.

First connected Preview `dpl_4KLuYaerMaCmhR2mAXxhPd9hyDSf` (application `41dc89a6`) verified real beta database connectivity and closed access. Its acceptance run found an app-login beta-label omission, inconsistent denial-status ordering and an intermittent homepage500. Exact-project PostgreSQL logs at 23:16–23:17UTC reported six SQLSTATE53300 connection-limit errors for `docked_beta_app`. The deployment omitted the existing serverless pool setting and retained the persistent default. The corrected contract requires `DATABASE_RUNTIME=serverless` (one connection per instance, idle20s); no connection limit, service tier or cost was increased. Initial failed results are retained in `qa/beta-isolation/hosted-first-attempt.json`.

The initial CLI submission was rejected before creating any deployment because `--skip-domain` only applies to Production. After read-only reconciliation confirmed no new deployment, the flag was removed; `--target preview`, exact project/team/branch checks and no custom domains remained mandatory. Raw Vercel target `null` is recorded as built-in Preview, never represented as a literal `preview` response.
## Final protected staging result

- Website: https://docked-production-htz4tu7lh-briant-s-projects.vercel.app
- Deployment: `dpl_CYJXho3m3fMR2S5qSB7XQfWoAP3u`, READY, explicit Preview request and raw response target `null` (built-in Preview).
- Deployed application: `1b8c3f8d54b24fb857e201d5ec94f8cfd2deb843`, branch `codex/vercel-beta-review`.
- Exact project/team: `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST` / `team_tf6xweKKyVCj9bTppUKttJ4l`. No custom domains or aliases attached.
- [Hosted checks](qa/beta-isolation/hosted-acceptance.json): **36 passed**, including real restricted-beta database connectivity, security headers, disabled Auth/invitation endpoints, member/admin denial, exact-origin invalid/expired callbacks, five repeated homepage/database reads and twelve page/viewport combinations. 320/412/1366-pixel Chromium emulation showed no horizontal overflow or uncaught page errors. This is not physical Android/iPhone testing.
- [Published browser asset scan](qa/beta-isolation/hosted-client-scan.json): 17 served JS/CSS assets, 1,053,580 bytes, zero findings. Committed web export also passed, 530 files, zero findings. No runtime error logs returned for the corrected deployment during acceptance.
- Final database regression: **211/211**. Focused Auth, invitation, Graph queue, staging and Android release guards: **46/46**. TypeScript and changed-source lint passed. The earlier full platform run had one subprocess timeout; its focused rerun passed all eight tests. It is not represented as a clean single full-suite run.
- Read-only production status: public signup disabled, email confirmation required, 167 beta tables with RLS, zero beta admissions/Auth users, beta admission/tester/fantasy gates closed. Role connection limit stays8. No new paid service, plan upgrade or connection-limit increase.
- Holding page: `https://docked.com.au` HTTPS200; `www`301 to apex. Existing review URL still Vercel-protected. No Oura or old Docked Preview backend was accessed/modified; no unrelated project or production-domain mutation.

Screenshots: [desktop homepage](qa/beta-isolation/HOSTED-home-1366.png), [mobile account](qa/beta-isolation/HOSTED-app-412.png), [mobile homepage](qa/beta-isolation/HOSTED-home-412.png). These show closed staging, not a signed-in playable session. The closed feature gates still select the preserved Edge public presentation; they do not demonstrate activated Fantasy gameplay.

The reproducible runner is `scripts/beta-hosted-acceptance.mjs`, invoked through authenticated `vercel env run` for the exact linked project. It reads the recorded deployment, requires the expected project/team/Preview origin and scopes its short-lived protection header to that origin. It never creates accounts or sends mail.

**Still blocked:** positive hosted invitation/confirmation/recovery delivery, owner MFA, multi-user persisted gameplay/moderation and cross-device acceptance. Prior diagnostic Inbox confirmations remain prior evidence only; no new email was sent. Prepared email-origin support is committed but remains undeployed/unconfigured. Other-mailbox negative Microsoft authorization remains untested. Android APK preparation remains gated until hosted acceptance passes; no new APK or physical-device claim.

The exact next owner actions and remaining technical activation sequence are in [controlled beta operations](DOCKED-CONTROLLED-BETA-OPERATIONS.md). No policy version, legal outcome or external-account approval has been inferred.
