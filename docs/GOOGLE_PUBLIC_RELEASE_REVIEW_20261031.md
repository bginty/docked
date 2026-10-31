# Google Play public release review — 31 October 2026

Continuation evidence after checkpoint 9a0f2d69 is in [the 1 November report](GOOGLE_LAUNCH_CONTINUATION_20261101.md). This earlier checkpoint remains a historical record; its local implementation/deployment status is superseded where explicitly updated there.

**Decision: NO-GO for public or paid activation. Internal v25 remains available.**
This is an evidence-based handover, not Google approval or legal clearance. NBA remains hidden. No public release, real purchase, public registration, prize award, withdrawal, customer mutation or new security permission was activated in this continuation.

## Delivered and verified

| Work | Implementation/test evidence | Deployment/activation |
| --- | --- | --- |
| Purchase confirmation odds | Shared pack confirmation expands its authoritative rarity probabilities before confirmation; quantity follows the selected product. All 18 NFL/AFL/NRL products exhaustively checked against all 10,000 allocation values for every slot. | Local; no changed prices, weights or supply. |
| Member receipt binding | New test-only orchestration derives account binding from verified server identity, limits requests, validates approved product allocation, and rechecks session/admission after provider I/O. Client cannot select member, amount, product, environment or refund. | Local dependency-injected service; **not a hosted customer billing endpoint**. |
| Google notifications | Signed JWT checks fixed Google keys, issuer, audience, verified service-account email and subscription. Bounded body, strict package, exactly one notification. Only hashed references enter the queue; notification data never awards credits directly. | Local; no public RTDN endpoint or subscription enabled. |
| Durable reconciliation | PostgreSQL queue, duplicate suppression, worker leases, provider re-verification, retry after outages/restart, and consumption after wallet commit. | Disposable local database only. |
| Shared wallet → packs → refund | Existing wallet, pack allocator, ownership and receipt services; all 18 products tested. Real PostgreSQL concurrency covers 20 duplicate notices, 12 workers, 16 purchase retries and 10 opening retries. | Isolated fixtures; no customer wallet or inventory used. |
| Deletion honesty | External deletion page and API response distinguish pending shared-beta identity erasure from completed deletion. Existing access revocation and erasure safeguards retained. | Local copy correction; not a claim that public deletion acceptance passed. |
| Play listing | Existing icon, feature graphic and descriptions retained; three genuine signed-in NFL/AFL/NRL mobile-sized browser screenshots uploaded and **saved as draft**. | Saved in Play Console; not published. |
| Legal preparation | New privacy and paid-pack/refund review drafts preserve existing accepted policy versions. | Draft files, not published or used for consent. |

No production migration was needed or applied. `sandbox/store-reconciliation.sql` is explicitly a **disposable local acceptance schema**, not an executable Production rollout instruction. The earlier isolated hosted acceptance migration is already applied and must not be duplicated.

## Android artifact and prior acceptance

- Package `docked.fantasy`, versionCode **25**, versionName **1.24**, min SDK 24, target SDK 36.
- Existing signed `artifacts/android/Docked-public-candidate.aab` was preserved, not rebuilt unnecessarily.
- SHA-256: `3656d9b88797f5bc9a8cbae1b29995717631b478cd7b31002228caaa900e0f85`.
- Google generated-APK readback succeeds for v25, reports 173 splits and a universal APK. Play signing SHA-256: `64:F8:4E:E6:33:3C:E0:FE:7A:E3:08:A3:81:B0:9B:BF:AA:C0:2A:E6:EA:5A:CD:47:68:91:9C:E0:BC:DD:28:F1`.
- Prior genuine Google-installed Samsung acceptance and three no-charge test purchases/refunds are documented in [hosted acceptance](HOSTED_GOOGLE_ACCEPTANCE_20261031.md). They used the isolated ledger, not customer funds.
- No phone was connected for this continuation. No new physical-device, emulator or app-upgrade acceptance is claimed. The only native unit-test source is the template arithmetic test; it is not meaningful billing acceptance and was not reported as such.
- Native artifact scan passed: no QA launcher/certificate, debug or cleartext capability; purchase allowlist remains empty. Existing native source was not changed.

## Payment architecture and commercial gates

Retain the owner-approved Google consumables: **A$49 → 4,900 credits** and **A$99 → 9,900 credits**, no bonus. Use Google’s current localised checkout price, verified purchase token, existing shared wallet and existing pack products. Direct pack SKUs would need additional approved AUD pricing and refund mappings; no parallel wallet or guessed prices were created.

Both purchase options are **INACTIVE**, verified through the Android Publisher API. The customer financial aggregate remains `financial-sandbox-only`; current member wallet admission rejects commercial activation. Test funds must not acquire monetary value through a feature-flag flip.

| Pack family | 1 card | 3 cards | 9 cards |
| --- | ---: | ---: | ---: |
| Standard | 100 credits | 300 credits | 700 credits |
| Premium | 700 credits | 1,900 credits | 5,000 credits |

The same six sizes exist for each visible sport. Configured per-card probabilities are Standard Rare 85%, Elite 12%, Ultra Rare 2.5%, Legendary 0.49%, Icon 0.01%; Premium Ultra Rare 90%, Legendary 9.9%, Icon 0.1%. These are read from `paidPackWeights`, not an added UI mapping. Core is excluded. Supply failure does not authorise substitution or oversupply. No odds or prices changed.

Proven isolated refund behaviour: pending/declined grants zero; unspent funds reverse once; spent funding opens recovery review and holds its remaining spendable balance; unrelated sale proceeds are not seized; issued/transferred cards, serials, pack history and a saved lock fixture are preserved. Duplicate/stale events cannot resurrect a revoked purchase. Unopened entitlements remain recorded. **This is not an approved commercial clawback or unopened-pack restriction policy.** No real competition entry was created in these tests.

Still required before a paid candidate can be called ready:

1. Approve the exact public economy, commercial card/data rights, marketplace transfer/redemption scope and spent-refund resolution policy.
2. Implement the approved public wallet/provenance transition without converting beta balances or inventory. The current shared runtime and SQL constraint intentionally support test funds only.
3. Wire customer-authenticated HTTP admission and transaction-time authorisation to the approved wallet mode. The new test orchestration does not substitute for that hosted boundary.
4. Host authenticated RTDN plus scheduled missed-event reconciliation with bounded batches, credentials, operational alerts and support recovery. The new queue is local-only; no hosted cron or voided-purchases pagination/backfill is claimed.
5. Run a genuine Google license-test purchase into an **isolated customer-mode** wallet through the rendered app, buy/open both families, refund and reconcile. Prior operator-ledger checkout and this continuation’s mocked provider/PostgreSQL tests do not prove that end-to-end customer route.

## Compliance matrix

| Feature/policy | Actual state and assessment | Required resolution |
| --- | --- | --- |
| Android digital goods | Play Billing bridge and receipt verification exist. No Android PayPal diversion enabled. Digital credits/packs must follow [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738). | Complete approved customer wallet route and store acceptance before activation. |
| Randomised packs | Accurate configured probabilities now expanded in final purchase review. Randomisation alone is not proof of gambling. Paid cards also affect fantasy scoring and can be resold in the test marketplace. | Assess the complete paid economy against [real-money games/contests policy](https://support.google.com/googleplay/android-developer/answer/9877032); do not declare legal clearance from the pack description. |
| Free gameplay | Private beta deliberately enforces owned cards. The master request requires unlimited free Core eligibility for public users. | Implement and test the public-mode eligibility path across all sports without turning eligibility into collectible ownership. Do not silently alter historical beta rules. This remains engineering work. |
| Marketplace | Credit-sales only, 5% capped fee; offers/swaps disabled. Tests preserve ownership and transaction history. | Approve public purchased-credit resale/transfer rules and refund provenance before activating commercial trading. |
| Withdrawals/prizes/paid entry | Disabled. Identity approval would not independently enable them. | Keep disabled. Any future activation requires separate legal/platform assessment and explicit approval. |
| Australian classification | Paid chance-based content can require at least M classification under [Australian classification changes](https://www.classification.gov.au/about-us/media-and-news/news/new-classifications-for-gambling-content-video-games). Owner’s proposed 18+ audience is not an IARC result. | Complete truthful IARC questionnaire for the final enabled economy. Do not guess rating or deny paid random content. |
| Australian consumer protections | No blanket no-refund promise added. [ACCC games guidance](https://www.accc.gov.au/consumers/advertising-and-promotions/online-and-mobile-games) informs clear price/random-content representations. | Approve purchase conditions, dispute handling and non-excludable remedies. |
| Australian gambling scope | [ACMA guidance](https://www.acma.gov.au/about-interactive-gambling-act) must be assessed against actual entry, reward, transfer and redemption mechanics. | Qualified review of the selected economic model; no automatic conclusion that all fantasy or random packs are either prohibited or cleared. |
| User data/deletion | In-app request, external page, revocation and queued erasure exist; shared beta Auth identity prevents automatic erasure. Database erasure/retention regressions pass. | Approve retention/processor disclosures and run isolated public-mode erasure. [Google account-deletion policy](https://support.google.com/googleplay/android-developer/answer/13327111) does not equate deactivation with deletion. |
| Privacy/retention | Draft describes accounts, social content, ownership/financial records, Google, disabled PayPal, consent analytics and service providers. | Confirm actual retention, processor locations, backup handling and publication approval; [OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information). |
| Social/UGC | Existing reporting, blocking, moderation and privacy controls preserved; broad regression passes. | Confirm staffed moderation and applicable safety declarations against final launch configuration. No reviewer-only concealed behaviour. |

## Console and declaration packet

At inspection, Dashboard showed 4/11 setup items complete: ads, government, health, category/contact. Privacy, sign-in access, rating, audience, Data Safety, financial declarations and listing finalisation were incomplete. Subsequent screenshot work was saved **as draft**, so this is not a claim that listing review is complete.

- Current Console description accurately says invitation-only, test credits, unavailable real payments/withdrawals/cash prizes, and postgame/as-available statistics. It contains no NBA. Preserve until public scope is actually ready.
- Icon and feature graphic already existed; three screenshots now saved (NFL Play, AFL collection, NRL packs). 417×741 captures satisfy the Console’s accepted 9:16 asset input; they are not the 1080-pixel promotional recommendation. They are real browser views, not fabricated phone screenshots or new Android acceptance.
- Production track remains inactive. No public rollout, agreement or certification submitted.
- Australian distribution must be rechecked on the final Production track; Australian product pricing is not evidence that country distribution is configured.
- App access still needs a dedicated ordinary reviewer identity with authorised credentials and a workable MFA/review procedure. Do not put the owner’s password in Console or create an authentication bypass. This requires owner-controlled credential/security setup; no reviewer credentials were manufactured.
- Target audience is gated by app access in Console. Proposed 18+ Australian scope is recorded, not a submitted rating.
- Privacy/deletion URLs: `https://docked.com.au/privacy` and `https://docked.com.au/account-deletion`. Existing beta text does not certify the proposed paid release. Publish approved versions first.

Prepare Data Safety using the actual final build, not a blanket “no data collected” answer:

| Data category to evaluate | Actual processing to declare/check | Optionality/purpose |
| --- | --- | --- |
| Email/user IDs/profile name | Supabase identity, profile, support and shared account | Required account/security; optional public profile fields separately |
| Purchase history | Store references, products, wallet, pack and marketplace history | Fulfilment, fraud, support; no full Google payment-card number received |
| User content/photos | Social text, comments, uploaded images, card snapshots | Optional community use; audience/visibility controls |
| App activity | Consent-gated first-party events; gameplay and transaction operations | Optional behavioural analytics distinct from required operation/security |
| Diagnostics/device/network IDs | Host logs, IP/request information and Google/Android diagnostics | Verify precise active provider collection, retention and purposes |
| Identity documents | Real ID collection disabled in this release | Do not declare enabled KYC collection or advertise document submission |

Processor sharing exceptions, encryption, deletion and collection optionality must follow the actual contracts and Google’s form definitions. No uncertain answer has been certified. Public paid-listing wording is drafted separately below, conditional on implementation/approval:

> Collect NFL, AFL and NRL cards, build fantasy teams and connect with the Docked community. Play with free Core eligibility and choose optional Standard or Premium packs. Packs contain random digital cards; review card count, eligible rarities and chances before confirming. Where enabled, buy Docked Credits securely through Google Play and use your shared Docked account. Follow round rankings and postgame statistics as available. Purchases do not guarantee performance or profit. Support: support@docked.com.au.

Do not publish this paragraph until free Core access and paid purchasing actually work. Add accurate age, marketplace, credit and reward restrictions from the approved launch model; do not imply cash redemption.

## Executed checks and limits

- Final `npm test`: **686 passed, zero failed/skipped**.
- `npm run db:test`: **223 passed, zero failed/skipped**. Includes migration/RLS, signup policy versions, revocation, social erasure and durable ownership/audit preservation.
- New targeted suites: 22 lifecycle, 3 exhaustive disclosure, 5 notification and 6 member-boundary tests; included in final platform total.
- `node scripts/fantasy-production-local-postgres.mjs --store-pack-lifecycle`: **4 integration checks passed**, actual disposable PostgreSQL, mocked Google, zero customer connections/charges.
- Final lint and typecheck: exit 0. Production web build: exit 0, 54 pages. No new Android source/build required.
- Static browser bundle scan: 99 assets, zero known-secret/pattern findings. Native packaged scan passed. These are scoped scans, not a penetration-test certification.
- Dependency audit: zero runtime vulnerabilities; **13 moderate development-tree findings** inherited through glob/minimatch and lint/Capacitor tools. The suggested automatic fixes downgrade major tools; not applied blindly. Review supported patched dependency upgrades before the next native tooling release. No high/critical findings.
- Local rendered AFL Premium confirmation tested at 390px and desktop: expanded odds, explicit 5,000-credit confirmation, nine-card opening, completed reveal and fresh same-product repeat confirmation. The second purchase was not confirmed. Only synthetic fixture credits/cards used.
- NFL Standard 3 and NRL Premium 1 rendered confirmations also verified at an actual 390px viewport (document width 390, no horizontal overflow), with expanded authoritative odds and correct 300/700-credit totals. Both cancelled without purchasing. Desktop NFL confirmation also checked.
- Genuine authenticated Production browser checks: NFL Week 7 **105.81**, **6/7**, rank **1 of 2**; AFL collection **24** cards (**20 Ultra Rare, 4 Legendary**); NRL packs and all six products load. Read-only, no purchases, openings, team edits or posts. NBA absent.
- Customer aggregate remains revision **226**, hash **5f6b1926b820cb90f68d9a6a01ab5d5e**, matching pre-test baseline. Production release remains `673a751b2ec755836ef31dfb9b967786861c7b99` / `dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9`.

## Submission/rollback sequence for review

1. Resolve commercial, rights, retention/refund and reviewer-account decisions. Approve new policy versions; do not overwrite accepted historical versions.
2. Finish the explicitly identified customer public-mode wallet/Core/deletion integrations and hosted acceptance. Keep public/financial switches closed throughout.
3. Review additive migration, backup receipt and rollback with actual deployment IDs. Never apply the disposable local schema to Production. A financial rollback must preserve/reconcile accepted orders, not restore an old wallet snapshot.
4. Deploy a verified web candidate and repeat signed-in Android acceptance. Rebuild/increment AAB only if native code/config changes; v25 is the existing internal artifact, not evidence of an enabled paid public release.
5. Finalise matching Data Safety, content rating, audience, access and Australian distribution. Verify all Console warnings and use one consistent customer/reviewer configuration.
6. Present the exact AAB hash, web commit, policies, products, enabled features and staged-rollout proposal for owner final approval. Submit/activate only after that approval.
7. If a paid incident occurs, stop new purchasing server-side and halt rollout; keep verification/reconciliation available for already accepted orders. Preserve audit, ownership and wallet evidence. Do not “roll back” by deleting transactions or resetting balances.

## Exact owner involvement

- Select/approve the public paid-credit, marketplace, prize and withdrawal scope after legal/platform review; confirm commercial player/card/data rights.
- Approve spent-refund recovery, unopened refunded-pack handling, retention and privacy terms.
- Provide/create the dedicated reviewer account credentials and authorised security access through the normal owner-controlled process. No admin privilege required.
- Supply any required classification/legal certification; complete legal agreements personally.
- After remaining engineering and hosted tests, approve the exact public submission and real-payment activation. **That final approval is not being requested yet: the release is not ready.**

Evidence: [PostgreSQL](qa/public-launch-final/store-pack-postgres.json), [asset scan](qa/public-launch-final/browser-asset-security.json), [saved Console draft](qa/public-launch-final/play-listing-screenshots-saved.jpg), [privacy draft](policies/2026-10-31-public-review/privacy.md), [refund draft](policies/2026-10-31-public-review/paid-packs-and-refunds.md).
