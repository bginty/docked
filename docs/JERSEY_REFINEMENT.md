# Numbered premium card refinement — local review, 15 October 2026

The owner reconfirmed the earlier premium Play mockup as the reference. This pass improves the shared original jersey illustration and repairs the actual number-import omission. Following the owner's subsequent “deploy” instruction, it is **released to the existing admitted beta** at https://docked.com.au/app.

## Deployment — 15 October 2026

- Web source `4e823789ae41bf03d835fe1abeb71948bcc2ddc0` (artwork/import fix `1c6a5335`, followed only by release-evidence routing).
- Vercel deployment `dpl_8fp6iXZZ9YtAx5QptNwsJ1bi5rg2`, READY and promoted to both existing custom domains. Eight protected-candidate checks and eight live checks passed. Exact deployed commit, database identity, anonymous denials, current assets and disabled redemption were checked; no fresh member login or hosted transaction is claimed.
- Existing `nfl-postgame` collector deployed as version 17, JWT verification retained plus dedicated worker-token authentication. Other functions and schedules unchanged. Supabase MCP access was unavailable; the existing authenticated CLI independently verified the exact target and completed deployment.
- **Live numbers pending fresh collection:** at 11:50 UTC the existing roster cache still had the old projection and 0 of 986 catalogue players had numbers. The 12-hour cooldown was retained, with next scheduled collection at 12:15 UTC / 11:15 pm Australia/Sydney on 15 October. Successful fresh projection import has not yet been observed. No numbers were fabricated or manually backfilled.
- Restricted runtime catalogue read passed in 532 ms under a five-second statement deadline. The optimized single-pass view remains in place. No migrations were needed.
- Raw secret scan still reports nine pre-existing findings; reviewed fixture hashes match the prior report, with no new finding paths. The untracked signed APK capability remains excluded from the committed web export and unused. This is not a raw scanner pass or confirmation of remote token revocation.
- Working and review branches pushed; no merge to main. Only committed application files were deployed. No member assets/teams/balances changed by QA, no messages/invitations, no real-money or document-collection activation.
- v22 retains its hosted-web configuration: fully close/reopen, or refresh the website. No new APK required. Physical S24 acceptance remains pending.

Release evidence: `qa/jersey-refinement/release/`. App rollback: `dpl_5vnGoyBCXpy6rLK5W1PjNfKQhU2V`. Collector version-16 source was downloaded before replacement to ignored `private-data/jersey-release/worker-rollback/supabase/functions/nfl-postgame`; redeploy that saved source only if required, retaining JWT/token controls. Leave the compatible optimized view and all retained source/ledger/history intact. Never restore member snapshots over subsequent activity.

## Visual changes

- Broader, rounded shoulder silhouette, deeper collar, separate sleeve lighting, soft chest highlights and curved side folds. Removed the earlier sharp triangular hem folds and fine grid treatment.
- Larger jersey area in lineup and collection cards; prominent live chest numbers with a contrast outline. Original team-colour mapping, generic trim and no official logos/marks.
- Shared `PlayerJersey` continues to serve Play, collection, selectors, details, marketplace and pack reveals. Existing rarity frames, live names, team labels, exact identities and all interactions remain intact.
- Original Docked branding is retained. This is an original SVG illustration rather than a copy of the mockup's realistic shirts or team logos. The mobile field remains readable and scrollable instead of squeezing seven cards into a desktop-sized screenshot.

Preview: http://127.0.0.1:3023/fantasy/play?scenario=entered and http://127.0.0.1:3023/fantasy/cards. These are clearly labelled, isolated synthetic fixtures, not real balances or holdings.

Screenshots: [Play phone](qa/jersey-refinement/final/play-412.png), [Play desktop](qa/jersey-refinement/final/play-1440.png), [Cards phone](qa/jersey-refinement/final/cards-412.png), [Cards desktop](qa/jersey-refinement/final/cards-1440.png), [six rarities](qa/jersey-refinement/final/six-rarities.png). Additional 360px and landscape captures are in the same folder.

## Missing-number cause and repair

The hosted roster projection returned null numbers for all five pictured players. The CSV importer's strict allowlist discarded `jersey_number` before storing roster evidence; the renderer therefore correctly showed no number. The [provider roster documentation](https://nflreadr.nflverse.com/reference/load_rosters.html) identifies that field.

The importer now retains that field as optional presentation metadata. Old files without it still parse; other unused fields remain excluded. Invalid, missing, conflicting or stale numbers remain blank under the existing verified projection. Legacy NFL `shirt=1` placeholders are never used.

A roster projection version prevents conditional HTTP 304 responses from perpetuating the older field-stripped record. The existing collector performs a normal full fetch on its next permitted attempt when it sees the old projection, appending a new retained revision. The 12-hour cooldown, source checks, retention, secure boundaries and scoring rules are unchanged. Existing retained observations are not rewritten. The worker bundle was rebuilt locally.

Read-only public-source verification through the corrected importer found current week-6 observations: Aaron Rodgers/PIT 8, Michael Burton/CLE 34, Ameer Abdullah/JAX 20, Davante Adams/LA 17 and Brandin Cooks/SF 84. These are provider observations, not hardcoded UI constants; the source URL, timestamp and hash are saved in `qa/jersey-refinement/provider.json`. No hosted records were changed during verification.

## Verification and release status

- 367 platform tests passed, including scoring/parser regressions and optional-number retention.
- Parser → database projection test passed, retaining freshness/conflict/privacy checks and the 1,001-player single-expansion regression from the loading fix.
- Six browser tests passed: phone/landscape/desktop card layouts, truthful known/unknown numbers, interaction/Escape, no horizontal overflow, reduced motion, reveal Next/Skip/replay/interruption and repeated taps. The final layout-only rerun passed after the last shading/collection-size refinement (1 test, four viewports plus all-rarity gallery). Its first attempt failed when Windows could not overwrite an existing screenshot; the retry wrote fresh paths. Both logs are retained.
- Typecheck, full lint and clean production build passed; synthetic secret canaries absent from 56 browser assets.
- The first preview restart hit an occupied port; the earlier local preview session was stopped and restarted. A one-off public-fetch `node -e` attempt hit TS module interoperability; the dedicated typed verification script succeeded. Neither attempt changed hosting.
- Physical S24 testing and visual approval remain pending. No authenticated hosted transaction was executed. No migration, grant, purchase, team edit, pack mutation, message or invitation was performed.

Changed areas: `player-jersey.tsx`, collection/lineup sizing in `play-cards.css`, CSV optional fields in `postgame-nflverse.ts`, roster projection/version in `nflverse-evidence.ts`, conditional fetch handling in `nflverse-bundle.ts`, rebuilt `nfl-postgame/worker.mjs`, focused tests and evidence helpers.

The web revision and collector have now been released through the established workflow. The collector must still import a fresh roster revision before real live cards can display numbers. Do not backfill numbers from the mockup or edit existing card identities. Keep the optimized database view from the sign-in recovery; no new schema migration is required here.
