# Wallet completion and premium fantasy review — 15 October 2026

Implemented locally on `pivot/fantasy-cards-preview-v1`, continuing from `e72dd10a`. The prior uncommitted redemption implementation is retained and included in this review. Production, hosted databases, existing members and financial activation were not changed. No real document, EFT, grant, pack purchase, post, invitation or message was created.

## Review links and visual evidence

- [Play preview](http://127.0.0.1:3023/fantasy/play), [Cards preview](http://127.0.0.1:3023/fantasy/cards), [six-rarity gallery](http://127.0.0.1:3023/preview/rarity-frames).
- [Wallet/customer/staff preview](http://127.0.0.1:3024/qa). These clearly labelled preview identities and values are synthetic, non-persistent fixtures; use synthetic bank inputs only.
- [Play desktop](qa/premium-completion/play-1440.png), [Play phone](qa/premium-completion/play-412.png), [phone landscape](qa/premium-completion/play-entered-850x412.png).
- [Cards desktop](qa/premium-completion/cards-1440.png), [Cards phone](qa/premium-completion/cards-412.png), [enlarged text](qa/premium-completion/cards-enlarged.png).
- [Customer desktop](qa/redemption/customer-desktop.png), [customer phone](qa/redemption/customer-mobile.png), [staff desktop](qa/redemption/admin-desktop.png), [staff phone](qa/redemption/admin-mobile.png).

Start the previews with `node --import tsx scripts/marketplace-local.ts --serve --visual --premium-v3` and `node --import tsx scripts/redemption-local.ts`. They do not load hosted credentials or real accounts. Browser fixtures are not evidence of genuine NFL results or physical-device use.

## Wallet review and fixes

The existing ledger, funding lots, reservation buckets, advisory lock, append-only journals and request identity are reused. Exact integer-cent conversion, eligible-source reservations, encrypted destination snapshots, staff claims, cancellation, exceptions and compensating returns were reviewed and tested. Legacy test credits never acquire cash eligibility. Marketplace FIFO spending is unchanged and cannot spend reserved credits. No bank transfer integration exists.

The original report did not establish actual Supabase authentication. This pass adds a separate loopback-only Docker stack using the existing pinned Supabase Postgres/Auth/Kong images, no pulls or outbound email, and a dedicated `docked_redemption_local_auth` database. It runs the real Next routes with the restricted `docked_beta_app` role, real password sessions and real TOTP MFA. The existing application admission and session checks remain active.

Two corrections followed from that integration:

1. A development beta runtime selected raw Auth tables instead of the existing admitted-user/session views. The relation selector now uses those restricted views for beta runtimes regardless of the development/production label. No raw Auth grants were added.
2. Redemption admission is rechecked under the wallet transaction lock, consistent with marketplace spending.

The synthetic seed initially used the domain sandbox policy rather than the admitted-test policy required by existing RLS. The test setup was corrected; RLS was not weakened. Re-running the retained fixture now uses the supported identity revocation/re-verification workflow instead of attempting to resubmit an already approved identity. These were test-setup failures and are not hidden as passing attempts.

Identity-only, review and payment permissions remain distinct. Current identity/restrictions and recent credential authentication gate sensitive payment actions. Refresh alone does not reset recent-auth age. Destination changes preserve earlier snapshots; ambiguous payment outcomes retain reservations. Customer projections omit internal notes and full bank data. Real uploads have no enabled endpoint: the manual evidence adapter accepts synthetic references only.

## Visual redesign and reference comparison

The existing shell, lineup builder, collection, card identity and rarity configuration are extended. The desktop has a fixed navy sidebar, electric-blue primary controls, the original Docked logo and restrained panels. The NFL field uses an original lightweight SVG with dark turf, mowing texture, perspective sidelines, yard markings, lighting and vignette. It is scoped to the NFL seven-slot field; existing EPL layouts remain sport-specific.

One `PlayerJersey` illustration now supplies collection, lineup, selector, detail, marketplace and reveal surfaces through their existing card renderers. It adds original shoulder/collar shapes, trim, fabric lines, folds and shading. No logos, sponsors, manufacturer marks or names are printed on jerseys. Verified numbers are live SVG text. Unknown numbers remain blank; legacy placeholder `shirt=1` is never treated as NFL evidence.

The read-only jersey projection uses the same retained roster observation as the catalogue, matches canonical player/team/name and requires the existing 72-hour freshness window. Missing, invalid, conflicting or stale facts produce no number. It grants access only to the narrow projection, not raw provider payloads. Current presentation metadata does not rewrite editions, ownership, locked scoring snapshots or saved pack outcomes. Synthetic preview numbers are explicitly fixture values, not claims about real NFL players.

All six frame treatments remain shared: silver Core, royal blue Rare, purple double-line Elite, cyan corners Ultra Rare, gold Legendary and pearl/prismatic Icon with crown. Position is top-left; rarity top-right. Applied lineup multipliers remain driven by competition data. Legacy equal-scoring contexts retain 1.0×. Frames have restrained static illumination, raised shadows and reduced-motion-safe interaction. No continuous grid animation was added.

Compared with the reference, the composition and material hierarchy are retained while the authentic Docked logo, original illustrated jerseys, exact rules and accessible live data replace illustrative mockup details. Long names and real controls can make the complete field scroll on shorter desktop viewports. Phone layouts deliberately use readable two-card rows rather than shrinking the desktop. The full-page screenshots include fixed navigation at its viewport position; navigation is not duplicated in the actual page.

## Verification and provenance

| Evidence | Result / scope |
| --- | --- |
| `platform.txt` | 366 platform tests passed in one run. |
| `focused-final.txt` | 48 final wallet/auth/card regression tests passed. |
| `database-serial.txt` | 153 database tests passed in one uninterrupted serial run. |
| `database-final.txt` | 154/154 database tests passed in one uninterrupted final serial run, including the new jersey projection. |
| `jersey-database.txt` | Missing/conflicting/stale/wrong-team number facts and raw-access isolation passed. Embedded PostgreSQL-compatible test, not HTTP/Auth acceptance. |
| `authenticated.json` | Five actual local Next HTTP → Supabase Auth/MFA → restricted-role PostgreSQL groups passed. Password/admission/role gates, identity approval, leading-zero bank snapshot, exact reservation/retry, private history, staff claim/reveal/synthetic sent/return, revoked-session denial, account switching, and refresh after genuine JWT expiry. |
| `docs/qa/redemption/postgres.json` | Nine separate-connection PostgreSQL/HTTP groups passed: concurrent reservations, claims/cancellation, duplicate settlement/return, rollback injection, spending race, journal reconciliation and notice dedupe. Its HTTP session adapter is a fixture, separately labelled from genuine Auth. |
| `docs/qa/redemption/browser.json` | Five customer/staff browser groups passed with fixture sessions and in-memory state: invalid input retention, review/confirm, response-loss recovery, privacy/account switching, keyboard/focus, enlarged text and reduced motion. |
| `browser-verified.txt` | 18 browser tests passed: lineup states in both modes, filtering/counts, phone/landscape/tablet/desktop, all rarities/palettes/long names, accessibility, legacy multiplier context, reveal animations/Skip/rapid taps/replay/interruptions. |
| `browser-layout-final.txt` | Five final Play/Cards browser tests passed after the last mobile spacing adjustment; screenshots refreshed at 360, 412, 820, 1366 and 1440 pixels plus phone landscape. |
| Typecheck / lint | Passed; full source/test lint with zero warnings. |
| Clean build / client boundary | Passed using synthetic canaries, including bank-key canary; none in 57 browser assets. No real environment file loaded. |
| `export-tests.txt` | Three source-export/release-tool regression tests passed. |

The prior database process crash (Windows exit `3221225477`, access-violation code) is preserved in the original handover. It was not a failed test assertion. The full serial rerun is now clean; the exact original native-process cause remains unconfirmed. Separately passing retries are not relabelled as the original full-suite result.

Initial visual runs caught an obsolete no-number assertion, one Windows screenshot write error, and an actual Icon badge contrast problem caused by flex shrink after SVG sizing changed. The assertion was updated to the new requirement; evidence moved to a task-specific path; shared SVG dimensions and badge sizing were fixed. Initial failure logs remain beside the later passing run. No physical S24 or native Android emulator acceptance is claimed; browser viewport/reduced-motion/keyboard evidence is separate.

## Secret review

The unchanged raw scanner still reports **nine findings**, not a clean pass. Eight are reviewed synthetic credentials or generated local-infrastructure connection templates. Fresh hashes and reasons are in `qa/premium-completion/secret-review.json`; no broad exclusion or scanner suppression was added.

The ninth is the untouched, untracked signed APK download capability. Its encoded expiry is **18 October 2026 10:44:54 UTC**, so it is not expired at this review. It was never used, printed, committed or put in screenshots. No token match was found in inspected tracked source, public assets, new reports or built client assets, and no tracked Git history exists for the file. Remote validity and external sharing are unverified. If the owner knows it was shared unintentionally, revoke only that download link through its issuing service; no evidence currently requires unrelated credential rotation.

## Migrations, rollback and Preview gate

- `20261015055109_manual_credit_redemption.sql`: additive staff permission/RLS table and immutable financial snapshot/classification guards, local-activation-only boundary. No historical balance changes.
- `20261015080107_verified_jersey_presentation.sql`: narrow read-only retained-roster projection, no asset/history writes. Apply before the new application revision wherever that revision is later approved.

Both are tested locally only. Roll back application presentation first if needed. Drop the jersey view only after its readers are removed. Disable redemption rather than restoring an old aggregate over transactions. Preserve journals, pending reservations, request history and the vault key; resolve funds only through audited lifecycle transitions. Do not delete financial history to roll back.

The existing source-export workflow is retained and now includes all tracked policy manifests required by current imports. This prepares source only; it cannot apply migrations or deploy.

Read-only Vercel inspection found the configured `docked-preview` project (`prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`) has no SSO/password/IP deployment protection. The separate historical credential-free review project `docked-production` (`prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`) has SSO protection, but is a different deployment profile/branch. Neither existing environment was changed. No push that could trigger an unreviewed deployment was performed.

**Preview deployment is blocked on exact owner-approved target/protection and environment binding, not on enabling redemption.** Approve the intended protected Preview project/branch, enable/verify deployment protection there, and approve the isolated Preview Auth/database binding plus these migrations if authenticated Preview acceptance is required. Do not point this candidate at Production or transplant local QA rows. Real redemption remains hard-disabled on hosted runtimes even after an application deployment.

## Activation readiness — all remain closed

- Approve genuinely redeemable issuance, backing, source/proceeds/fee/refund/dispute classification. Historical test and promotional balances remain non-cash.
- Approve identity and account-name/joint-account policies, review/re-verification authority and any earlier verification requirements.
- Configure and verify encrypted private document storage, authorised short-lived access, validation/quarantine/malware scanning, audit, privacy notice, retention and deletion. Until then, no real documents.
- Provision environment-specific bank-key custody, rotation and recovery; never use the deterministic fixture key.
- Approve redemption limits/fees, segregation of duties, claim/reconciliation/returns evidence and manual banking procedures.
- Approve Sydney business calendars, coverage, cutoff and dispatch target; no invented legal turnaround guarantee.
- Obtain applicable Australian legal/regulatory and operational decisions from responsible owners/advisers. This implementation is not a compliance conclusion or permission to cash out gameplay credits.
- Conduct a separately approved activation release and operational acceptance. No actual payments or real redeemable issuance are authorised by this work.

## S24 owner checklist

Use the isolated local previews or a separately approved QA Preview, not existing competition assets.

1. Open Play in portrait and landscape; switch Salary Cap/Open, inspect a player, replace an unlocked fixture and confirm the other draft stays independent.
2. Check long names, empty slots, all rarity badges and verified numbers; unknown numbers must remain blank. Compare fantasy salary with test wallet credits.
3. Open Cards/details; search/filter, enlarge text, scroll, use Back and return focus. Check that bottom navigation does not prevent reaching controls.
4. Run a saved fixture pack reveal: Next repeatedly, Skip, close/reopen, background/reopen, reduced motion. The awarded result must stay identical.
5. In synthetic Withdrawals, try invalid amounts, review/confirm, interrupt/recover, then switch fixture accounts; previous history must disappear.
6. Staff fixture: review, claim, reveal synthetic destination, record only simulated outcomes. Never enter real identity evidence or bank details.

Readiness: local product/code review and protected-Preview preparation; **not deployed and not financially activated**. Existing installed v22 and the live beta are unchanged by this task.
