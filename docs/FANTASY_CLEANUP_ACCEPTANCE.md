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

**Overall: FAIL — full acceptance remains incomplete.** The implemented cleanup and automated checks pass within the scopes below; this is not a sign-off for hosted gameplay or a public launch.

| Area | Result | Evidence and limitation |
|---|---|---|
| Fantasy functionality | PASS locally; FAIL for complete hosted acceptance | 190 platform tests, 139 migration/RLS tests, 9 real PostgreSQL free-play race scenarios and 19 beta isolation scenarios pass. Hosted gameplay remains disabled. |
| Design | PASS automated; owner approval PENDING | Responsive/accessibility checks and screenshot review pass. Physical Samsung S24 checks were not performed. |
| Security | PASS executed checks | Account isolation, finite scarcity, atomic claims/trades, role denials and client/APK credential scans pass. Full hosted database retirement remains separately gated. |
| Legacy cleanup | PASS active application; database retirement PENDING | Removed active entry points; preserved audit history and immutable policy. Every remaining text match has a reason in the occurrence inventory. |

Typecheck, lint, production web build and Android debug build pass. Dependency audit reports zero vulnerabilities. Browser verification covers 26 unique scenarios: the final full run passed 22 of 25; three screenshot writes failed after UI assertions, then all six owner-screen scenarios passed with a fresh output directory. The additional onboarding scenario passed. The protected hosted run passed 23 checks covering page rendering, access denial, retired endpoints, console, responsive layout and accessibility—not authenticated gameplay.

Protected Preview: <https://docked-production-2jzstkybl-briant-s-projects.vercel.app>. Deployed application commit: `f1ab01335318365861e5d39738ae8a63c1359f6b`. Public registration, external admission and gameplay remain closed; owner authentication is retained. The production holding page returned the same SHA-256 before and after deployment. No external email, paid service, DNS or production change occurred.

Android artifact: `artifacts/android/Docked-v10-Fantasy-Bundled-QA.apk`, version `1.9-preview` / code `10`. This is a bundled debug QA shell with no attached remote origin, not a connected friends-and-family release. APK SHA-256: `1651e1141fb3e6331d78d0573d2ff6432d3332973c6bd261651530d12ff87aef`.

See [machine-readable acceptance](qa/fantasy-cleanup/acceptance.json), [visual review and screenshots](qa/fantasy-cleanup/VISUAL_REVIEW.md), and [exact changed-file manifest](qa/fantasy-cleanup/changed-files.tsv). Screenshot fixtures are explicitly fictional and were not seeded into hosted data.

Next: owner review of the supplied-brand screens, followed by a separately scoped owner-only hosted gameplay and physical S24 acceptance window while registration stays closed. The historical database grants/jobs/outbox and replacement consent packet require their documented separate review. Operational multi-sport scoring and live sports data are missing functionality, not completed features.
