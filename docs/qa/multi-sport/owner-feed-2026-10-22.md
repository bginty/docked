# Owner-managed statistics and scoring — 22 October 2026

The owner requested the existing NFL approach: real player names, city labels and original team-colour jerseys without logos, with statistics supplied by an owner-operated scraper. The integration does not require buying a provider subscription. A source/export and verified mappings are still needed before data can be imported. No source permissions are inferred from a public scoring table.

## Scoring decisions

The existing scoring engine now has two new versioned event templates, rather than a second calculator. All weights are integer centipoints. Base points never contain a card multiplier. Saved rounds continue using their frozen rules, and no historical result is recalculated by installing this code.

| Sport | Implemented model | Important distinction |
| --- | --- | --- |
| AFL | Existing owner-approved kick 2 / handball 1 model, with the approved 22 slots | Preserve Docked's established choice. AFL Fantasy's published comparison uses 3 / 2. No match-wide scaling. |
| NRL | NRL Fantasy 2026 event values, `docked-nrl-events-v1` | Complete 10-run-metre and 30-kick-metre groups per match. Offloads to hand/ground are distinct. No captain, interchange or auto-emergency rules imported. |
| NBA | NBA Fantasy Salary Cap event values, `docked-nba-events-v1` | Points/rebounds 1, assists 2, steals/blocks 3. Turnovers and made threes have no additional coefficient. Docked sums the frozen weekly fixtures, not a player's best game. |
| EPL | Existing `docked-epl-beta-v1` | Retains Docked's documented disciplinary and on-pitch policies. Does not claim exact current FPL compatibility. |

NRL: try 8; goal 2; field goal 5; try assist 5; line break 4; line-break assist 2; tackle 1; tackle break 2; missed tackle -2; offload to hand 4/to ground 2; error -2; 40/20 and 20/40 4; penalty -2; six-again -1; sin-bin -5; send-off -10; try save 5; kick defused 1; forced dropout 2; turnover 4; in-goal escape 2. Run and kick metres use the grouped rates above. Required raw events cannot be omitted as presumed zero.

Research references, accessed 22 October 2026:

- [AFL Fantasy event table](https://www.afl.com.au/news/1464392/afl-fantasy-for-dummies-how-to-play-scoring-system-more/amp).
- [NRL Fantasy guidelines, section 8.3](https://fantasy.nrl.com/help/guidelines).
- [NBA Fantasy scoring updates](https://en.nbafantasy.nba.com/help/updates).
- [Current FPL points](https://www.premierleague.com/en/news/2174909): comparison only. Docked's existing EPL model has GK goals 6, no BPS/defensive-contribution bonus and explicit different second-yellow/on-pitch treatment. Changing these would require a new version, never rewriting saved rounds.
- [SuperCoach publisher's AFL explanation](https://www.foxsports.com.au/afl/supercoach-news/kfc-supercoach-beginners-guide-how-players-score-points-scoring-system-explained/news-story/ddbe3143e74da1ed510cfc6b46253c74): SuperCoach uses match scaling.

## Scraper handoff

Generate the machine-readable contract (refuses to overwrite an existing file):

```text
node node_modules/tsx/dist/cli.mjs scripts/export-sport-feed-contract.ts new-contract.json
```

It includes transport, trusted mapping, raw-statistic schemas and versioned coefficients for all four sports. No credentials are needed for this offline step.

Each feed is one fixture revision. Send `schemaVersion`, `sport`, `season`, `provider`, `providerFixtureId`, `revision`, `observedAt`, `status`, `endedAt`, source `evidence` and `players`. Dates are explicit UTC ISO strings. `completionObservedAt` can be used if the exact final whistle is unavailable; never invent `endedAt`. An evidence hash identifies retained source bytes; the dry-run validator checks its shape, not the unavailable underlying source bytes.

Each player row supplies `providerPlayerId`, `availability` and `stats`. Availability is `complete`, `pending` or `confirmed-dnp`. Pending/DNP requires `stats: null`. A player with verified zero contribution has a complete, all-zero stats object. An omitted mapped player remains pending. Completed games never cause an automatic DNP inference in this new-sport adapter.

Operator mapping is a separate file: sport, season, provider, provider fixture ID, internal fixture ID, frozen scoring version, maximum age, and provider-player/internal-player/position mappings. Match names and array order are not identity keys. The initial validator expects the fixture's complete mapped player scope; it rejects unrecognised rows rather than silently matching by name.

```text
node node_modules/tsx/dist/cli.mjs scripts/review-owner-sport-feed.ts feed.json mapping.json new-report.json
```

The report includes normalised source snapshot, missing players and base-centipoint previews. It never writes a database, creates a round, changes membership or mints cards. Unfinished/live games do not receive postgame contribution previews. Revisions pass to the existing authoritative import/correction path; repeated identical revisions are idempotent, conflicting revisions fail, and finalised periods require the existing reviewer correction controls. Source-review checks in that import path remain intact; an owner-managed feed can be configured without purchasing an API, but the program does not fabricate source-policy evidence.

NBA uses `basketball` in the feed. EPL uses `epl` for scoring and `football` for roster/cards. AFL requires all nine raw event counts. NRL requires the full published event breakdown, including both offload types; generic offloads cannot be split by guessing. NBA requires box-score points, rebounds, assists, steals, blocks, turnovers and made threes. EPL needs verified on-pitch intervals/event ordering as documented by the existing scorer; final team score alone is insufficient for substitution-sensitive points.

## Card presentation

The canonical renderer accepts frozen `city`, `colour` and `accentColour` metadata for new sports. Names remain the verified roster names. Team IDs remain stable internal keys. The roster review contract accepts a separate city/colour evidence object, restricted to plain city text and hex colours; it has no logo/image URL field. Missing city/number evidence stays unavailable. NFL's current palette and city handling are unchanged. This adds the path for actual roster data, not a fabricated roster or newly issued collectible.

## Release state and remaining inputs

No hosted settings, migrations, live competitions, wallets, ownership or accounts were changed by this pass. Production activation cannot yet provide playable new sports: the real roster/fixture/statistics export has not been supplied, Traditional salary/cap and issuance configuration are not populated, and NRL/NBA lineup formats remain labelled proposals. The earlier production request remains unfulfilled; this code is not a claim of a completed live multi-sport launch.

The next concrete input is the NFL scraper folder/repository (to reuse its transport) and one sample new-sport export. The schemas and dry-run command above are ready for that handoff. Existing source evidence and activation controls are retained; a paid-provider requirement is not imposed.

## Verification

- 550 platform tests passed, zero failures/skips, including raw-event arithmetic, metre grouping, historical versions, correction audit, replay, finalised-result protection, explicit missing/zero/DNP states and roster presentation.
- Typecheck and zero-warning full lint passed. Additional browser fixture/script lint passed.
- Clean build and canary client-secret boundary check passed (`build.txt`, `client-boundary.txt`).
- Feed contract export and CLI dry run passed. The illustrated NBA payload produced 59 base points. Existing report overwrite was rejected. No data persisted.
- Actual Chromium renderer checks passed at 360, 412 and 1440 pixels: four original sport silhouettes, explicit city labels/numbers, no overflow or page exceptions. The 412 and 1440 screenshots were visually inspected. See `owner-feed/browser.json` and its screenshots.
- No schema migration or scheduled-job change is required for this offline preparation. No hosted authenticated import or physical-device acceptance is claimed. The scraper connection still needs a real sample and source mapping.
