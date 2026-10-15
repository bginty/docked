# Social, collections and pack experience — local review

16 October 2026. Continues from `e8389023`. This implements the latest master-platform brief locally; it does not supersede its prohibition on Production changes or activate trading on hosting.

## Review

- Authenticated local preview: http://127.0.0.1:3033/fantasy/social. The open Edge window uses an isolated local QA identity. Closing that window stops this temporary preview. No real tester credentials are included.
- Restart: `node --import tsx scripts/marketplace-auth-local.ts --social-only --social-upgrade --browser-only --keep-preview` with the existing local Docker/GoTrue infrastructure running. This runs local QA mutations before opening the preview.
- Synthetic component preview: http://127.0.0.1:3023/fantasy/play?scenario=entered. This is not authenticated database acceptance.
- [Desktop Social](qa/social-upgrade/social-1440.png), [mobile Social](qa/social-upgrade/social-412.png), [mobile feed cards](qa/social-upgrade/social-cards-412.png).
- [Desktop collection](qa/social-upgrade/collection-cards-1440.png), [mobile collection](qa/social-upgrade/collection-cards-412.png), [mobile profile](qa/social-upgrade/collection-412.png).
- [Communities](qa/social-upgrade/communities-1440.png), [local offers](qa/social-upgrade/offers-412.png), [desktop packs](qa/social-upgrade/packs-1440.png), [mobile packs](qa/social-upgrade/packs-412.png).
- [Automatic reveal](qa/social-upgrade/automatic-reveal-mobile.png), [purchase recovery, consecutive reveals and replay/Skip recording](qa/social-upgrade/automatic-pack-recovery.webm).

Screenshots use clearly labelled isolated local identities/cards. Unknown metadata remains unavailable. The newly referenced Social mockup and recording were not present in this attachment; fidelity to those unavailable references is not claimed.

## Implemented

| Area | Result |
| --- | --- |
| Social home | Premium navy hero, inline composer, chronological/For You/Following feeds, real member discovery, communities and own activity. Existing pagination, reactions, replies, reports, blocking and secure image moderation retained. Unsupported Market/Competition feed tabs are not presented as working. |
| Card posts | Up to four owned cards, server ownership validation, exact card/serial snapshots. Existing premium artwork and verified-number metadata reused. Snapshots remain unchanged after transfer and idempotent retries. |
| Profiles | Dark responsive Collection / Teams / Activity / About structure; compact existing relationship/moderation controls. Teams remain private unless a separate public-team policy is implemented. Activity pagination retains its tab. |
| Collections | Existing collections default private. Owners explicitly select admitted members/followers/private separately from offers. Search, sport, team, position, rarity, offer filter, sorting and pagination. Per-card and bulk offer settings; minima private, asking price optional. |
| Private offers | Local-only create/review/accept/decline/cancel/history, expiry and lost-response operation recovery. Existing ownership, market transfer guards, wallet, commission, receipts and locks reused. No new wallet. |
| Discussions | Actual catalogue player links from collection details; contextual posts, comments, replies, likes, follow discussion and reports. Unknown player IDs rejected. Existing NFL/EPL records only; no new sport activation. |
| Communities | Actual directory/counts, rules, join/leave, member feeds and owner/admin MFA creation/editing/closure. Existing moderation applies; no public community creation. |
| Notifications | Existing private in-app notification infrastructure extended for offers, followed discussions and community activity. Offer notices use existing bounded/deduplicated delivery and preference checks. External email/push not activated. |
| Packs | Compact store, retained purchase history/details, actual entitlement ID, automatic reveal after confirmed/recovered purchase. Explicit replay restarts the retained result. Skip shows the awarded cards; no new charge or award. Standard/Premium probabilities and supply unchanged. |
| Dialog stability | Stable modal lifecycle avoids closing/reopening on each parent render. Focus restoration/Escape preserved. First reveal uses actual motion preference rather than stale initial state. |

## Offer accounting and activation

Proposals do not hold credits for seven days. Creation verifies current funds; acceptance rechecks spendable funds, ownership version, permissions, policy, admission and competition restrictions under the existing global economy transaction lock. Acceptance and an ordinary purchase cannot both spend the same balance or transfer the same card. No spending-order policy changed.

The existing database guard requires a listing to be OPEN before SOLD. Offer acceptance writes its private OPEN intermediate state and final SOLD state in **one transaction**; an outside connection cannot observe the intermediate listing. Failure rolls back all state, ledger, ownership, operation identity and revision/history. Final audit history retains the existing list and purchase events. Private sale listings are excluded from nonparticipant marketplace queries.

Existing commission: 100 credits → 8 fee / 92 proceeds; 1,000 → 75 / 925. Defaults: three new offers per rolling 24 hours, one active buyer/card offer, seven-day expiry, 24-hour decline cooldown, maximum 21 outstanding. These are centrally defined local policy values, not client parameters. Funds are not guaranteed until acceptance succeeds; the review explains this.

Live settlement is deliberately blocked: `DOCKED_PRIVATE_OFFERS_LOCAL=true` additionally requires a loopback database, non-production runtime and no Vercel environment. Hosting cannot enable it by simply copying the local flag. A separate approved beta trading/financial policy and reviewed activation change are required. Existing read-only trading pause blocks offer creation/acceptance while preserving cancellation/decline.

## Evidence and limitations

Results are kept in separate files; embedded tests and synthetic transport are not described as authenticated database end-to-end tests.

| Verification | Evidence |
| --- | --- |
| Full platform/domain regressions | [373/373 passed](qa/social-upgrade/platform-approved.txt). An earlier restricted run failed three temporary-Git fixture operations; the permitted full rerun passed uninterrupted. |
| Focused final platform regressions | [23/23 passed](qa/social-upgrade/focused-final.txt): offers, social, transactions and packs. |
| Focused embedded PostgreSQL | [30/30 passed](qa/social-upgrade/database.txt), including 17 social cases. This uses PGlite, not separate production-like connections. |
| Full embedded PostgreSQL | [158/158 passed uninterrupted](qa/social-upgrade/database-final.txt). Initial 154/158 exposed four outdated helper-count assertions; tests now enumerate reviewed helpers, fixed search paths and exact browser/runtime permissions rather than accepting an arbitrary count. |
| Actual local GoTrue → HTTP → PostgreSQL | [Authenticated acceptance](qa/social-upgrade/authenticated-initial.json): owned posts, privacy, immutable snapshots after transfer, exact commission/ownership/balances, duplicate acceptance and TWO DISTINCT buyers racing; exactly one settlement. |
| Additional actual auth and browser checks | [Final acceptance](qa/social-upgrade/browser.json): real owner MFA, ordinary/unadmitted denial, canonical discussions, closed communities, posting/feed recovery; Edge at 1440×960, 412×815, 815×412, no overflow, focus/Escape/reduced motion, five desktop axe checks without serious/critical findings. |
| Separate-connection PostgreSQL fault injection | [Rollback evidence](qa/social-upgrade/postgres-rollback.json): injected failure restores journal, ownership, balances, offers, operation identity and revisions; intermediate state invisible. Direct store test, not HTTP. |
| Purchase/reveal recovery | [Pack flow](qa/social-upgrade/pack-flow.json): actual React components/domain engine with synthetic identity/in-memory HTTP. Lost response and reload recover the same purchase/entitlement; nine reveals and replay/Skip do not issue or charge again. |
| Existing reveal/card browser regressions | [7/7 passed](qa/social-upgrade/reveal-browser-final.txt). Synthetic fixtures. Earlier tests used removed “Card 1”, “Reveal all” and “Skip animation” controls; updated to current accessible controls. Recovery wait allows the existing five-second compositor fallback to finish. |
| Typecheck / lint / clean production build / client boundary | [Typecheck](qa/social-upgrade/typecheck.txt), [lint](qa/social-upgrade/lint.txt), [build](qa/social-upgrade/build.txt), [canaries absent from 58 client assets](qa/social-upgrade/client-boundary.txt). Build uses isolated test configuration. |

Test-discovered fixes also included restricted-runtime claim lookup (no new Auth-schema grants), correct OPEN→SOLD transaction sequencing, dark mobile profile styling/contrast, retained Activity pagination, per-card settings after ownership changes, and explicit replay resuming from card one instead of the completed summary. An initial security-helper retest included unrelated pre-existing beta helpers; its scope was corrected to retain the full private-schema allowlist and separately verify this change's beta helpers. A later full database retry hit an overly narrow expected error in the new unauthenticated-helper assertion (the helper correctly denied access); the un-restored test role then caused nine cascading failures. The corrected runtime suite passed 13/13 before the full rerun. Failed reports remain available; no interrupted or failed run is represented as passed.

No physical S24, Samsung Internet or Android WebView acceptance was performed. No hosted transactional tests were performed. Tests use local QA data only; owner/Barry/Luke assets, teams and balances were not used. No real member posts, external messages or invitations were sent.

## Security review

The [raw scan](qa/social-upgrade/secret-scan-raw.json) remains **FAIL: nine findings**. [Reviewed classification](qa/social-upgrade/secret-review.json) records eight unchanged synthetic/generated fixture matches with file hashes, plus one unchanged untracked signed APK-download capability. No scanner suppression or exclusions were added; no new finding paths. An additional exact-value/encoded-value scan of the 96 staged implementation/evidence files found no local QA credentials ([evidence](qa/social-upgrade/staged-credential-check.json)).

The capability was not used or committed. Previously recorded expiry is 18 October 2026 at 10:44:54 UTC, so it is not described as expired at this review. No tracked exposure was found; sharing outside Git is unknown. If unintentionally shared, the owner must revoke that specific APK-download link using its existing issuer controls; do not rotate unrelated credentials. Its presence is not a blocker to isolated local development, but is not a clean secret-scan pass.

## Migrations and rollback

Applied only to disposable local PostgreSQL:

1. `20261015131955_premium_social_collections.sql`: additive collection settings, communities, memberships, discussion follows, retained post snapshots/context, private indexes/RLS and narrowly scoped helpers.
2. `20261015140207_premium_social_runtime_guards.sql`: restricted-runtime claim reader and canonical verified-jersey projection. No Auth-schema access granted to runtime.

No hosted database, deployment, DNS or production environment changed. No cards/credits minted for existing members; no wallet/history backfill. Existing collections remain private by default. No real-money redemption, bank payment, ID collection, public signup or external messaging activation.

For any later deployment, apply reviewed migrations in order only after target/backup/approval checks. Pause new offers before rollback. Retain additive data and immutable transaction/history records; do not down-migrate by deleting completed offers or receipts. Any rollback after private settlements must preserve the `privateOffer` visibility filter and current ledger compatibility—an old application lacking that filter is not a safe blind rollback. Prefer forward correction with trading paused.

## Changed-file groups

- Shared UI: `social-home`, `social-hub`, `social-discovery`, `private-card-offers`, `relative-social-time`, `social-hub.css`; existing composer/timeline/profile and pack/wallet/modal components extended.
- Authority: existing community API/service, `social-hub`, `social-card-projection`, `private-card-offers`, existing credits store/marketplace projections.
- Data: two additive migrations above; no existing migration rewritten.
- Verification: `social-upgrade-*` scripts, `social-pack-flow`, existing local auth/build/visual harnesses, private-offer platform tests, social/security database checks, reveal regression updates.

## Remaining intentional boundaries

- Private messaging is not introduced: no existing complete DM service; abuse-reporting, retention and operations must be approved/completed before activation.
- No invented public team, competition achievement, follower count or Market feed. Existing permitted content and manual card sharing remain available.
- EPL discussion can reference existing records; EPL competition availability is unchanged.
- Latest missing Social reference/recording and physical Android testing remain owner-review items. No claim of exact reference matching or native-device performance.
- Local offer infrastructure is reviewable, not authorised live trading. No push/deployment performed by this task.

## S24 acceptance checklist

Use designated isolated QA accounts/assets, not existing competition cards. Hosted QA fixture creation requires separate approval.

1. Sign in; open Social, Following and Discover. Post only in the approved QA environment; attach an owned card and verify refresh retains one post.
2. Check portrait/landscape, feed scrolling, collection filters, long names, card details, Back/Escape-equivalent and bottom-navigation clearance.
3. With two QA users, verify private/followers/member collection visibility and that blocking removes access. Inspect minima without exposing them to the other account.
4. In the local authorised offer fixture only, review/cancel/accept an offer; retry after a dropped response and confirm one receipt/settlement.
5. Confirm one test pack purchase, automatic reveal, repeated rarity animations, rapid Next taps, Skip, close/reopen and saved replay. Verify the same cards and no extra debit.
6. Test reduced motion, enlarged text and network interruption. Confirm owner MFA and ordinary-member denial of community management.
