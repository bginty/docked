# Startup repair delivery

Live at https://docked.com.au. Application commit `c1ce57cc9676b72983cc4a94b460e27ca115d183`, deployment `dpl_BPexDDbpyUjYHCvzBhdKLtP4JB8s`, promoted 23 October 2026. The live release endpoint independently returned the same commit and closed public registration.

The full authenticated shell could remain hidden behind the startup overlay even after the private-sport page had loaded. The ready signal now belongs to the identity-verified persistent shell. Private-sport routes also skip redundant NFL and wallet reads; capability requests are deduplicated and sport context is retained. See README for reproduction and implementation detail.

Checks actually run:

- 598 platform tests passed, including NFL, wallet/pack, loading, permission and routing regressions.
- 3 selected database tests passed: NFL seven-slot authority/lock/privacy and AFL/NRL private-sport admission/isolation.
- 28 full-shell browser scenarios passed at 412px and 1440px, including delayed responses, errors, denied access and return-to-NFL refresh.
- Existing NBA SQL-backed UI journey passed on mobile and desktop with roster fixtures: select players, Auto Select, dirty-team guard, save, enter Open/Salary Cap, collection filters and switch back to NFL.
- NFL and real-roster NBA pack tests passed at 360, 412, 1024 and 1440px, including purchase, reveal, failures, lost responses and retry safety. No serious accessibility violations in those checks.
- Typecheck, lint, clean Production build and client credential-canary scan passed.
- Candidate and live deployment: 19 HTTP access/release checks and 6 pack redirects each passed.
- Actual live domain: 20 signed-out mobile/desktop browser checks passed, covering pack routes, sign-in recovery and missing-page recovery without a stranded startup overlay.

No migration or Production member-data mutation was performed. Balances, ownership, scoring and admission policies were not changed. Rollback targets the captured application deployment; it requires no data rollback.

Verification limit: there was no available signed-in browser session. Browser inventory had no attached tabs, and creating an in-app browser tab timed out. Authenticated Production loading speed and pack purchase acceptance are therefore **not claimed**. Local SQL/browser fixtures are explicitly separate from hosted testing. Database state calls can still take several seconds; this repair removes confirmed unnecessary reads and the indefinite overlay rather than promising instantaneous data responses.

Reload an already-open Docked page once to load the new application code. No cache wipe, account reset or reinstall is required by this repair.
