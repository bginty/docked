# Local account and withdrawal UI verification

## Scope

These checks use disposable native PostgreSQL and synthetic component fixtures.
They do not use Production, shared Preview, real customer identities, real bank
accounts, hosted authentication, a KYC provider or an actual bank transfer. All
cash activation controls remain OFF in the application/database defaults.

## Account lifecycle

The account export now includes the member's own verification status, withdrawal
requests/receipts and masked bank references. It excludes raw identity documents,
provider applicant/review references, keyed name hashes and encrypted or plaintext
bank details. Missing cash schema preserves legacy exports; a partially installed
cash module fails closed. Switching cash OFF does not hide existing records.

Account deletion still revokes access and removes the active profile. It preserves
balances and financial journals. New withdrawal enrollment, bank setup, requests
and payment claims check account closure under the financial-account lock. An
unresolved payout, recovery obligation or cleanup review prevents a deletion job
from being labelled complete. An already-issued provider session returning after
closure reopens the cleanup intent. No external provider deletion is performed.

The retention-policy table is deliberately empty. Actual approved policy and
provider-contract references must be configured before the Owner can attest
financial review, confirm provider cleanup and purge a local encrypted bank
payload. These review actions require the current Owner's AAL2 session and actual
evidence. No retention duration or provider-erasure success was invented.

Final scoped native checks used all three new migrations, including the corrected
cash-compatibility migration:

- `tests/database/commercial-withdrawal-account.test.ts`: 1 passed, 0 failed, 0 skipped.
- `tests/database/commercial-marketplace.test.ts`: 1 passed, 0 failed, 0 skipped.
- Account, Auth erasure and maintenance platform tests: 10 passed, 0 failed, 0 skipped.
- ESLint on the lifecycle changes and new UI harnesses: passed.

Native fixtures use a new local cluster for each test file because the pre-existing
role-creation migration intentionally rejects a role left by another database in
the same cluster. No migration guard was weakened for the fixtures.

Local Supabase security advisors reported three existing fixture-only mutable
search-path warnings (`qa.now`, `beta_private.active_member_session`,
`beta_fantasy.production_eligible`), and no withdrawal/lifecycle findings.

Root owns final repository-wide typecheck/build verification after restoring the
existing asset JSON files missing from this checkout. These scoped results do not
claim that the full build passed.

## Actual component interactions with mocked APIs

`MOCKED_COMPONENT_UI.json` records nine successful interaction checks using the
actual bundled React components in JSDOM. It includes hashes of the checked source
files; a later component change needs a fresh relevant run.

The checks cover the minimum and eligible-balance cap, exact zero/nonzero fee
quotes, fractional-credit rejection, an unverified bank account, clearing bank
inputs after rejected and successful saves, retrying the same UUID after a lost
response, masked history and empty bank web storage, the Owner's payment-sent
confirmation, and clearing a bank reveal on blur/expiry.

The synthetic fetch implementation has no network fallback. JSDOM has no resource
loading enabled. This proves component behaviour against fixtures only; it does
not prove browser rendering, layout, hosted authentication or server enforcement.

### Reproduce without adding an application dependency

Run from the repository root with Node 22 available through npm:

```bash
docked_ui_runtime="$(mktemp -d -t docked-withdrawal-ui.XXXXXX)"
npm install --prefix "$docked_ui_runtime" --ignore-scripts --no-audit --no-fund jsdom@31.0.1
DOCKED_UI_RUNTIME_PACKAGE="$docked_ui_runtime/package.json" npm exec --yes --package=node@22 -- node --import tsx scripts/commercial-withdrawal-dom.mjs
```

The optional JSDOM dependency is installed in the disposable fixture directory.
Neither `package.json` nor `package-lock.json` is changed by that setup. The
fixture's generated evidence contains no raw bank values.

## Browser attempt: blocked, not passed

`scripts/commercial-withdrawal-browser.ts` is a separate Playwright harness for the
same actual components and loopback-only synthetic API responses. Its bundle
compiled, but Chromium could not start in this executor:

> `process_singleton_posix.cc: socket() failed: Operation not permitted`

No browser interaction checks ran. No screenshot was produced. Mobile layout and
actual browser visual QA remain unverified. The restriction was not bypassed.

Run in a permitted browser-test environment, pointing to an installed Chromium:

```bash
DOCKED_UI_CHROMIUM=/path/to/chromium npm exec --yes --package=node@22 -- node --import tsx scripts/commercial-withdrawal-browser.ts
```

On a successful run this separate harness writes `MOCKED_UI.json` and two clearly
labelled synthetic screenshots. Those outputs are intentionally absent from the
current evidence. Browser routing blocks all requests outside its own loopback
server, and neither harness opens Docked or any other hosted service.
