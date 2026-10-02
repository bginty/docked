# Data rights register

Status: no commercial ingestion authorised by this build. A paid plan does not itself establish all rights required for the proposed use.

| Source                              | Intended purpose                          | Technical capability                                                                     | Permission status                                                              |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The Odds API, **the-odds-api.com**  | current and timestamped historical prices | adapter implemented; shared per-sport fetch; historical endpoint rejects later snapshots | pending coverage, display, retention, derived output, export and budget review |
| Authorised result source            | settlement and historical outcomes        | ResultsProvider plus authorised canonical-file boundary, revision chains and explicit adjudication | supplier not selected; historical odds are not historical results              |
| Football-Data                       | possible future research only             | no importer and no scraping                                                              | specific commercial permission required                                        |
| Locally authored fictional fixtures | arithmetic and software tests             | test directory and research demo CLI only                                                | no real performance; production publication/import blocked                     |

Each source activation needs: contracting entity, licence/reference, countries, sports/markets, permitted purposes, complete settlement rules, retention/deletion terms, derived publication rights, raw export rights, source timestamp/resolution, operator independence evidence, quotas and billing approval. Track approved capabilities in source_health. All permissions default false where not affirmatively known.

Raw permitted payloads go to `private-data/`, never public/, public APIs or source control. Local-file raw storage requires durable private object-storage adaptation for ephemeral production hosts; this is a production deployment gate. Canonical snapshots retain separate source, provider snapshot and local receipt times. Commercial retention of canonical/derived prices also needs approval even if raw storage is disabled.

The provider adapter requires explicit canonical event/participant/start/rules mapping and approved operator groups. Unknown events or bookmakers are not guessed. Historical universe evidence must document books available at the historical time; do not project today's universe backward.

Phase 2 provider readiness is documented in [PROVIDER_READINESS](PROVIDER_READINESS.md). Missing quota/header/source metadata remain unknown, and malformed/ambiguous source markets fail closed. The adapter preserves actual historical-download receipt time; canonical research conversion requires separately reviewed evidence of historical availability. A modern receipt must never be relabelled an old prospective observation. Results imports require a source-specific rights reference, reviewer, event allowlist and exact input hash. No source is activated by these engineering controls alone.

No data was purchased or imported. No odds key was found in the shell environment. No competitor tips were collected. No former storefront customer list was accessed or reused.

Reference checked: https://the-odds-api.com/liveapi/guides/v4/ and https://the-odds-api.com/terms-and-conditions.html (terms must be reviewed before activation, not presumed by this record).
