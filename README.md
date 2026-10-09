# Docked — Fantasy Sports Cards

**COLLECT. BUILD. COMPETE.** Docked is a multi-sport fantasy card platform. The permanent product authority is [PRODUCT_DIRECTION](docs/PRODUCT_DIRECTION.md).

The current implementation offers fictional football cards, limited editions, collections, team selection, simulated competitions, rankings and isolated Preview transactions. Other sports currently support community discussion/preferences; their fantasy gameplay is not operational.

Use the existing branch and supplied assets. Preserve authentication, MFA, invitation gates, ownership integrity and server-side transactions. Rarity never multiplies fantasy scores.

## Run and verify

Use the pinned Node dependencies: npm ci; npm run typecheck; npm run lint; npm test; npm run db:test; npm run test:browser; npm run build. Local database tests create isolated fixtures. Never use a production database as a test database.

See [BUILD_STATUS](docs/BUILD_STATUS.md), [cleanup plan](docs/FANTASY-CLEANUP-PLAN.md), [database retirement](docs/DATABASE_RETIREMENT.md) and [brand integration](docs/BRAND-INTEGRATION.md). Previous product source and instructions are historical in legacy/retired-product and cannot authorize restoring retired features.

Deploy only to protected Preview. Public registration, external admission, public launch and paid services stay closed. Keep the production holding page unchanged. Credentials belong only in ignored private files or the scoped host secret store.
