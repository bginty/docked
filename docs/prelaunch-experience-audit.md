# Pre-launch customer experience and moderation review

Reviewed 16 October 2026. Changes are local; no hosted member activity, reward activation, inventory mutations or deployment was performed in this workstream.

## Confirmed defects and changes

| Priority | Evidence | Implemented correction |
| --- | --- | --- |
| High | A production SocialComposer inside FantasySheet lost both the attachment picker and its parent on Escape. React propagates the synthetic `cancel` event through nested components although the native dialog event does not bubble. | Stop cancel propagation in the shared FantasySheet. The child closes, its lease releases, and the parent retains its own scroll lock until it closes. Repeated cancellation, synthetic native Back, popstate and unmount tests verify restoration. |
| High | Moderation reports offered profile-only actions such as Suspend on post targets; the authoritative server rejects them. | One shared target/action projection now drives both the UI and unchanged server validation. Dismiss remains the safe default. No permission or decision policy changed. |
| Medium | AdminReadPanel retained previously displayed records if its endpoint changed and the next read failed. It used an unbounded request with no retry action. | Clear records on endpoint/attempt changes, abort abandoned reads, use the existing bounded request utility, and expose Retry records. Access errors cannot leave stale records presented as current. |
| Medium | Moderation submit had only a render-delayed disabled button and required a manual reload after success. | Synchronous in-flight ref guard, read-only guard, status reset and authoritative router refresh after success. Server checks remain authoritative. |
| Medium | Full-shell desktop browser inspection found light generic panels with white text and a light banner with white text in moderation. | Shared dark-shell panels/banner/muted text now use readable existing navy/blue-grey colours on desktop as well as mobile. Public light surfaces remain unaffected. |
| Medium | Weekly Core detail/reveal explicitly hid verified jersey numbers, while the same card's collection face showed them. | Remove the two pack-specific suppression exceptions; all contexts use canonical verified-number projection. Unknown numbers remain absent. Pack contents and IDs are unchanged. |
| Low | Product copy and metadata duplicated the earlier tagline. | Centralise current `Collect. Compete. Connect.` live text through brand-tokens.json and existing fantasyTagline export. Supplied image/logo bytes remain unchanged. |

The newly reproduced nested-cancel issue is confirmed evidence, not a claim that it uniquely explains every earlier physical Samsung scrolling report. Existing reference-counted modal leases were already present and their out-of-order cleanup test still passes.

## Browser evidence

All browser work uses actual production React components, actual styles and isolated synthetic local HTTP fixtures. This verifies rendering, interaction and request/retry behaviour, not real member authentication or database policy enforcement.

- `docs/qa/futuristic-cards/browser-1792151829916/results.json`: same card across collection, detail, Market, Social, member collection, reveal and lineup at 1440, 1024, 412 and 360px; six rarities, known/unknown numbers, long names, aspect ratio, no controls inside faces, focus, reduced motion, normal forward reveal and replay without POST requests. All passed.
- `docs/qa/weekly-core/browser-1792151843358/results.json`: Profile ready/countdown, header balance request sharing, opening, replay, lost-response recovery, privacy and responsive checks at the same four widths. All passed; zero serious/critical accessibility findings.
- `scripts/prelaunch-experience-browser.ts`: nested composer/attachment Escape, Cancel, popstate, synthetic Android cancel and navigation/unmount; failure/lost-response retry retains idempotency key; synthetic touch scrolling after closure; admin access failure clears stale data, retry, repeated submit and read-only controls. Four widths and Axe checks. Latest run directory is recorded in `docs/qa/prelaunch/experience-latest.json`.

Screenshots were visually inspected for portrait composition, six rarity materials, card labels and moderation dark surfaces. The card frame follows the supplied futuristic reference, with lightweight illustrated SVG jerseys rather than photorealistic raster shirts. The supplied mockup's logos, missing-location placeholder and sample account data were not adopted.

## Checks and unsuccessful attempts

- Eight focused platform tests passed: canonical card projection, all rarities, verified metadata, modal leases, weekly policy, private account summary and target-specific moderation actions.
- Typecheck and scoped lint passed after the main changes; the coordinating release reruns full checks on the integrated tree.
- First card browser launches inside the Windows sandbox failed browser IPC. Isolated local-only runs outside the sandbox passed.
- New fixture first failed to compile due a missing JSX closing fragment; corrected before browser testing.
- Initial nested-cancel assertion failed before the shared modal correction, providing reproduction evidence.
- Initial full-shell fixture touch coordinates landed on the fixed desktop sidebar; corrected to the content centre.
- Initial full-shell fixture omitted the root `fantasy-mode` class. Correcting fixture fidelity exposed the genuine remaining light-panel contrast defect; the production CSS correction then passed all four widths.
- These are separate attempts, not an uninterrupted clean first run.

## Moderation queue follow-up

The staff panel now includes loaded-queue totals, intersecting status/content-type/search controls, concise report cards and expandable reviews. Reviews show the reporter's existing social name/handle, current reported text or media description, current status and the latest 20 immutable target decision events (reviewer display name, decision, reason and timestamp). Counts explicitly cover the bounded load (100 reports/50 media) and do not pretend to be global totals. No priority/assignment taxonomy or new authority role was invented.

The read is called only by `communityModeration()` after `requireRole([owner, admin, editor, auditor])`, whose existing implementation requires a verified current identity and AAL2. The ordinary `/api/community` GET does not import or expose this read. Database tests verify the actual query against migrated tables and direct anonymous/member access denial. It uses the existing beta schema SQL mapping and makes no database schema change.

**Confirmed evidence-retention gap:** the existing Remove operation blanks `social_posts.body` / `social_comments.body`; post removal deletes its `social_post_media` associations. Rejecting media nulls `social_media.content`. `social_moderation_events` preserves reviewer, target, decision, reason and date but not the original content. Reports contain member-authored details, not immutable evidence snapshots. The new UI explicitly labels current content and unavailable/removed evidence. The workflow has not been changed to retain more personal data: an approved evidence/appeal retention and deletion policy is still required before introducing immutable evidence storage. Existing account erasure and removal semantics remain unchanged.

Follow-up checks: 22/22 scoped database/platform tests passed (20 actual migrated-schema social database tests plus 2 moderation UI/filter/gate tests). Expanded four-width browser coverage includes filters, reporter search, current content, decision history and target-compatible actions.

## Remaining acceptance boundaries (continued)

- Physical Samsung S24, Samsung Internet, keyboard/OS Back and actual Android WebView acceptance remain pending. Synthetic Chromium touch/viewport checks are not physical acceptance.
- Fresh authenticated avatar upload/crop/replace/remove/persistence checks could not run: localhost Auth port 55321 and app3033 were unavailable; Docker daemon inspection timed out. Existing secure image-processing and approved-owned-avatar checks were inspected but are not claimed as newly verified end-to-end. Reuse `marketplace-auth-infra.mjs` / `marketplace-auth-local.ts --social-only --social-visual --social-upgrade` when the isolated Docker service is available.
- `/fantasy/admin` exists through the `[tab]` route; it is not a missing route. Server role/MFA policies still determine admission.
- No weekly reward, financial, trading, public registration or provider activation flag was changed.
