> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# NFL live-beta checkpoint — 9 October 2026

Continued from `ec652779` on `pivot/fantasy-cards-preview-v1`. The owner's supplied NFL requirements supersede the earlier missing-prompt blocker. Email and live-beta work are preserved.

**Local community integration passes; NFL is not yet launch-ready.** Production has no connected current-season NFL fixture/result feed. No hosted NFL acceptance, new APK or deployment is claimed.

## Existing work reused

NFL interests, sport page/icon, composer tags, social permissions/comments/likes/follows, provider-scoped fixture discovery, request reservations and source-rights/provenance controls already existed. Score inspection explicitly returns `settlementReady: false`. Existing official pricing, verified community edges and settlement only accept football/NBA contracts; those allowlists remain intact.

The inactive NFL offensive-stat scorer and lineup matcher remain available. No NFL player feed, card inventory or approved lineup/scoring rules exist end-to-end. No starter-pack composition or fantasy supply was changed.

## Changes

- Added all 32 current franchises as text-only identities, grouped by conference/division. No logos or player imagery imported. NFL page links to conversations, fixture coverage and a prefilled NFL social composer.
- Added NFL to visible Edges/Feed filters. My Edge now shows the signed-in member's own posts with server-side sport/author filtering and cursor pagination. Normal server pagination avoids the general timeline's author-unscoped refresh path.
- Applied sport/competition constraints before fixture SQL pagination. Settled records use the same filters; unfiltered recognition widgets are omitted when a sport/competition is selected. Unsupported NFL services are explicitly labelled.
- Live-beta desktop/mobile navigation is Edges / Feed / Following / Points / My Edge. Fantasy cards/rewards remain accessible through utilities/sidebar. Original Fantasy Preview navigation remains unchanged.
- Added migration `20261008145441_nfl_community_catalogue.sql`: NFL sport/competition identities remain disabled for pricing. Existing provider mappings are preserved; a conflicting sport identity aborts. No region/feed/publication/settlement/inventory authority is granted. **Applied to the exact dedicated production project in the subsequent beta-results checkpoint; disabled catalogue confirmed.**
- NFL parsing rejects unknown/ambiguous franchises, incomplete finals, finals preceding kickoff, future observations and unreviewed lifecycle fields. Ties remain factual observations, never inferred winners or voids.

## Actual verification

| Check | Result |
| --- | --- |
| Platform regression | PASS — 430 tests, including four new NFL scenarios |
| Full isolated database suite | PASS — 207 PGlite tests |
| Final social/migration subset | PASS — 13 tests, including additional mapping preservation/collision coverage |
| Real local PostgreSQL 17.10 | PASS — eight existing concurrency/scarcity/ownership/seventh-claim/permissions scenarios; all migrations loaded |
| NFL Chromium component acceptance | PASS — 320/412/1366 pixels; filters, composer payload, 32 teams, beta versus Preview navigation, directory accessibility/overflow |
| TypeScript / changed-file ESLint / optimized Next build | PASS |
| Build security | PASS — 54 client assets and 101 server traces; no secret/private trace matches |
| Source security | Zero actual production-secret matches; one unchanged synthetic credential-pattern fixture reviewed against HEAD |
| Hosted NFL ingestion, posting and cross-device persistence | NOT RUN |
| NFL verified markets/settlement, official predictions, full fantasy | DISABLED / not implemented end-to-end |
| Android/iPhone devices | NOT RUN; browser widths are emulation |

Initial browser failures came from missing Fantasy CSS and an insecure isolated origin without Web Crypto. The harness now uses actual styles and intercepted HTTPS; all three checks pass without live network mutations. One bounded read-only reviewer found a contradictory completed/cancelled score could be accepted; the main agent fixed it and added regressions. No Ultra or nested review.

Evidence: [summary](qa/nfl-beta/results.json), [build scan](qa/nfl-beta/build-security.json), [source triage](qa/nfl-beta/secret-scan-triage.json), [PostgreSQL](qa/fantasy-production/real-postgres-races.json), [mobile](qa/nfl-beta/nfl/ISOLATED-nfl-directory-412.png), [desktop](qa/nfl-beta/nfl/ISOLATED-nfl-directory-1366.png). Screenshots are authored UI fixtures, visually inspected, not hosted acceptance.

## Provider research

The existing supplier is the first candidate. [The Odds API](https://the-odds-api.com/) advertises a Free 500-credit monthly tier. Its [V4 documentation](https://the-odds-api.com/liveapi/guides/v4/) supports NFL event discovery without quota charge, recent scores and moneyline/spread/total markets; player props need separate per-event coverage checks. This does not establish Docked's production credentials or active quota.

Its [terms dated 31 August 2026](https://the-odds-api.com/terms-and-conditions.html) permit commercial app display, retention and derived analysis, but prohibit standalone raw-feed redistribution. Register exact production rights evidence and budget through existing controls. This research does not approve regional gambling publication or infer non-promotional bookmaker classification.

Start a production fixture trial with event discovery only, using a production-authorised credential and verified Free account. Do not retrieve/reuse Preview secrets or weaken the Preview-only binding. Results require correction/finality evidence and a budget: once-daily three-day score inspection nominally uses at most 62 credits over 31 days, excluding retries/other uses. This is a planning estimate, not activated billing or full-season history coverage.

[nflreadr schedules](https://nflreadr.nflverse.com/reference/load_schedules.html) points to Lee Sharpe's nfldata source. It is a season-history/statistics candidate; actual 2026 coverage was not fetched here. The exact nfldata LICENSE URL checked returned 404. Do not infer its rights from a licence in another nflverse repository. Verify upstream rights, schema, revision and attribution first. No dataset was downloaded or republished.

Current franchise identities were checked against the [NFL directory](https://www.nfl.com/teams/); this does not confer trademark/image rights or affiliation.

## Research and optional fantasy

Reuse the existing as-of source registry, versioned datasets, review workflow and forward validation machinery. Proposed independent NFL model foundation: pregame offensive/defensive team strengths learned from authorised historical sporting observations, explicit home/neutral-site effects, frozen training cutoffs and an auditable margin/total distribution. Market odds enter only the later comparison. This is a design specification, **not a trained or validated model**.

Before price comparison, define exact event, regulation/full-game/OT, selection, line and win/loss/push/void contract. For returned-stake pushes, expected net return is `P(win) × (decimal odds − 1) − P(loss)`. NFL ties must not enter the binary NBA model. Compare identical contracts only. Require chronological held-out calibration, log loss/Brier scores, leakage checks, uncertainty and forward paper evidence before official publication.

Full NFL fantasy additionally needs authorised player/stat mappings, approved positions/scoring/lock/correction rules, versioned seasons, finite editions separate from football and real multi-user settlement tests. Existing 11-card starter/scarcity and rarity-independent scoring remain unchanged. Advanced models/fantasy are optional and must not hold an otherwise accepted community/fixtures beta.

## Remaining actions

1. Configure a production-authorised supplier credential securely and verify Free-plan quota. Do not paste secrets into chat. Production provider binding, rights registration and actual current-season fixtures remain technical work.
2. Complete existing policy/version/territory and moderation approval, owner MFA, restricted hosted invitation/recovery/failure tests and beta record isolation/gameplay acceptance. See [live-beta report](DOCKED-LIVE-BETA-ACCEPTANCE.md). Support-only hosted Auth testing is already authorised; no repeat permission is requested.
3. Stage on existing Netlify, then verify actual ingestion and two-user NFL post/comment/like/follow/block plus browser-refresh behavior. The catalogue migration is now applied; live data remains unavailable. Missing/stale data must remain unavailable.
4. Promote and build the guarded Android Beta target only after mandatory gates pass. No current-season fixtures, verified NFL betting records, production administrator, APK or deployment success is fabricated.

No cloud settings, holding page, DNS, Microsoft permissions, certificates, paid plans or email delivery changed. Oura and Preview were not accessed or modified. The prior owner-confirmed diagnostic Inbox delivery remains preserved; full hosted Auth acceptance is a separate outstanding gate.
