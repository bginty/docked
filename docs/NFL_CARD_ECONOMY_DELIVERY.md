# NFL card economy v21 delivery — 12 October 2026

## Released scope

Web code `b3d178a8529e94ed08afd95fa65c9a674f98c029`, deployment `dpl_HewS9iMnD3dLNRZLA9sypP236jDJ`, is bound to https://docked.com.au after the owner's specific friends-beta promotion approval. Review at https://docked.com.au/fantasy/test-wallet using an existing admitted test-wallet account. Ordinary member login and owner MFA are unchanged. Anonymous and unadmitted requests remain denied. No messages or invitations were sent.

The nine-card economy is isolated, nonwithdrawable and uses test credits. Real payments, deposit/bonus activation, prizes and withdrawals remain disabled. No new subscriptions or additional cost. Existing owner/Barry records and completed grants were preserved; no human grant was repeated.

Implemented: six canonical rarities; Ultra Rare presentation/filtering; permanent per-player supply and immutable serials; roster-backed eligibility; atomic Standard/Premium nine-card purchases; Core exclusion; Icon eligibility in both; receipt recovery; nine-card reveal/replay; owner supply/configuration/failure reporting. Existing single-card receipts and entitlements retain their terms. The new tables do not consume commercial allocations.

**Incomplete integration:** the opt-in rarity scoring engine, negative-point rounding and immutable lock/correction logic are tested, but new test-wallet inventory is not connected to member-round entry. No weighted member competition was opened. Current free competitions retain their original equal-scoring rules. This delivery is not evidence of completed weighted member gameplay. K cards are collectible; the approved seven-player formation has no kicker slot/scoring. No AFL gameplay was added.

## Evidence actually executed

| Check | Result |
|---|---|
| TypeScript and ESLint | PASS |
| Platform suite | 304/304 PASS |
| Database/security suite | 150/150 PASS |
| Native PostgreSQL final-Icon contention | Eight connections, one winner; seven no-charge/no-partial failures |
| Responsive nine-card browser checks | 4/4 PASS: 360, 412, 1366 widths plus reduced-motion/keyboard/duplicate taps |
| Existing starter/single reveal and cinematic checks | Previously executed in this milestone; PASS |
| Staged hosted wallet acceptance | PASS; `qa/android-v21/wallet-candidate.json` |
| Domain wallet acceptance | PASS; `qa/android-v21/wallet-domain.json` |
| Domain/callback/privacy/admission boundary | 15 checks PASS; `qa/friends-cutover/domain-boundary.json` |
| Production web builds | Local build PASS; exact deployed Vercel build READY |
| Production dependency audit | Zero reported vulnerabilities |
| Physical Samsung / owner visual approval | PENDING; not performed on owner's behalf |
| Emulator | Not run for this release |
| Genuine rarity-weighted member round | NOT IMPLEMENTED/OBSERVED |

One platform attempt encountered eight Windows sandbox temporary-directory permission failures. Running unchanged tests with appropriate filesystem access passed all 304; no assertion was weakened. Hosted acceptance initially selected an old receipt by list order and the recording helper assumed fresh local reveal progress. Helpers now select the exact receipt and resume persisted state. The failed capture receipt is retained in `qa/android-v21/wallet-domain-capture-retry.json`. Successful purchase/recovery checks from that attempt are explicitly distinguished from the later no-purchase recording/replay pass. All QA purchases used the existing synthetic account's test balance. No real holdings were used.

Sampler observations cover 100,000 draws per test product and are recorded in `qa/economy-v2/postgres.json`. They are a smoke observation, not proof of statistical fairness. Configured per-draw odds differ from at-least-one-in-nine odds; exhaustion can affect accepted-pack distributions. The full policy is in [NFL_CARD_ECONOMY_V2](NFL_CARD_ECONOMY_V2.md).

## Android and visual review

The v21 build targets https://docked.com.au with package `au.com.docked.app.preview`, the existing signing identity, and no hosting bypass. Build/signature/credential/download receipts are in `qa/android-v21`; only actual PASS receipts establish delivery. Download URLs are issued for seven days and kept out of Git. Install the APK over Docked Beta and choose **Update**; do not uninstall or clear app data.

Recording: `qa/android-v21/Docked-v21-nine-card-reveal.webm` shows a replay of an actual saved nine-card test receipt, not another issuance. Screenshots in the same directory show mobile/desktop and the nine-card summary. The separate `qa/economy-v2` preview images use labelled synthetic design fixtures.

Owner checklist: open Test wallet; review disclosed pool/chances; open or replay nine cards; close/reopen at card 2; Reveal all; inspect collection/filter/serial; check Android Back, scrolling, tilt and reduced motion. Confirm the normal free team remains unchanged. This is a visual/device checklist, not a request to enable commercial activity.

## Decisions not blocking the test release

| Topic | Implemented TEST choice | Commercial decision still required |
|---|---|---|
| Prices | Standard 900; Premium 1,800 nonwithdrawable test credits | Approve prices and credit economics separately |
| Rarity weights (Rare/Elite/Ultra Rare/Legendary/Icon) | Standard 85/12/2.5/0.49/0.01%; Premium 60/30/8.5/1.49/0.01% per draw | Approve disclosed distributions after supply/economic review |
| Guarantees | None; Icon eligible in both | Recommend no implied Premium guarantee; explicitly configure any future guarantee |
| Duplicate policy | No duplicate player within each pack | Recommend keeping this for initial usability |
| Deposit bonuses | Existing A$49/A$99 implementation preserved but inactive | Mapping to new packs, frequency and economics unresolved; no automatic conversion |

Player/data/artwork permission for future commercial card sales is not established by this free-beta release. New-provider aliases and old season-linked editions require audited identity reconciliation before any commercial migration. Historical owned cards were not renamed, renumbered or deleted.

## Migration / rollback

Applied additive migration: `20261012101915_lifetime_card_economy.sql`; preparation/activation receipts are in `qa/economy-v2`. Preimage remains private. No production supply/history was retired. For a defect, first run `node --import tsx scripts/apply-card-economy.ts --pause` to stop new purchases while preserving all records.

Previous deployment: `dpl_FCT6gGG2ZSou1YKh3K1UKiEhb2AR` (v20). Exact bindings are recorded in `qa/android-v21/rollback.json`. Before reverting to v20, snapshot test-wallet access rows and disable that access in an audited transaction: old code cannot render new economy cards. Keep free gameplay/account access unchanged. Then promote the recorded previous deployment through the existing project. Do not restore an earlier wallet JSON, drop tables, decrement issued counts or recycle serials. A compatible forward fix is preferable. No DNS/email records or collector schedules were changed.
