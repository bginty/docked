# Pack opening — visual review milestone

The friends release is already live on docked.com.au, with connected Android v17. Its accepted opening flow remains unchanged. The first eligibility-only friend invitation was authorised and submitted once (Graph 202); no account, consent or cards were created on the friend's behalf. Inbox delivery and friend acceptance are not claimed.

## Implementation

The new viewer is **Preview only**, requiring the server-side `DOCKED_PACK_REVEAL_PREVIEW=true` flag and Vercel Preview environment (or explicit local development). Production ignores the flag. `/preview/pack-opening` is an explicitly labelled design sample, behind existing Vercel protection when hosted. The sample has no award, purchase, collection or scoring side effects. Authenticated Cards uses actual server-confirmed receipts. Paid packs remain disabled.

- Original CSS metallic navy pack, opening seal, restrained blue light and rising/rotating case. No 3D dependency, external artwork, grading scores, video overlays or near-miss effects.
- Existing Docked compact wordmark and existing `FantasyCardArtwork` (extracted unchanged from the collection). Tier colours/rules remain unchanged. Illustrative design samples are CORE only; they are not catalogue entries or real scarcity claims.
- Tap/swipe opening, keyboard opening, pointer/arrow-key tilt, Escape tilt reset, native Back-compatible dialog, reduced motion, Simple view, optional muted-by-default short audio, and existing opt-in native haptics.
- Individual reveals, Skip animation, Reveal all, original-result replay, collection summary, View card and Build team. Effects load only when the viewer opens. CSS fallback and error boundary preserve access if effects are unavailable.

## Integrity and privacy

`open_nfl_starter` remains the existing server transaction. No allocation, rarity, supply, ownership, team, trading or scoring rule changed. The UI starts the reveal only after a confirmed receipt. Lost responses, retries and reopening use the same immutable allocation. Skipping/replaying never sends another award command.

The additive `beta_fantasy.my_nfl_pack_receipt()` read derives the ordered original cards from `sports_feed.nfl_allocations`. It requires existing admission and active-session checks, accepts no user/pack selector, grants execution only to the narrow beta runtime, and exposes no current owner's identifier. A later card swap cannot replace an original pack result. Current player/team information is labelled separately from edition team where different; this is not a new historical player-stat snapshot.

Only presentation progress (the bounded index) is stored on-device, keyed by member, receipt and exact ordered card IDs. Award data always comes from the server. Another device or cleared storage can replay from the beginning without new awards. Local storage failure does not affect ownership. The original result remains retrievable after interruption. Generic older packs whose transferred-card details are unavailable show an honest message instead of re-opening to obtain different cards.

## Verification boundaries

Local database tests use disposable PGlite with the exact migrations: sealed-pack read has no award, two ten-card allocations are idempotent, results isolate users, direct/anonymous access is denied, and original receipt survives a later transfer. These also retain FLEX, ownership, supply and permissions regressions.

Browser fixtures simulate a committed award whose response is lost, retry/double tap, interruption while waiting, refresh/resume, individual/all reveals, single-card summary, replay, keyboard, reduced motion and muted default. Browser sample identities are explicitly isolated; they are not evidence of a real friend opening a pack.

Hosted migration evidence is `docs/qa/pack-opening/hosted-receipt.json`. It adds the read-only function to the exact Docked beta project and checks runtime/direct API permissions and anonymous rejection. No hosted account or holdings are modified by that migration.

Fresh browser screenshots are under `docs/qa/pack-opening/`. Deployment and hosted UI evidence are recorded alongside them. Physical Samsung S24 performance, sound/haptics, owner visual approval and friend acceptance remain pending.

## Release boundary and rollback

The current production deployment/domain and v17 are preserved. Do not distribute an updated APK or enable this experience in the friends website until the owner approves its visual Preview. After approval, perform a separate versioned website/APK release with the same signing/package identity and ordinary-member admission controls.

Preview rollback: keep/remove its Preview flag or revert the Preview deployment. The new receipt function can remain unused; no destructive database rollback is necessary. Collector schedules and the existing 23:20 Sydney follow-up are unchanged. No new service or cost.

## Executed results

- 24 targeted platform/customer-database tests plus the NFL allocation/receipt database scenario passed.
- Seven local browser journeys passed at 360, 412 and 1366 px; no dialog accessibility violations. Typecheck/lint and production-format build passed. Client bundle scan: 51 files, zero findings.
- First hosted protected Preview passed starter, single-card, resume, anonymous API denial, 412/1366 px accessibility and page-error checks. Live friends commit remained fe2bacd4, and the design route was unavailable on production. Final deployment evidence below supersedes the initial Preview URL.
- Supabase advisor: private default-deny table notices and the existing leaked-password-protection warning; no Auth policy changed.
