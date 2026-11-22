# Owner promotional and prize pack awards

## Release state

Prepared implementation, not deployed. Production remains on web source
`83794e9ac31c54960bfc76b9a07b36047f20486b` (verified through Vercel).
No production migration, customer award or customer message has been performed.

The source uses that live web version, preserving the existing Commercial
operations dashboard, Owner customer-view controls and default landing routes.
The existing `codex/owner-customer-browsing` branch adds only the three live
landing-route evidence files after that source and is the review base.

## Customer and Owner behavior

Commercial operations and customer records link to `/admin/pack-awards`.
The Owner selects a customer by name/member ID, chooses quantities from the
canonical Standard/Premium 1-, 3- and 9-card products, selects Promotion or
Prize, and enters an internal reference. A review identifies the customer and
exact bundle before issuance. The limit is 20 packs per request for one member.

The requested example is one Premium 1-card pack plus one Standard 9-card pack:
two sealed packs and ten permanently allocated cards. The customer sees them in
My Packs with Promotion/Prize and Free provenance. No wallet credits, credit
lots, Google receipts or monetary journals are created or changed by an award.
Only approved sports with available commercial supply are offered.

Owner history records the issuer, recipient, purpose, reference, request and
individual pack IDs. Customer payloads exclude the internal reference and Owner
identity. Reporting separates free awards from paid pack sales.

## Integrity and security

- The application and database both verify the current Owner, session and MFA.
  The browser's expected-Owner header prevents an old review executing under a
  different signed-in Owner.
- Offline recipients retain normal commercial eligibility, consent, Australian
  region, email/phone verification, restriction and recovery-hold checks.
- Paid purchases and awards use the same cryptographic draw and permanent card
  allocation helpers. Existing odds, serials, caps, no-duplicate-player rule and
  deferred pack/supply constraints remain in force.
- A mixed bundle is one atomic transaction. A later supply failure rolls back
  every pack/card in that bundle.
- Owner/request identity plus the immutable canonical command makes retries
  return the same pack IDs. Unknown network/commit failures retain the request.
  Only definitive declines permit editing into a new request.
- The browser persists an Owner-specific request and uses Web Locks to prevent
  simultaneous creation in two tabs. A confirmed receipt survives history
  refresh failures. Login/MFA recovery preserves the awards route.
- The restricted commercial role cannot insert/update/delete award audit rows
  directly. Scoped functions have fixed empty search paths and explicit grants.
- Existing issued/opened card history is permanent. Packs allocate cards at
  issuance; opening reveals those allocations and does not mint again.

The manual Promotion/Prize label does not activate automated competition
rewards, paid entry, marketplace settlement or withdrawals. The existing shared
public Preview remains read-only for this new asset mutation; its prior billing
test exception has not been widened.

## Verification

See `VERIFICATION.json`, `DATABASE.json` and `ADVISORS.json`.

- 42 focused platform tests passed, with zero skips.
- 15 native PostgreSQL 17.10 acceptance checks passed using Node 22.23.5.
- Zero lifetime-supply mismatches, duplicate serials or incomplete packs.
- Normal paid Premium 3-card purchase and refund regression passed.
- Supabase CLI security advisors on the disposable local database reported no
  issues. This is not a hosted-production advisor claim.
- Full TypeScript, full ESLint and the optimized Next.js production build passed.
- The actual client component and synthetic browser fixture compile to JS/CSS.

### Remaining browser acceptance

`tests/browser/owner-pack-awards.test.ts` is prepared, but has not executed.
Local Chromium is blocked by the executor's socket restriction and the standard
headless-shell download returned HTTP 403. Automatic approval review then
rejected uploading 28 source/test/configuration files to a disposable Vercel
Sandbox because it required explicit permission for that external source-code
transfer. Nothing was uploaded. The non-persistent Sandbox was stopped.

`BROWSER_ACCEPTANCE_BLOCKED.json` records the exact result. No browser pass,
screenshot, hosted end-to-end sale/award or installed Android check is claimed.

An authorized test environment must run the browser scenario before release:
mixed review, simultaneous two-tab confirmation, lost-response reload/replay,
history outage after confirmation, Owner-switch isolation and mobile layout.

## Database and web rollout

There is one new migration:
`supabase/migrations/20261122005246_owner_pack_awards.sql`.

It adds immutable award provenance, narrowly admits zero-price linked packs and
updates Owner report projections. It does not backfill or issue packs. Apply the
migration before the new web application; the new member pack projection needs
the new table/columns. Existing paid purchase code remains compatible with the
migration. Recheck live source/schema drift and the source manifest before any
release, and preserve later unrelated changes such as deployed auth emails.

The change contains no Android source, product ID, price or payment-provider
configuration update. It is a web/API/database feature. Actual installed-app
navigation has not been verified in this work.

If a release needs to be stopped, prevent new Owner award commands or roll back
the web release while keeping the additive schema and all committed award/card
records. The existing emergency issuance pause remains available and also
pauses paid issuance. Never delete awarded cards, rewind serials or rewrite
completed receipts as a rollback.

## Reproduction

Use Node 22 and the repository's pinned dependency lockfile. The native database
runner requires `embedded-postgres@17.10.0-beta.17` in a separate local runtime;
it creates and removes a loopback-only fixture and does not contact a hosted DB.

```bash
node --import tsx --test tests/platform/owner-pack-awards.test.ts tests/platform/owner-pack-awards-route.test.ts
OWNER_PACK_AWARDS_PG_RUNTIME=/absolute/runtime/node_modules/embedded-postgres node scripts/owner-pack-awards-local-postgres.mjs
EXTERNAL_PREVIEW=1 node node_modules/playwright/cli.js test tests/browser/owner-pack-awards.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src scripts tests --max-warnings=0
node node_modules/next/dist/bin/next build
```

The browser test intercepts every HTTP request with synthetic fixtures; its
`EXTERNAL_PREVIEW` setting disables the ordinary application's test web server.
