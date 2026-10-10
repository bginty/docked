# Friends release and owner operations — acceptance

10 October 2026 · branch `pivot/fantasy-cards-preview-v1` · implementation `6b735cfb`.

**Delivery boundary: protected owner Preview; NOT friends-beta activation.** The owner authorises docked.com.au once ready. Required real-player data/rights and existing privacy/support facts remain unverified, so the working public holding page remains intact. Nobody was invited or emailed; no real charge, payout, new subscription or data reset occurred.

Owner login/MFA manual acceptance is preserved. No password/factor reset or setup was repeated. This is not blanket acceptance of gameplay, visual design or S24 behaviour.

## Delivered application and APK

- [Protected owner Preview](https://docked-production-r4171qdhn-briant-s-projects.vercel.app/app), deployment `dpl_2TVVnzgb2Je3Vjjs8u5WoMfsiAdL`, committed application `6b735cfb3cae14d3bfa067d7fd0976cff761e5f8`. **34/34 hosted HTTP/security/accessibility checks passed**, including owner-report JSON/CSV anonymous denial. No production/custom-domain aliases.
- Owner dashboard: [open report](https://docked-production-r4171qdhn-briant-s-projects.vercel.app/admin/operations). Existing owner login + MFA required. Select Beta/test for existing isolated records.
- Android **v15 / 1.14-preview**, package `au.com.docked.app.preview`; `artifacts/android/Docked-v15-Owner-Connected-QA.apk`, 11,036,122 bytes. SHA-256 `e91b7d6cf43d2364df77a3f34ebb7bebe7d79506b11999f31ec67888cb6e70da`.
- Private download verified end-to-end, expires **17 October 2026, 23:05:43 Australia/Sydney**. Signed bearer URL is in the private delivery receipt and owner handover, never committed to public Git. No email sent.
- APK build, 988-entry archive audit and complete known-secret scan pass. Same v14 signing certificate verified: `38d427f45d24542f23e798b5692321044e68c8c929f7bd23773ac0872dedb66b`.
- Emulator install from v14 to v15 using `adb install -r` passed, with no uninstall/data clear. Android activity launch returned success, but **emulator UI acceptance is blocked** by Pixel Launcher and System UI ANRs. The read-only emulator was stopped without saving changes. No logged-in emulator gameplay, session restoration, keyboard or offline/reconnect acceptance is claimed. Physical S24 remains pending.
- The public holding page returned HTTPS200 with its unchanged baseline hash. Friends cannot join yet; no domain cutover was performed.

Installation: open the private download on the S24, allow this browser to install the APK if prompted, and choose **Update** over the existing Docked QA app. Do not uninstall or clear app data. If Android refuses the update, retain the installed app and report the exact message. Re-enable the browser's normal install restriction afterwards. Open Docked and use the existing owner login/MFA; Preview hosting protection still applies.

## Implemented

- Owner dashboard from Profile, owner/AAL2 checks at page/API/SQL boundaries, Sydney ranges, sport filters, live/test separation and staff exclusion. Source-backed members, activity, competition/deadline/rank/rules, inventory integrity, moderation/outbox information and safe CSV. Read-only; no arbitrary mint/balance/payout controls.
- Isolated prize register and transaction journal: final-complete/approved-schedule gate, idempotent awards, tie holds, immutable fulfilment evidence, correction review, cash-per-currency and unvalued noncash totals. No prize scheme activated. UI shows unconfigured state until a real source exists.
- Ten lifetime tester roster with concurrency cap and suspension; ordinary AAL1 gameplay, staff MFA unchanged. Separate free card-for-card path for admitted friends; paid/practice-balance controls unavailable in that mode. Activation remains off.
- Dark Create Post inputs, focus and disabled states; compact shared scoring tables and player breakdown headings. AFL **v2 kick2/handball1/goal6**, existing mark3/tackle4/behind1/hitout1/free-for1/free-against−3 retained as research/beta values. Existing locked v1 competitions unchanged. EPL/NFL tables derive from their existing versioned rule configuration.
- Stable-identity/current-club real catalogue validation and audited replacement proposal. No invented real roster and no renaming owned fictional cards.
- Premium A$49 / Elite A$99 single-card offer definitions, guaranteed advertised tier, disabled checkout. Premium tier mapping and paid selection model unresolved. Synthetic named-card fixtures are not a commercial selection decision.
- Server-side sandbox purchase/reservation/payment/fulfilment, PayPal sandbox adapter, bank awaiting/review states, signed identity-event validation and eligible-fund reservation. No raw identity documents, card numbers, active live wallets or withdrawals.

## Executed acceptance

| Area                                | Result / evidence boundary                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform                            | **PASS 225/225** full suite; **PASS 13/13** targeted rerun after payment/prize review changes                                                                                                                                                                                  |
| Database/RLS                        | **PASS 147/147** regression tests                                                                                                                                                                                                                                              |
| Real PostgreSQL                     | **PASS** isolated two-person and ten-slot roster, ordinary MFA exemption, owner denial checks, concurrent swaps, ownership rollback, immutable journal and exact source totals                                                                                                 |
| Commerce/prizes PostgreSQL          | **PASS** 20-way reservation/payment/fulfilment/withdrawal/award tests, injected journal failure rollback, direct-role denial                                                                                                                                                   |
| Hosted database                     | **PASS** three exact additive migrations applied to Docked beta only; owner AAL2 report, AAL1/untrusted-role denial, counts reconcile; all prior records unchanged                                                                                                             |
| Browser                             | **PASS 14** responsive fixture cases: five tabs, retries, MFA form, three-sport scoring, dashboard/composer at mobile/desktop sizes; axe and page-error checks. Dashboard fixes rerun at 360/412/1366px                                                                        |
| Typecheck/lint/web build            | **PASS** executed on release sources                                                                                                                                                                                                                                           |
| Dependencies                        | **PASS** production and full audit: zero reported advisories                                                                                                                                                                                                                   |
| Secrets                             | Known-value scan of source/config/browser assets **PASS**, no findings. Heuristic repository scan flags seven existing test/template files; reviewed as synthetic literals/runtime interpolation, not leaked credentials. Raw heuristic output is not reported as a clean scan |
| Legacy retirement                   | Occurrence inventory regenerated with reasons; zero unclassified occurrences. Historical consent/migrations/tests remain; retired routes remain tombstones                                                                                                                     |
| Actual PayPal/identity/bank service | **NOT EXECUTED / NOT CONFIGURED**. Contract mocks and local database tests are not external integration evidence                                                                                                                                                               |
| Live scoring/real players           | **BLOCKED** — no licensed catalogue or authorised scoring feed configured                                                                                                                                                                                                      |
| Two real hosted friends             | **NOT RUN** — external admission deliberately remains closed; local synthetic users only                                                                                                                                                                                       |
| Owner visual / physical S24         | **PENDING OWNER REVIEW**                                                                                                                                                                                                                                                       |

The initial platform run had eight Windows sandbox filesystem permission failures; the full host-permission rerun passed. Browser QA found keyboard-inaccessible table scrolling and duplicate region labels; both were repaired and verified. A new swap SQL ambiguity was found and repaired before hosted application. Capture-level duplicate notifications and correction-after-fulfilment totals were tightened during review.

## Visual evidence

All shown gameplay figures in these browser fixtures are explicitly synthetic, not hosted account activity.

- [Owner dashboard, mobile](qa/friends-release/screens/dashboard-412.png) · [desktop](qa/friends-release/screens/dashboard-1366.png)
- [Create Post](qa/friends-release/screens/composer-412.png) · [AFL v2 table](qa/friends-release/screens/scoring-412.png) · [disabled pack offers](qa/friends-release/screens/packs-412.png)
- [Play](qa/fantasy-ux/regression/play-412.png) · [Cards](qa/fantasy-ux/regression/cards-412.png) · [Market](qa/fantasy-ux/regression/market-412.png) · [Social](qa/fantasy-ux/regression/social-412.png) · [Profile](qa/fantasy-ux/regression/profile-412.png)
- [Card detail](qa/fantasy-ux/regression/card-detail-412.png) · [team recovery](qa/fantasy-ux/regression/team-error-412.png)

## Owner review

1. Update over the installed QA APK; do not uninstall/clear storage. Confirm app returns to Play using the existing login; owner MFA still applies, never a factor-ID field.
2. Inspect five tabs, sport selection, team field/card sheets, keyboard, Back and scrolling above system navigation. No rarity scoring multiplier or paid lineup action.
3. Open Profile → Owner dashboard. Select Beta/test, vary dates/sport/staff, horizontally scroll tables, inspect CSV and confirm unconfigured sections are honest.
4. Post a non-sensitive test update; background/reopen, disconnect/reconnect and confirm recovery without duplicates. No invitation or real payment required.
5. Review screenshots and report actual S24 defects. Visual approval and physical acceptance are not inferred from browser results.

## External decisions / next milestone

See [exact decisions and draft wording](FRIENDS_POLICY_DECISIONS.md), [providers, costs, fixture dates and unset live deadlines](FRIENDS_EXTERNAL_SERVICES.md), and [dashboard definitions](OWNER_OPERATIONS.md).

Next: resolve the existing privacy/support facts and approve a rights-checked real-player/data source; import an isolated auditable beta catalogue, prove valid eligible starter teams, then run hosted two-user admission/social/free-trade and real-statistics acceptance before the authorised domain cutover. Paid products remain a separate merchant/rights/selection/tax/refund decision. KYC/payout and prizes remain disabled. No new subscription is required merely to inspect the delivered owner dashboard.

## Recovery

Checkpoint `checkpoint/friends-beta-20261010-9ff398fc`; prior working Preview `https://docked-production-ezmr1ib55-briant-s-projects.vercel.app` (`dpl_7AAAEpWhDwbBf3dBdzVFRByWhUAU`, app commit `971fd0cc`). Retain immutable deployments and previous APKs. Roll back by using the prior Preview or deploying that committed source to a new protected Preview. Do not drop beta schemas or reverse ownership history. Additive friends controls remain disabled, so old application code is compatible. If Android rollback is necessary, rebuild the prior source with a **higher** version code and unchanged signature instead of uninstalling or attempting an unsupported downgrade. Production DNS, holding page and authentication policies were not modified.
