# Member integrity cleanup — 21 October 2026

## Findings and changes

- **Paid packs:** all six products were enabled at the approved prices. Official roster observations were last checked on 17 October and exceeded the existing 72-hour safety limit. The scheduled roster collector refreshed nflverse data but did not refresh the separate official evidence used by pack eligibility. The existing collector now refreshes previously verified identities from official team pages, appending evidence. Failed/incomplete pages retain previous evidence; ambiguous players/transfers remain excluded. No freshness threshold, odds, supply or price was relaxed. Product loading, roster freshness, supply, insufficient balance and recoverable errors now have distinct presentation.
- **Scoring:** ingestion is running. Source revisions 39/40/41 contained weekly statistics, plays and rosters respectively. Travis Hunter's Week 6 HOU/JAX source row uses CB while the frozen competition mapping uses WR. Verified pre-completion WR/CB evidence now permits that exact same GSIS/player/team mapping. His verified four receptions, 59 receiving yards and one touchdown calculate to **13.90 under the frozen half-PPR rules**; newer full-PPR rules are not substituted. Separately, SEA/DEN includes an anonymous all-zero row without player identity. That malformed source remains blocked pending source correction/reconciliation; it is not a confirmed DNP and cannot justify finalisation. Existing final-score/correction and prize-idempotency controls are preserved.
- **Freshness:** round state, postgame/provisional/final scoring and last successful source sync are separately labelled. Upcoming rounds say games have not started. Existing timezone formatting is reused; postponed/cancelled statuses remain explicit.
- **Owner access:** Profile previously sent all staff to the owner-only operations route, while its broad catch returned 404 for authorization, MFA and service failures. Owners now receive the owner destination; other staff receive their authorized dashboard. Access failures have typed recovery states; server roles and MFA remain enforced.
- **Social:** compact Latest/Following/Announcements navigation; chronological Latest, compact official pin, visible composer, existing card/image upload path and moderation controls. Legacy conversation entry points go to and focus the composer after startup. Repeated submit taps remain guarded. Canonical card artwork and shared shell remain intact.
- **Attachments:** Ferguson post `40c8acb4-b343-4308-a856-4f119c8963eb` contains an NFL post with a stored football Arlo Vale snapshot. No reliable correct Ferguson card ID was found. Cross-sport/player conflicts now render unavailable, without substituting an unrelated card. Valid historical snapshots remain independent of later ownership and do not reveal a current owner's private collection.
- **Announcements:** existing draft/review/approve/publish/pin/archive workflow and audit trail reused. Original publication and subsequent published edits have separate timestamps; unpublished edits do not change member content.
- **QA isolation:** explicit provenance registry for posts/accounts, never a name-based filter. Registered internal QA accounts cannot enter public competitions. Legacy marketplace inventory without a canonical economy card is excluded and cannot be newly listed/purchased; transaction history remains untouched.

## Scoped QA remediation

Only the following three posts are eligible for registry insertion, with exact ID, author and body assertions. Nothing is deleted and their author account is not quarantined. Source provenance: `scripts/owner-gameplay-hosted-db.mjs` explicitly creates fictional acceptance activity.

| Post | Author profile | Exact provenance |
|---|---|---|
| `38c37b04-0f15-42d2-9173-e258d3a3de2e` | `31515b05-6274-442e-a9c9-7095c9f3d218` | `Won OWNER QA — simulated acceptance in Fantasy Cards.` |
| `120b76f7-a2f4-4168-96bd-d0dc620d7857` | same | `OWNER QA — isolated fantasy gameplay acceptance. Fictional cards and simulated results only.` |
| `83db141a-3397-4c29-9d6f-e2a604577143` | same | same exact fictional acceptance text |

Legitimate beta users and posts merely containing “test” are retained. Historical mismatches without reliable source IDs are not rewritten.

## Coupon contract

One code per purchase, no stacking or credit issuance. Normalize uppercase, 3–32 ASCII letters/digits/hyphens. Whole-credit percentage savings round half up, then cap by configured maximum and product price. Minimum charge is one credit unless zero-charge is explicitly permitted. First purchase counts successful paid-pack entitlements, including legacy and zero-charge coupon purchases; free weekly/reward packs and failed attempts are excluded. Draft creation never activates an offer. Edits create a new draft revision; activation requires review. No live campaign is seeded.

The server computes every quote and rechecks it inside the existing advisory lock and locked aggregate transaction. Coupon use, actual wallet debit, journal, entitlement and immutable pricing snapshot commit together. Replays use the existing request ID. Changed offer terms require a new review. Completed purchase terms/fees are not rewritten. There is no new refund endpoint; coupon usage remains consumed unless a separately approved refund workflow explicitly restores it, and any refund must use actual paid credits.

## Verification

- Full database suite: 190 passed. Targeted changed scoring/coupon/eligibility/privacy checks: 30 passed. Announcement publication/MFA/audit projection test passed with the new timestamp function.
- Platform suite: 524 passed, one outdated return-path expectation failed; that test was updated to the explicit authorized staff destinations, including traversal rejection, and passed on rerun.
- Typecheck, lint, client-secret-boundary and optimized Next build passed.
- Browser at 360, 412 and 1440 CSS pixels: composer focus, post double-tap guard, coupon application, purchase review, one pack/one redemption after double-tap, admin coupon UI and no horizontal overflow. See `browser.json` and PNGs. These use isolated adapters and synthetic identities, not customer mutations.
- Real PostgreSQL contention results are recorded separately in `coupon-contention.json` when complete. Existing marketplace settlement, reservation, fee and replay tests remain in the database/platform suites. No real listing, purchase, account-setting change or notification was performed for testing.

## Deployment and operations

Additive migrations: `20261021104437_member_community_pack_integrity.sql` and `20261021104951_official_roster_refresh.sql`. The existing Node scoring collector receives the worker changes; the checked-in Edge bundle is updated for parity. Existing cron cadence and credentials are reused. No campaign activation or production settings change is required. Existing service role grants remain constrained; the roster worker can refresh only known identities, not mint cards.

Preserved: Standard 9/3/1 at 700/300/100, Premium 9/3/1 at 5,000/1,900/700; approved pools; four-Core weekly packs; Traditional 5/3/1 Standard 9-Pack prizes and All-Star 5/3/1 Premium 9-Pack prizes; season prizes TBA; seller commission 5%, half up, maximum 2,000, no minimum. Deposits, withdrawals, KYC, redemption eligibility and push systems are unchanged.

Remaining operational limitations: malformed SEA/DEN source row; any official team fetch that fails remains excluded until a successful retry; historical Ferguson attachment cannot be repaired reliably. Authenticated hosted member/admin journeys must be distinguished from isolated browser tests. Security advisor reports existing private tables intentionally denying direct access and a pre-existing leaked-password-protection configuration warning; no authentication setting was changed.
