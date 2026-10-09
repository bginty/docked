# Fantasy cleanup and design acceptance — 10 October 2026

## Scope and product truth

Branch: `pivot/fantasy-cards-preview-v1`. Current direction is permanently fantasy sports cards; Play / Cards / Market / Social / Profile and **COLLECT. BUILD. COMPETE.** replace the retired identity. Presentation no longer falls back to a betting product when gameplay is disabled. This grants no additional access.

Retired routes, APIs, pricing/provider/research modules, worker entry points, content and positive tests were moved to `legacy/retired-product`. Tombstones return 410 for old clients. New regression tests verify retirement; retained auth, social, fantasy, RLS and transaction tests remain active. Historical databases and migrations were not deleted or rewritten.

Shared onboarding, account settings, profiles, social posts, notifications, emails, support, metadata and native links now use fantasy terminology. Historical enum/column names remain compatible; retired consent is forced off, obsolete notification types rejected, and old posts excluded from current feeds. The composer retains hydration, origin, permission and idempotency protections.

## Journey matrix

| Journey | Implemented capability | Acceptance boundary |
|---|---|---|
| Invited auth, verification, MFA, onboarding and sport preferences | Existing shared lifecycle retained; marketing separate and optional | Local browser and platform tests; no owner impersonation or email sent |
| Collection and details | Unique cards, finite editions, serials, provenance, filters and pack reveal | Database tests plus authored responsive fixtures |
| Team selection | Owned eligible cards, 1 GK / 4 DEF / 4 MID / 2 FWD, locks and atomic entry | Database/transaction tests plus form/retry browser fixtures |
| Competitions, scoring, rankings | Fictional football rounds and deterministic simulated statistics | Local functional/RLS/concurrency tests; no real sports scoring claim |
| Acquisition | Server-assigned starter/pack outcomes, finite stock and idempotent claims | Isolated local tests; hosted gameplay disabled |
| Trading and marketplace | Existing isolated Preview test-credit sales/trades | Local database isolation/race tests; production-compatible marketplace disabled |
| Social | Posts, follows, comments, reactions, moderation and profile settings retained | Existing tests; no fabricated production accounts or engagement |
| Other sports | Sport preferences/discussion; NFL scaffold | Sport-specific card games and scoring are future work |

## Design evidence

Supplied assets: `public/brand/docked/logos/docked-logo-horizontal.webp`, `docked-wordmark-compact-400w.webp`, `docked-wordmark-compact-800w.webp`; supplied stadium hero desktop/tablet/mobile variants; `icons/docked-icon-192.png`, `docked-icon-512.png`, maskable, Apple and favicon variants; `social/docked-open-graph-1200x630.jpg`. Platform sizes are contained resizes of supplied artwork. Old public logo/social directories were archived.

Screenshots are in [qa/fantasy-cleanup](qa/fantasy-cleanup). Files named `play/cards/market/social/profile-360/412/1440.png`, `card-detail-*`, `collection-empty-*` and `team-error-*` are explicitly labelled fictional **design fixtures**, not authenticated hosted gameplay. Browser account screens use the actual credential-free local application. They do not establish physical-device approval.

## Security and retirement limits

No provider credentials, paid services, registration expansion, production deployment or DNS changes are part of this milestone. Server-issued cards and scores, scarcity and account isolation remain mandatory. No pay-to-win scoring multiplier was introduced.

Hosted SQL grants, cron/outbox retirement and retained database routines require [DATABASE_RETIREMENT](DATABASE_RETIREMENT.md). Old immutable consent wording remains visible as historical policy with an explicit notice; a replacement packet needs new approval. These are unresolved full-retirement gates, not evidence of completed hosted revocation.

The line-by-line [legacy occurrence inventory](qa/fantasy-cleanup/legacy-occurrences.csv) records every matching text occurrence with file, line, column and reason. It includes historical source, immutable migrations/policy, negative regression tests, compatibility fields and disabled configuration guards. Binary artwork was reviewed separately.

## Final acceptance gates

Final automated counts, deployment receipt and PASS/FAIL status are recorded in `qa/fantasy-cleanup/acceptance.json` after verification. Physical Samsung S24 checks and owner visual approval remain pending. A bundled APK compile is not connected-device acceptance. The multi-sport roadmap must not be presented as completed multi-sport gameplay.
