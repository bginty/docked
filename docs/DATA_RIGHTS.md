# Data rights register

## Phase 5A decision — 4 October 2026

**The Odds API: APPROVED_FOR_PREVIEW_TRIAL.** Reviewer: Codex, acting under the owner's explicit Phase 5A instructions. Reference: `the-odds-api-terms-2026-08-31-phase5a-2026-10-04`. Next review: **4 November 2026**, or sooner following material terms/product changes. Production approval is not granted. [Bounded execution plan](PHASE5A_TRIAL_PLAN.md).

The [official terms, Restrictions](https://the-odds-api.com/terms-and-conditions.html#restrictions), updated **31 August 2026**, permit qualifying commercial applications, indefinite retention, UI display, research and derived analytics. Standalone raw-data feeds, resale APIs and downloadable data products are prohibited. Attribution is optional. Bookmaker trademarks remain third-party property; no logo licence is inferred. Access may be revoked and terms may change. Docked retains responsibility for accuracy checks and applicable local rules.

Application-specific interpretation of the requested uses:

| Uses | Trial assessment |
|---|---|
| A server retrieval; B commercial analysis | Supported application use |
| C raw retention; D canonical snapshots | Supported storage use |
| E derived metrics; F prices; G analytics | Supported calculation/display |
| H historical research; I reproducibility | Supported purpose; plan entitlement separate |
| J community benchmark; K immutable evidence | Reasonable analysis/retention interpretation |
| L shared ingestion/cache; M retained evidence | Reasonable application/storage interpretation |
| N initially free, potentially paid | Within the same consumer-product boundary |

No material licensing ambiguity blocks this limited trial. Standard/non-promotional price evidence, operator independence, results completeness, regional authority and actual account entitlement are separate unresolved data/operational questions. A future bulk-data product or branded bookmaker imagery needs a new review. Docked's chosen raw retention is seven days; canonical/audit retention follows its existing privacy and immutable-ledger policies, not unlimited retention of personal information.

### First-party evidence retrieved before provider requests

All accessed **4 October 2026, Australia/Sydney**. Except the dated terms and API V4 identity, these pages expose no publication/update version; none is invented.

| Document | Official URL | Version/update shown |
|---|---|---|
| Terms and usage/licensing | https://the-odds-api.com/terms-and-conditions.html | 31 August 2026 |
| API endpoints/quota/schema | https://the-odds-api.com/liveapi/guides/v4/ | V4 |
| Historical odds | https://the-odds-api.com/historical-odds-data/ | Not shown |
| Pricing and plan inclusions | https://the-odds-api.com/#pricing | Not shown |
| Quota reset/billing FAQ | https://the-odds-api.com/manage/faqs.html | Not shown |
| Market definitions | https://the-odds-api.com/sports-odds-data/betting-markets.html | Not shown |
| Source update intervals | https://the-odds-api.com/sports-odds-data/update-intervals.html | Not shown |
| Error handling | https://the-odds-api.com/liveapi/guides/v4/api-error-codes.html | V4 |

This is a new, limited decision; the earlier unactivated reviews below remain historical context. OddsPapi is outside Phase 5A and is not activated or reevaluated.

## Phase 5 review — 4 October 2026

**No source activated.** Review of current primary terms found stronger evidence than the original pending register below. [The Odds API terms](https://the-odds-api.com/terms-and-conditions.html), updated 31 August 2026, allow qualifying integrated commercial apps, indefinite storage, research, derived calculations/display and model training. They prohibit standalone raw feed redistribution; attribution is optional. Docked's precise service must fit those conditions. Record the owner's approved use, licence version, territories, retention and source capabilities before ingestion; this document does not flip any approval flag.

[OddsPapi terms](https://oddspapi.io/en/legal/terms) prohibit standalone resale/repackaging and bind access to the account plan. Exact Docked storage, derived reference display, historical export, attribution and audit-evidence retention permissions remain **UNCONFIRMED**. Request written clarification through the owner before activating those purposes. API access or a paid subscription alone is insufficient.

### Retention layers

| Layer                         | Purpose and access                                       | Retention/activation rule                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw licensed payload          | Private ingestion diagnostics, hashing, mapping audit    | Shortest approved period; scoped private storage, never public APIs/static assets/APK. No indefinite raw retention by default                                         |
| Canonical market snapshot     | Exact event/rules/selection/source/receipt evidence      | Effective licence controls storage; preserve missingness and source provenance. No raw-feed export through member endpoints                                           |
| Derived Market Reference      | Versioned pricing/availability calculation               | Retain permitted provenance and hash; sufficient disjoint standard-source evidence required; derived display permission separate from ingest                          |
| Official publication evidence | Permanent publication/price/model/rules/accounting audit | Never delete losing publications; obtain rights compatible with permanent permitted evidence **before** activation                                                    |
| Community submission evidence | Immutable benchmark and transparent corrections          | Separate from claimed price; preserve permitted pseudonymous evidence after account erasure while removing unnecessary personal data                                  |
| Historical research dataset   | Manifest-bound reproducibility and chronological replay  | Explicit historical/research/storage authority, content hashes, source availability clocks, split/config/code versions; no public dataset download without permission |

If a licence requires deletion incompatible with immutable audit evidence, do not activate that source for competitive/publication use. Use a separately approved minimal derived-evidence policy or a different supplier; do not silently remove records. Rights revocation blocks new ingest/display/reference use and triggers reviewed handling of existing licensed payloads. Dataset/payload retention is not a licence to retain member personal data indefinitely.

Fixtures and factual Watchlist copy need display permission even though they are not Edges. Competitive standard-price classification, independently owned cohorts, results rights and jurisdiction permission remain separate affirmative gates. No scraped bookmaker or unlicensed results feed is used. See [provider evaluation](ODDS_PROVIDER_EVALUATION.md) and [historical plan](HISTORICAL_DATA_PLAN.md).

## Original implementation register (historical context)

Status: no commercial ingestion authorised by this build. A paid plan does not itself establish all rights required for the proposed use.

| Source                              | Intended purpose                          | Technical capability                                                                               | Permission status                                                              |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The Odds API, **the-odds-api.com**  | current and timestamped historical prices | adapter implemented; shared per-sport fetch; historical endpoint rejects later snapshots           | pending coverage, display, retention, derived output, export and budget review |
| Authorised result source            | settlement and historical outcomes        | ResultsProvider plus authorised canonical-file boundary, revision chains and explicit adjudication | supplier not selected; historical odds are not historical results              |
| Football-Data                       | possible future research only             | no importer and no scraping                                                                        | specific commercial permission required                                        |
| Locally authored fictional fixtures | arithmetic and software tests             | test directory and research demo CLI only                                                          | no real performance; production publication/import blocked                     |

Each source activation needs: contracting entity, licence/reference, countries, sports/markets, permitted purposes, complete settlement rules, retention/deletion terms, derived publication rights, raw export rights, source timestamp/resolution, operator independence evidence, quotas and billing approval. Track approved capabilities in source_health. All permissions default false where not affirmatively known.

Raw permitted payloads go to `private-data/`, never public/, public APIs or source control. Local-file raw storage requires durable private object-storage adaptation for ephemeral production hosts; this is a production deployment gate. Canonical snapshots retain separate source, provider snapshot and local receipt times. Commercial retention of canonical/derived prices also needs approval even if raw storage is disabled.

The provider adapter requires explicit canonical event/participant/start/rules mapping and approved operator groups. Unknown events or bookmakers are not guessed. Historical universe evidence must document books available at the historical time; do not project today's universe backward.

Phase 2 provider readiness is documented in [PROVIDER_READINESS](PROVIDER_READINESS.md). Missing quota/header/source metadata remain unknown, and malformed/ambiguous source markets fail closed. The adapter preserves actual historical-download receipt time; canonical research conversion requires separately reviewed evidence of historical availability. A modern receipt must never be relabelled an old prospective observation. Results imports require a source-specific rights reference, reviewer, event allowlist and exact input hash. No source is activated by these engineering controls alone.

No data was purchased or imported. No odds key was found in the shell environment. No competitor tips were collected. No former storefront customer list was accessed or reused.

Reference checked: https://the-odds-api.com/liveapi/guides/v4/ and https://the-odds-api.com/terms-and-conditions.html (terms must be reviewed before activation, not presumed by this record).
