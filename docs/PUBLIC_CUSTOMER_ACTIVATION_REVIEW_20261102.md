# Public customer gameplay — additive activation review

**2 November application update:** all three named dormant migrations are now applied to Production under the owner's explicit approval. See `qa/approved-production-20261102/apply.json` and `post-migration.json`. Public programme/sport flags remain false, rounds empty and registration closed. This supersedes the earlier migration-approval-pending status below; activation and isolated hosted acceptance remain separate requirements.

Prepared 2 November 2026. Owner commercial-model approval is recorded in `OWNER_COMMERCIAL_APPROVAL_20261102.md`; it is not awaiting another business-model decision. This document does not establish external rights or enable any live feature.

Latest continuation: `PUBLIC_ACTIVATION_GATE_20261102.md` records the successful encrypted Production restore, three-migration compatibility/reapplication test and saved Google Production release draft. Submission is conditionally owner-authorised after mandatory gates pass; specific application approval for the three dormant migrations remains pending.

## New migration and dependencies

Apply only after the separately prepared `20261101120754_commercial_google_ledger.sql` and `20261102010000_commercial_lineup_inventory.sql`:

**`20261102010001_public_customer_gameplay.sql`** adds an empty private public-access programme, visible-sport controls and immutable round bindings. All switches default off. It seeds only the three disabled sport identifiers NFL, AFL and NRL. It neither rewrites historical competitions nor creates a wallet, card, entry, prize or customer account.

The existing lineup engine is reused at its authenticated actor, scope, inventory and fixture boundaries. Existing private-beta callers continue through the original functions. Salary, positions, duplicate-player rules, ownership, reservations, locking and saved rarity snapshots retain their existing authoritative implementation. Public free Core is projected eligibility, never collectible issuance. The member has an ordinary confirmed Auth session and no beta allowlist grant; staff still require MFA.

The new endpoint rejects a caller-selected identity, unsupported sport, mismatched competition and stale/ineligible account. Its SQL entry points require current Australian adult eligibility, current privacy/terms consent, unexpired regional approval, an enabled programme and an exact saved competition binding. Browser roles have no schema access. The restricted application role has guarded entry points, not direct table access or activation privileges.

## Configuration required before any public activation

1. Record the applicable approved AU state/territory policies, review dates and external evidence. The current implementation supports an 18+ attestation, not proof of a higher age. Configure community/profile features explicitly: gameplay approval alone does not authorise community access.
2. Publish approved immutable Terms and Privacy versions, set matching server consent versions and the public programme versions, authority and expiry. Never relabel the existing beta consent.
3. Approve a verified eligible roster and fixtures for each sport. Bind **new, future, unentered** free/no-prize rounds using `public_access_policy=au-adult-free-play-v1`, `free_core_policy=public-free-core-v1`, `entry_fee_credits=0` and `lock_policy=round-wide-v1`. Include `commercial_inventory_policy=commercial-owned-v1` only for separately enabled eligible paid inventory. Preserve actual saved sport scoring/configuration versions. The round row uses the MD5 of saved JSON solely to detect configuration drift, not as a security signature.
4. Label practice fixtures as practice. The local acceptance uses clearly synthetic players and no scores; it is not verified sports-data coverage. Missing statistics remain awaiting statistics. No synthetic result is imported into Production.
5. For read-only commercial wallet/collection presentation, provision the reviewed restricted commercial runtime and encryption/account-binding keys, then use the existing service/surface flags. Wallet reading does not require a Google OAuth call. Checkout, issuance, transfers and Google products have independent disabled gates. A verifier credential failure still rejects purchase verification.
6. Set `DOCKED_PUBLIC_CUSTOMERS=true` only on the protected candidate under review, with `DOCKED_BETA_STAGING=false`. Public and private-beta identities/programmes are not interchanged. Keep registration switches and Google checkout off until exact hosted acceptance and the final activation gate.
7. Verify the ordinary customer journey on the exact protected deployment and Android release. Complete named migration approval and all mandatory release conditions before application promotion/public registration. Conditional submission authority is already recorded. Do not enable NBA, paid entry, withdrawals or prizes.

## Recovery

Before Production migration: capture an encrypted database/application backup, function definitions/grants, policy/flag settings and protected-record checksums, and prove restore in an isolated target. Existing local fixtures are not a Production restore drill. Apply the three named migrations explicitly in order, not a blanket push. Verify default switches, row counts and history afterwards.

Disable the public programme/sport flags and registration to stop new access, and restore the prior application alias if required. Keep commercial refund reconciliation and customer support available. Never drop ledgers or restore an older balance over newer receipts. The migration retains original lineage in `_before_public` functions; any function rollback must be a reviewed change with saves/transfers quiesced. Do not erase public entries or historical snapshots as rollback.

Production read-only check **2026-11-01 21:55:48 UTC**: PostgreSQL 17.11, registration false, both new schemas absent, all three migration identifiers absent. No Production migration or activation occurred during this work.

## Isolated acceptance boundary

`scripts/public-customer-local.ts` permits only loopback Supabase Auth/API/database, with local captured email and no external notification transport. The restricted application and commercial read roles are separate. Local regional approval text explicitly says it is synthetic acceptance, not regulatory evidence. Fixture credentials remain in ignored private files. This fixture is never a hosted/public configuration source.

The final handover records actual test and rendered-page results separately. Local tests do not establish genuine Google commercial settlement or physical-device acceptance.
