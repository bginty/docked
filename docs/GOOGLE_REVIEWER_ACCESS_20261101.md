# Google Play reviewer access — verified private-beta configuration

Updated 1 November 2026. This supersedes the earlier preparation-only status in this file. The dedicated account is **briantginty21@gmail.com**, team **Docked Review**. The owner created its password, confirmed email and completed ordinary authentication/consent. The owner also reported saving its existing password and access declaration directly in Play Console. No password is stored in this repository or report; no owner role, MFA exemption or special authentication bypass was granted.

## Actual hosted acceptance

The genuine signed-in reviewer Chrome session completed free-Core selection, draft save, confirmed entry, Rankings and View Team in all three Traditional practice competitions. These are browser observations with subsequent read-only Production database confirmation, not fixtures masquerading as hosted acceptance.

| Sport | Free Core roster eligibility | Selected | Salary / cap | Competition |
| --- | ---: | ---: | --- | --- |
| NFL | 386 | 7 | $3.5m / $4.4m | `2a94395d-71c5-4f83-bf83-f8e867aca682` |
| AFL | 545 | 22 | $11m / $13.8m | `5f200a16-9185-4edb-99a8-cdba9e765e3d` |
| NRL | 337 | 13 | $6.5m / $8.2m | `5ff32114-d621-41ac-ae2b-f006b0401eba` |

The season is **2026 Practice**, an explicitly configured, editable, no-prize test season. All-Star counterparts exist but were not separately entered in this acceptance. Free Core eligibility is competition-scoped and creates no collectible inventory. Scores remain awaiting statistics; no fabricated game results were added. The reviewer wallet and owned inventory were not funded or modified. Existing normal starter entitlements are distinct from opened collectible cards.

Evidence: `docs/qa/launch-blockers-20261101/reviewer-hosted-readback.json` and `reviewer-{nfl,afl,nrl}-{entered,team}.png`. The readback was captured before the separate isolated Google billing test; it excludes the three authorised reviewer entries/drafts from its preservation comparison. Historical rules, other entries, cards, wallets and prize records matched the encrypted pre-configuration backup.

## Resolved access defects

1. The nominated address originally lacked beta outbound-email permission. It was added without changing existing recipients; normal verification delivery and user confirmation succeeded.
2. Ordinary beta admission did not create the existing sport/wallet access rows. Those registries were populated for the nominated reviewer without credits, cards or privilege grants. The legacy shared `nba_beta_access` table name does not activate NBA; customer visibility remains server-denied.
3. Free-Core player identifiers produced by PostgreSQL were valid GUIDs but failed a strict UUID-version check at the request boundary. GUID validation now agrees with the stored identifiers without weakening identity/eligibility validation.
4. First-time AFL/NRL members lacked NFL's permanent-team-name setup. The shared component now calls the existing `name_team` service before saving/entering, rather than bypassing the required member relationship.
5. Changing competition mode now retains the same practice season/round instead of selecting an unrelated historical test round.

## Console review instructions

1. Install the supplied Docked build. Sign in with the dedicated credentials saved in Play Console. Use normal account security. Do not use the owner's support account.
2. PLAY: choose NFL, AFL or NRL. Choose **2026 Practice**, Week 1 for NFL or Round 1 for AFL/NRL. Traditional uses the saved $4.4m / $13.8m / $8.2m cap; All-Star is uncapped. Each position picker offers eligible free Core players without requiring a purchase. Save draft, then explicitly enter/update. The team name is already **Docked Review** and cannot be renamed.
3. Rankings and View Team show the selected practice entry. Awaiting statistics is expected; these are no-prize practice competitions, not official completed league fixtures.
4. CARDS shows only recorded owned inventory. PACKS displays Standard/Premium 1/3/9 products, current odds, unopened entitlements and history. The v29 supplied candidate does **not** offer Google paid checkout. Do not promise access to a paid feature disabled in that build.
5. MARKET supports credit sales only. SOCIAL uses the current unified feed and moderation/reporting controls. PROFILE provides account settings, sport records, support and account-deletion requests. External deletion resource: https://docked.com.au/account-deletion.
6. This candidate is invitation-only, with non-redeemable test credits. NBA, real-money payments, withdrawals, prize awards and public registration remain disabled.

The enabled beta programme expires **2027-01-31 00:00 UTC**. An ongoing public-review access programme and public-mode instructions must be approved before that deadline or any changed release scope. Do not claim perpetual reviewer access. Reviewer gameplay above was verified in desktop Chrome; the separate Samsung acceptance used an isolated ordinary QA member, not the reviewer account.

## Separate Google licence-test evidence

Ordinary authenticated QA-member 4,900-credit acceptance is documented in `FINAL_GOOGLE_MEMBER_ACCEPTANCE_20261101.md`. Genuine 9,900-credit checkout, nine-card issuance, replay protection, refund and authenticated persistent notifications are documented in `FINAL_GOOGLE_RELEASE_READINESS_20261101.md`. They do not fund this reviewer account or approve commercial payment handling. Both Google options and temporary test admissions are inactive again. v29 / 1.28 is internally released with an empty native purchase allowlist and a payment-disabled backend.
