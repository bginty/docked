# Production release — 21 October 2026

User authorised production deployment with “deploy”.

- Web commit: `5f9093df0893b68798d944fe1806d1dd018d2697`.
- Deployment: `dpl_2qtATUwWQdeFrTyhKgcJ7Rot7mvu`, READY, production, Sydney runtime.
- Both `docked.com.au` and `www.docked.com.au` resolve to this deployment.
- Previous deployment retained for rollback: `dpl_GN5g1UW7Lbg1gKAQaUGujAjD9Jcp` (`475691a6b28a03c5ff5bb599d8b4cd15e4016043`).

Staged with production configuration and no automatic custom-domain assignment. Verified production release identity and sign-in protection before promotion. After promotion, `/api/beta-release` returned 200 and the exact commit/deployment above, public registration disabled and invited authentication enabled. Play returned the branded “Please sign in again” state without a session. Rankings returned 200; the protected standings API returned 401. `/api/status` returned 200. Verification completed at 2026-10-21 00:16:51 UTC.

No scoring backfill, ruleset edits, finalisation, entry edits, ownership changes or wallet mutations were performed by this deployment. Week 6 retains its saved half-PPR scoring rules. Authenticated member gameplay on production remains a separate acceptance check from these unauthenticated smoke checks and the previously passed isolated browser/database tests.
