# Protected Preview preflight — 22 October 2026

Deployment requested for Barry. No Production deployment or new live sport
activation is included. Browser access was explicitly requested by the owner.

## Confirmed through signed-in Supabase UI

- `Docked Production` organisation `otldyeunbqabbcjydjpe` contains the live
  project `pojoymtniryarxxunyvz`; it is not the sandbox destination.
- `Docked` organisation `ernfnkcbalhyqpsrzdwa` contains **Docked Preview**,
  project `bckkllmndoxzpzdqrevb`, which is healthy.
- Latest recorded migration is `20261018234525_premium_member_release`.
  The new `sports_feed.sport_rounds` relation is absent. Fourteen later repository
  migrations require dependency/precondition review before applying this revision.
- Eight Auth accounts exist. No Barry account was identified. The only existing
  administrator with verified MFA is an isolated fixture account. No account,
  role, MFA setting or admission record was changed or copied from Production.
- Only SELECT queries were executed. A query tab remains in the dashboard;
  no migration, data mutation or new hosted fixture was executed.
- The connector still reports permission denied for this project. Signed-in
  browser access succeeds; the project itself is not unavailable.

## Confirmed through Vercel connector

The existing **docked-preview** project is `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`
in team `team_tf6xweKKyVCj9bTppUKttJ4l`. It has SSO protection for all deployments
and password protection. Preview-scoped configuration exists. No setting changed.

## Deployment compatibility fix

The multi-sport guard previously delegated only to the legacy fantasy harness,
whose hosted binding accepts a postgres database user. The protected Preview
contract correctly requires `docked_beta_app` and disables that legacy feature.
The sandbox now accepts the existing exact-target private Preview guard, while
retaining the legacy path for local tests. It does not enable admission, email,
issuance, live competitions or any role grants. Privileged hosted database users
and Production are still rejected. Four targeted environment tests passed.

## Remaining release steps

1. Review the fourteen pending migrations against the actual Preview baseline.
   Preserve their preconditions, especially existing pending offers; do not
   cancel or rewrite them to force a migration through.
2. Obtain Barry's intended Preview email. Prepare narrowly scoped sandbox tester
   admission and verified MFA; do not grant general administration as a shortcut.
   Current private Preview configuration deliberately keeps admission closed.
3. Review and apply only isolated fictional fixtures and required migrations.
   Do not copy Production accounts, cards, wallets or competition results.
4. Configure the reviewed Preview identity and capability contract, deploy the
   exact committed revision, and verify sign-in, MFA, denial cases and the actual
   AFL journey before handing Barry a usable URL.

No deployment has been performed. Local acceptance from the earlier handover is
not evidence of hosted authentication or Barry's access.
