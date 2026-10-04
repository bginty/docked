# Phase 2 research preparation

## Phase 5B supersession — 4 October 2026

The revised forward-only product direction supersedes any historical Docked betting-performance or historical betting ROI launch gate below. No retrospective Docked tips or profits will be reconstructed. Historical sporting statistics remain valid licensed model inputs; chronological model calibration, data-quality and software replay tools remain available. The official record starts only at its first genuine prospective live publication. See [model architecture](DOCKED_MODEL_ARCHITECTURE.md), [forward calibration](FORWARD_CALIBRATION.md) and [official record](OFFICIAL_RECORD.md). Older design details below are preserved as research/historical context, not current live-release prerequisites.

The ordered workflow below describes the preserved legacy V1 input and pricing model. Phase 4 adds an explicit MarketReference branch with a stricter historical evidence schema, reference-region freeze binding and the same prospective reference evaluator/observer. Use [VALIDATION.md](VALIDATION.md#phase-4-research-support-boundary) for its exact inputs and commands; legacy quotes or reports cannot be relabelled as new-model evidence.

No licensed historical data has been imported, no genuine result calculated, and no strategy edge established. All regression fixtures are explicitly fictional, stay outside public queries, and are deleted by the CLI integration test. The original V1 parameter values remain unchanged.

## Workflow

1. Obtain separate written odds and outcome rights. Record permitted retention, archive use, derived research, public display and territory. Obtain historical bookmaker/operator ownership and event/market mapping evidence. An API key alone does not supply these permissions.
2. Canonicalise reviewed source files into `HistoricalEvent[]` from `src/research/replay.ts`, without imputing missing prices or outcomes. Preserve original files privately and hash their exact bytes. Store canonical-data hash using the repository `hash()` function, which is a canonical JSON hash rather than a file-byte hash.
3. Complete a manifest, then run `npm run research -- import private-data/events.json private-data/manifest.json research-output/import-audit.json` and `npm run research -- validate-data private-data/events.json private-data/manifest.json research-output/data-quality.json`. These operations validate data without revealing strategy outcomes. Invalid schemas, mapping contradictions, duplicate snapshot times, impossible result dates, future receipt timestamps and hash mismatches fail.
4. Review and commit the exact strategy code. On a clean working tree, run `npm run research -- freeze-strategy`. This creates `research-output/freeze.json` with the config, config hash, current Git commit, actual freeze time and proposed date splits, using exclusive file creation. It is a rule-freeze artifact, not an approval. Retain it privately, hash its canonical object, and copy the hash and matching commit/config hash into the manifest. Never overwrite it after inspecting held-out results. Preserve the artifact in a version-specific research archive before preparing a genuinely new version.
5. Run `npm run research -- replay private-data/events.json private-data/manifest.json research-output/replay.json`. Real-data replay requires the same clean frozen Git commit and matching freeze artifact. Existing output files are never overwritten. The same `evaluate()` implementation prices prospective candidates and retrospective decisions.
6. For development/validation only, run `npm run research -- stress-test private-data/events.json private-data/development-manifest.json research-output/stress.json`. It reports every threshold, delay, missing-operator and worse-price/fee scenario. It does not choose an optimum. Held-out/subsequent sensitivity is blocked. A version-only clone of unchanged frozen V1 can be evaluated as fixed rules; changing parameters after viewing a held-out report requires a new strategy version, contamination disclosure and a separately reviewed evaluation plan.
7. Run `npm run research -- report research-output/replay.json research-output/report.md`. This verifies the JSON artifact hash before generating a private readable summary. The full JSON remains the evidence: all candidates/rejections, immediate/delayed rows, source IDs, monthly results, drawdown, losing run, CLV, availability, calibration/Brier/log loss and uncertainty. Neither output path writes to the live ledger or publishes claims.

## Manifest requirements

Every manifest requires `datasetId`, `evidence` (`retrospective_backtest` or local `demo`), `oddsRights`, `resultsRights`, `retentionAllowed`, `configHash`, `dataHash`, `codeCommit`, integer `seed`, `split`, `contaminated`, `frozenAt`, exact inclusive `from` / exclusive `to`, and `historicalUniverseEvidence`.

Real-data manifests additionally require:

- `fixture: false`, `provider: { odds, results }`, a named `reviewedBy`, and positive `sourceResolutionSeconds`.
- `datasetHashes: { canonical: dataHash, rawFiles: [{ name, sha256 }] }` with exact SHA-256 original-file hashes.
- `freezeArtifactHash`, equal to the canonical hash of the retained freeze artifact.
- `holdoutProvenance` when claiming a held-out/subsequent dataset is uncontaminated. A self-declared flag is not independent proof; the reviewer must verify access and change history.

The proposed splits are 2022–2023 development, 2024 validation, 2025 held-out, and 2026 YTD additional fixed-rule retrospective evaluation. They are planning windows, not claims of coverage or untouched outcomes. The template's YTD exclusive endpoint is 3 October 2026; operators must replace it with the actual approved data cutoff and disclose incomplete latest-day coverage. Do not silently shorten failed datasets or omit losing events. Report missingness and any coverage-driven change before reviewing strategy outcomes.

## Time and missingness

All quote/snapshot/result timestamps require an explicit timezone. Comparisons use instants, never lexical strings. Snapshot `observedAt` must be at or after source, snapshot and receipt times in order. A modern download receipt is not historical availability. The Odds API adapter preserves real download time; it cannot be fed directly into a historical replay while claiming it was received years earlier. Canonicalisation needs independently evidenced archive publication/availability semantics, with optional `archiveRetrievedAt` and `availabilityEvidence` retained separately. If historical availability cannot be established, the decision remains unavailable.

Replay chooses the last snapshot no later than each frozen decision time. Delayed entry chooses the first real sample at least five minutes later and at most fifteen minutes later, keeps the original bookmaker/selection and original minimum odds, and revalidates fresh references. It does not search forward for a better price.

CLV uses the declared pre-start proxy: the first valid sample between T−13 and T−10 minutes after the original selection. It cannot create an earlier decision. Availability reports the first actual valid observation within 60 seconds after 5/15/60-minute targets; inadequate source resolution and absent samples remain missing, with null rates when no measurements exist. These are observable-price diagnostics, not evidence that a stake could be executed at that price.

The report discloses incomplete outcomes, source/bookmaker/competition coverage, event and market mapping quality, stale quotes, rejected decisions and missing windows. The calibration baseline is the offered bookmaker's own proportional margin-free probabilities on the identical outcome universe. Observations are correlated. Seeded day-block bootstrap preserves within-day dependence but does not establish cross-day independence or profitability.
