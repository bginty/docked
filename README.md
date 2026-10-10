# Docked — Fantasy Sports Cards

**COLLECT. BUILD. COMPETE.** Docked is a multi-sport fantasy card platform. The permanent product authority is [PRODUCT_DIRECTION](docs/PRODUCT_DIRECTION.md).

The current implementation offers fictional football cards, limited editions, collections, team selection, simulated competitions, rankings and isolated Preview transactions. The shared scoring framework has isolated EPL/NFL/AFL fixture verification; operational real-statistics scoring and real player catalogues are not connected. See the current friends-release documents before activating external access.

Use the existing branch and supplied assets. Preserve authentication, MFA, invitation gates, ownership integrity and server-side transactions. Rarity never multiplies fantasy scores.

## Run and verify

Use the pinned Node dependencies: npm ci; npm run typecheck; npm run lint; npm test; npm run db:test; npm run test:browser; npm run build. Local database tests create isolated fixtures. Never use a production database as a test database.

See [BUILD_STATUS](docs/BUILD_STATUS.md), [cleanup plan](docs/FANTASY-CLEANUP-PLAN.md), [database retirement](docs/DATABASE_RETIREMENT.md) and [brand integration](docs/BRAND-INTEGRATION.md). Previous product source and instructions are historical in legacy/retired-product and cannot authorize restoring retired features.

The current release authority is [FRIENDS_RELEASE_PLAN](docs/FRIENDS_RELEASE_PLAN.md): the owner authorises docked.com.au for a verified invite-only AU/18+ beta capped at ten testers, conditional on readiness. Keep the existing site when factual policy or security gates remain unresolved. Public self-registration, real charges and withdrawals remain disabled until their separate prerequisites pass. Do not send invitations while the owner is offline. Credentials belong only in ignored private files or the scoped host secret store.
