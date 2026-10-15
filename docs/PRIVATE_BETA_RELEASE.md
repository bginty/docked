# Premium Docked beta release — 15 October 2026

> Follow-up: a member reported a loading regression. The jersey query was repaired and the premium release restored; see [sign-in recovery](SIGNIN_RECOVERY.md) for the temporary rollback, cause and live verification.

**Released to the existing admitted Production beta:** https://docked.com.au/app. This follows the owner's explicit subsequent request to push to Production. The existing beta remains invitation-only; this is not commercial activation or public signup.

- Application source: `45b570aefd70962c7266f785b20404de6b5baeac`.
- Deployment: `dpl_5vnGoyBCXpy6rLK5W1PjNfKQhU2V`, READY; both `docked.com.au` and `www.docked.com.au` verified against that deployment.
- Project: `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`; existing database `pojoymtniryarxxunyvz`.
- Working/review branches pushed through the existing workflow. No merge to main.
- Owner, Barry and Luke already have confirmed, admitted accounts with gameplay and test-wallet access. Owner MFA remains required. No new invitations were necessary or sent.

## Delivered

The premium Play field, shared illustrated jerseys with verified numbers, six rarity treatments, responsive Play/Cards layout and completed test-only wallet interface are deployed. Existing pack/replay, marketplace, competition and historical scoring behavior is retained. Unknown jersey numbers remain blank.

v22's checked shell configuration is `au.com.docked.app`, loading `https://docked.com.au/app`. Fully close and reopen the app; refresh the website if using a browser. This web release requires no APK rebuild or replacement. No new APK was distributed.

Real redemption, bank payments, real-document collection and cash conversion remain disabled. All existing beta credits remain non-redeemable. No member assets, balances, teams or transactions were used for QA. No social posts, messages or invitations were sent.

## Verification

The previously completed local application checks and their provenance are recorded in [the implementation handover](PREMIUM_WALLET_COMPLETION.md): 366 platform, 48 focused, 154 uninterrupted serial database tests, five genuine local HTTP/Auth/MFA/PostgreSQL groups, nine separate-connection groups, five fixture browser groups, 18 visual/browser tests and five final layout checks; typecheck, lint, build and client boundary passed. These are local results, not hosted member transactions.

Release evidence in [qa/private-beta-release](qa/private-beta-release/):

- `candidate.json` and `live.json`: eight checks each, exact source/deployment/database identity, invitation-only metadata, anonymous API denial, current deployed styles and redemption denial.
- `admission.json`: read-only confirmed-account, admission, gameplay, wallet and owner-MFA policy checks for all three testers. This does not claim a fresh interactive login or successful member pack purchase/competition entry.
- `migration-applied.json`: both additive migrations applied in one transaction; all eleven snapshotted ledger/inventory/team tables unchanged. Real redemption remains unconfigured.
- `secret-review.json`: nine raw findings remain explicitly reported; eight reviewed fixture/generated matches plus the untouched untracked APK capability. Hashes and finding paths rechecked; no new finding or broad scanner exclusion.

The first live probe expected HTTP 401/403 for the redemption POST. The actual route correctly returned HTTP 400 with `outcome: rejected` and its documented disabled message. The verification helper now checks that exact response; the repeated live run passed. No application defect, reservation or payment resulted. The protected candidate URL instead rejects the origin before reaching this route.

Hosted transactional acceptance and physical S24 testing were not performed. Native emulator startup remained blocked as documented in the implementation handover. These are follow-up checks, not represented as completed.

## Migrations and rollback

Applied only:

- `20261015055109_manual_credit_redemption.sql` — additive permission/immutable snapshot protections; hosted activation remains prohibited.
- `20261015080107_verified_jersey_presentation.sql` — narrow read-only retained-roster projection.

The private recovery snapshot was read back and SHA-256 verified before migration. It covers eleven affected ledger/inventory/team tables, not full Auth/storage disaster recovery. Its location/hash is recorded in `migration-applied.json`; it is not committed.

Rollback reference: **`dpl_EQTfcz1qZ7HoYgLPJBgk6xRUVodn`**, source `7c1303f388d40483113be57d88ec16e5eb2afdc0`. Restore the prior application deployment through the existing Vercel promotion/rollback workflow if necessary. Leave compatible additive schema in place; do not restore aggregate data over later transactions or delete receipts, journals, reservations or scoring history. Remove the jersey projection only after removing readers. Financial activation remains separately gated.

## Preview and remaining observations

The separate historical `docked-preview` project now has Vercel protection enabled. It has **not** been updated to this application/database revision. Its older isolated schema and Auth delivery configuration still need reconciliation for a separate authenticated Preview. Do not direct testers there for this release; the newly approved Production beta above uses their existing accounts. No Production data was copied into Preview.

The signed APK download capability remains uncommitted, unused and excluded from the deployable export. Its encoded expiry is 18 October 2026 10:44:54 UTC. No exposure was found in inspected tracked/client artifacts; external sharing and remote validity are unverified. If it was unintentionally shared, revoke only that link through its issuing service. This is not a blanket secret-scan pass.

Physical S24 follow-up: reopen v22; sign in using each person's own account (owner MFA); inspect Play/Cards portrait and landscape, long names, jersey numbers/unknown fallback, card details, filtering and touch navigation; test saved pack replay/Next/Skip without purchasing again; check offline/reopen recovery. Any transactional QA should use designated QA assets, not existing competition cards. Genuine future-round scoring observation remains pending.

Financial activation still requires approved issuance/proceeds, verification/document security and retention, limits, key custody, staffing/banking/reconciliation, business calendar and legal decisions listed in the earlier handover. None were activated by this release.
