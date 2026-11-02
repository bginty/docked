# Australian launch acceptance — 2 November 2026

This report records the current release checks, rather than treating earlier Android TEST purchases as acceptance of a different backend. Owner approval of the commercial model and player-name position remains recorded. No new approval for those decisions is requested.

## Completed customer acceptance

The existing protected Preview uses Supabase `bckkllmndoxzpzdqrevb`, with Vercel deployment protection retained. The external-address test ran through the actual registration form, the automatic signed Supabase email hook and the existing Microsoft mail provider. Confirmation and password-recovery emails arrived in the authorised external Hotmail inbox. The customer followed the confirmation/recovery flow, reset the password, signed in and completed onboarding. This was not operator-relay email capture or administrator confirmation.

The same ordinary customer then selected free Core players, saved drafts, confirmed entries and opened Rankings for **NFL, AFL and NRL, in both Traditional and All-Star**. Traditional used the configured 4.4m/13.8m/8.2m caps. Six entries were saved, with zero collectible issuance, paid receipts or wallet credits. The verified roster-practice rounds are future, free and no-prize; they are clearly labelled practice configuration, not official league fixtures. Production public rounds remain unconfigured and private-beta rounds were not exposed.

Customer deletion returned 202 and immediately revoked access. Erasure uncovered and fixed a genuine defect: a hard Auth deletion conflicted with retained team-name/competition foreign keys. The worker now confirms irreversible Auth credential/metadata erasure while retaining the opaque referenced identity. The hosted disposable account has no password, identifying Auth metadata, active profile or sessions; all six competition entries and unrelated/financial records are unchanged. Retry produced one completion event, and old credentials return `invalid_credentials`. This retained reference is pseudonymous, not claimed anonymous.

Evidence is under `qa/final-australia-20261102/`: `external-ui-*.json`, `external-play.json`, `external-traditional.json`, `external-deletion.json`, `external-deletion-worker.json` and mobile/desktop screenshots. The hosted UI served commit `211cf3a1`; the corrected worker code was run against the scoped hosted fixture. That correction is committed as `6687394e` and is also deployed to protected Preview. The customer runtime and erasure correction have not been promoted to Production; the separate Production release below changes policy wording only.

Temporary Preview signup, exact-address mail admission, expanded fixture member capacity and mail secrets were restored/closed after testing. Authentication, MFA and Production email configuration were not weakened.

## Android and purchase acceptance boundary

Samsung `SM-S921B` was updated through Google Play to **versionCode 30 / versionName 1.29**, installer `com.android.vending`. The signed AAB remains unchanged; SHA-256 `d3837d7191e0a6bbd64a572a9ac3288fd37b440eb36e67408648fb4b3c879e29`.

| Google product | Australian price | Credits | Observed state |
|---|---:|---:|---|
| `docked_credits_4900_v1` / `buy-au` | A$49 | 4,900 | INACTIVE |
| `docked_credits_9900_v1` / `buy-au` | A$99 | 9,900 | INACTIVE |

The owner approved a temporary no-charge TEST window, but it was **not opened**. There was no new Google checkout, refund or pack opening in this run. Previous genuine ordinary-member TEST purchase/refund evidence remains valid for its earlier tested implementation; it is not relabelled as exact-v30 public-runtime acceptance.

**Remaining technical gap:** v30 pins `docked.com.au`. Production is now `f0eb28e7`, a policy-only update to `053848ed`; it does not include the new commercial customer runtime in protected Preview. That Preview deliberately denies commercial mutations; its commercial verifier rejects Google TEST receipts. Both protections must remain intact. Before the final phone journey, provide an explicitly isolated TEST adapter/runtime that uses the ordinary authenticated customer flow and the same ledger operations, then connect the Play-installed candidate to that authorised path. Activating products alone, accepting TEST in the live ledger, or crediting a genuine customer is not a solution. This is an engineering/deployment acceptance gap, not a missing device or new commercial-model decision.

## Regression actually executed

| Check | Result |
|---|---|
| Fresh complete platform suite, including erasure repair and migration drift guards | 723 passed; 0 failed/skipped |
| Complete database suite | 234 passed; 0 failed/skipped |
| Typecheck | Passed |
| Lint | Passed; targeted migration-tool lint also passed |
| Production application build | Passed |
| Commercial/retention secret-canary build | Passed; canaries absent from 96 browser assets |
| Staged source credential-pattern scan | Passed; no credentials printed |
| Hosted external registration/recovery/gameplay/deletion | Passed with the scope above |
| Hosted read-only wallet / receipt denial / NBA denial | Passed |

Logs and machine-readable evidence are in `qa/final-australia-20261102/`. NFL/NBA regression coverage passed; NBA remains hidden and no NBA data was removed.

## Production migration approval

The owner approved both exact files in `REMAINING_DORMANT_MIGRATIONS_20261102.md` on 2 November. Both committed at 07:27 UTC: `20261102011703_commercial_retention_controls.sql` and `20261102023100_commercial_social_inventory.sql`, with unchanged approved checksums. Fresh backup/rehearsal preserved 545 durable table fingerprints. The application transaction preserved all 330 protected table fingerprints and existing core RLS/grants; all activation gates remained off. Evidence is in `qa/final-australia-20261102/restore/` and `migrations/`. The approved activity is dormant schema/function changes only.

The three prior commercial/public-gameplay migrations remain applied and are not rerun. Wallets, ownership, serials, historical results, schedules and activation flags are protected by the transactional comparison. Retention periods, key custody and worker activation are separate decisions.

Independent post-commit verification at 07:28 UTC matched all **326** protected durable table fingerprints, including wallet, ownership, historical and schedule-definition records. The four scheduler/telemetry tables that continue changing were included in the 330-table transactional check and excluded only from this later readback. Recorded migration hashes match the approved files; retention, commercial settlement, public registration and public competitions remain disabled.

## Policy and separate commercial gates

The approved v2 wording is **LIVE** in one-file Production release `f0eb28e7a6f9621574399e894aadbef20ff25cdd`, deployment `dpl_6kKiZfN6qcin6HFJ3psRLs2qeakv`. Its only change is `config/launch-policy-content.json`, with the approved SHA-256 `9655ebb36bd5410ff07e18001d26c999ab51d4f85345252aab9ca9b293e89b93`. It changes no application behaviour or activation flag. `/privacy`, `/refund-policy`, `/retention` and `/commercial-policy` all returned HTTP 200 and the expected version in an actual mobile browser; no horizontal overflow was measured at 390px. Desktop privacy was also rendered at 1440px. `/account-deletion` remains available. Evidence is in `qa/policy-publication-20261102/` and `qa/final-australia-20261102/policy-rendered.json`. Remaining decisions concern operational retention authority/key custody, finite purchase-reference/replay retention, and actual provider log/mailbox/backup settings. They do not reopen the approved wording, prices or commercial model.

The evidence-backed rights and Australian assessment remain in `LAUNCH_RIGHTS_AND_CLASSIFICATION_DECISIONS_20261102.md` and `COMMERCIAL_RIGHTS_MATRIX_20261102.md`. Player-name use is owner-confirmed. Original jerseys do not use player photos, league/team logos or sponsor marks. Unlicensed proprietary statistics feeds remain disabled. Source attribution/ShareAlike requirements still apply to adapted roster data.

The specific unresolved commercial assessment concerns the combined paid-chance packs, rarity gameplay advantage and transferable closed-loop card value, including any secondary market; recovery-hold wording must preserve Australian consumer remedies. No enabled cash-out, paid entry or real-world prize is assumed. The Australian **M** classification is recorded; it is not a gambling-law opinion or Google approval. Do not silently remove paid packs or activate commercial transfers to resolve a declaration.

## Google Play and promotion sequence

The Console was inspected read-only: Australia-only, M, target 18+, managed publishing **ON**, ten changes saved and **not submitted**. The existing v30 release draft, reviewer instructions and declarations remain. NBA is excluded. No new agreement or attestation was accepted.

1. **DONE:** both approved dormant migrations applied and verified. Retention cleanup remains disabled.
2. **DONE:** exact v2 wording approved, published and rendered on Production. The previous content/version is retained. No account consent was fabricated or rewritten.
3. Resolve the isolated v30 customer TEST runtime path and complete A$49/A$99 checkout, nine-card opening, duplicates, refund-before/after-spending and genuine durable notification reconciliation. Deactivate both purchase options immediately after the approved test window.
4. Promote the reviewed application/configuration only after that acceptance. Prepare public practice rounds using the verified roster configuration and sport caps; retain all historical private-beta competitions. All public/customer/payment activation flags remain off during promotion checks.
5. Complete the scoped rights/platform/consumer-law requirements and accurate Console review. Apply the existing conditional submission authority only when every mandatory gate is verified; managed publishing remains on.
6. Public registration, live products, settlement and publication remain final gated actions. Withdrawals, paid competition entry, prizes and NBA remain disabled.

Application rollback returns to the recorded previous deployment. Dormant additive tables remain; never restore an old full database over new customer transactions, delete audit records, or replay completed purchase fulfilment as a rollback.

**Public launch: NO-GO.** Hosted onboarding is now evidenced and policy publication is complete, but final native billing acceptance, operational retention decisions and the scoped external commercial/platform requirements remain. No Google submission, approval or app publication is claimed.
