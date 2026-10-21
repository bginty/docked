# Protected Preview deployment — 22 October 2026

The isolated multi-sport Preview is deployed and READY. Production was not deployed or modified. No new live sport, licensed feed, real card issuance, credit award or prize campaign was activated.

## Deployment

- Application revision: `b7fba5a5652e19b5b249523030108c8375f6bf49` on `codex/member-platform-updates`.
- Deployment: `dpl_48iruevtxpfvQewW8WuSLPLhY2op`.
- Canonical entry: https://docked-preview-s24-briant-ginty.vercel.app/app/sports-preview
- Vercel project: `docked-preview`, `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`.
- Supabase project: `bckkllmndoxzpzdqrevb`.
- Existing deployment protection remains enabled. Canonical alias assignment and READY state were checked after deployment.
- Previous canonical application deployment: `dpl_4qvuSUiN9w1tzuAfCREGiWKP1dW1`. Reassigning it is an application-only rollback, not a database rollback.

## Barry's setup

A separate Preview invitation was generated for the owner-confirmed existing testing email. No invitation email was sent, invitation consumed, email automatically confirmed, password chosen or MFA enrolled on Barry's behalf.

The private forwarding instructions are in `private-data/multisport-release/Barry-private-setup.md` (excluded from Git). Barry must open the temporary protected-access link, follow his one-time invitation in the same browser, choose his separate Preview password and enrol MFA. Do not publish these private links. Access expires and may need regeneration if not used promptly.

Access is limited to the exact configured tester identity, verified email, real authenticated session and MFA, with an independent database allowlist. General admission remains closed and no administrator role was granted. The dedicated tester route does not expose the owner dashboard.

Twenty-four fictional season-2099 rounds and 58 sandbox inventory records cover AFL, NRL, NBA and EPL. These records are isolated fixtures, not member assets or published competitions. AFL has 22 lineup slots; proposed formats and live activation requirements remain clearly labelled. No lineup was automatically submitted for Barry.

## Migration execution and reconciliation

Fifteen migrations were applied, from baseline `20261018234525` through `20261021230000`. The first fourteen were intended as a rollback rehearsal, but legacy migration `20261019113000_future_week_private_drafts.sql` contains its own COMMIT. This persisted the chain during that run. A subsequent explicit apply correctly refused the changed baseline, preventing duplicate application. This was confined to the authorised Preview target and was disclosed during execution.

This was **not a successful rollback rehearsal**. A private pre-run row/function snapshot and a read-only comparison of 479 prior tables were used for reconciliation. Existing rows in 478 tables were preserved; the expected remaining change was the disabled weekly Core legacy cutoff control. Existing wallets, cards, ownership, transactions and entries were preserved. New account and fixture rows are itemised in `hosted-data-verification.json`. No fresh pg_dump restore rehearsal was completed.

The final tester migration and fixture provisioning ran in a single checked transaction without embedded transaction control. An initial fixture constraint rejection rolled back; the corrected fixture transaction completed. `migration-applied.json` retains the refused duplicate-apply diagnostic, not the final database status. The authoritative final reconciliation is `hosted-data-verification.json`.

## Checks

- 541 platform tests passed, none failed or skipped.
- 13 targeted Preview authentication and multi-sport SQL tests passed.
- 12 additional NFL continuity and Preview authentication regressions passed.
- Typecheck and zero-warning lint passed; hosted production build completed READY.
- AFL browser journey passed at 360, 412, 1024, 1440 and 1536 pixel widths, covering draft, entry, rollover, manual changes and historical state.
- Actual hosted login hydrated without horizontal overflow at 412 and 1440 pixels. Mobile login and local AFL field screenshots were visually reviewed.
- Hosted unauthenticated sandbox request: 403. Public signup attempt: 403, without creating an account.
- Invitation GET: 200 with confirmation UI; invitation was deliberately not consumed.

Hosted evidence: `hosted-browser.json`, `hosted-login-412.png`, `hosted-login-1440.png`. Local field evidence: `afl/field-412.png` and related viewport captures.

## Remaining verification and activation limits

Barry's authenticated hosted journey remains unverified until he completes his own email confirmation, password and MFA setup. Local acceptance is not a substitute for that check. No physical iOS or Android device acceptance is claimed.

Live player data licensing, approved sport-specific scoring/configuration, issuance and live competition activation remain separate decisions. This release provides an isolated testing environment and does not imply approval or completion of those live dependencies.
