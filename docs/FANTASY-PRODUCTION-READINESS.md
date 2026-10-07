# Fantasy Cards production launch readiness — 8 October 2026

**Production promotion stopped. No production deployment, database write, DNS change, payment or new paid service was made.** The user authorized launch subject to readiness and explicitly required stopping promotion for critical issues. The supplied release is `pivot/fantasy-cards-preview-v1` at `7de60d06e7c38cce96bd897ab5d869a24d6d06a1`; the branch and completed implementation are preserved.

## Current public website

`https://docked.com.au` responds HTTP 200 over verified TLS, but serves the existing GitHub Pages holding page, not Fantasy Cards. `https://www.docked.com.au` responds 301 to the HTTPS apex. The apex DNS A records are the four GitHub Pages addresses and www points to `bginty.github.io`. HTTP apex currently returns 200 rather than redirecting to HTTPS; www HTTP redirects to the HTTP apex. No DNS or redirect configuration was changed.

Production Fantasy deployment ID and deployed commit: **none**. The successful isolated Preview remains at `https://docked-preview-s24-briant-ginty.vercel.app`, deployed from `8801c702a9ce6b165d2009a6988eb5064aa9bbb3`; `7de60d06` added delivery evidence/native assets. These Preview results are not production acceptance evidence.

## Critical blockers and exact corrective actions

| Evidence | Why promotion is blocked | Corrective action |
|---|---|---|
| `src/core/fantasy.ts`, `src/server/fantasy.ts` | Fantasy rejects all production environments, requires the exact isolated Preview database and sets a test-credit-only transaction context. Simply promoting this build either disables Fantasy or would require bypassing isolation. | Implement an explicitly separate production mode bound to verified production identities. Preserve the Preview guard and test-data separation. Reuse the reviewed transaction functions/components through a production-safe context, with negative tests proving neither environment can read or mutate the other. |
| `supabase/migrations/20261007204317_fantasy_cards_preview_v1.sql` | This is a closed three-member test economy: expiring allowlist, Starter quantity three, fictional seeded catalog, test-credit grants and Preview-only prizes/results. It is not a production bootstrap or public-enrollment migration. | Prepare a reviewed additive production migration and clean catalog/issuance configuration. Import no tester accounts, inventories, ledger balances or results. Implement production enrollment and authoritative issuance with permanent edition caps, idempotency and transaction/race regressions. Preserve existing Edge data. |
| No approved production credit/acquisition model | The request excludes both artificial test balances and real-money processing. The current paid-pack and cash-style listing flows require test credits. | Define the production noncash acquisition/settlement rules before enabling those flows; keep credit grants, paid packs, buy/sell settlement and admin grant tools disabled until that model is implemented and tested. No real payments may be introduced without separate authorization. |
| `config/hosted-production.json` | Vercel project/team and Supabase project IDs are null. The accessible Vercel team has `docked-preview` but no Docked production application project. The connected Supabase tool exposes only unrelated Oura CRM UAT. | Identify and grant access to an existing, separate Docked production Vercel project and Supabase project in the intended organization/region. Populate the manifest with verified resource identities. Do not reuse Preview or Oura CRM. If new resources would be chargeable, obtain specific cost authorization first. |
| `scripts/prepare-production-environment.mjs`, missing `private-data/production/connection.json` and `operator.json` | Production secrets, least-privilege DB connection, operator identity and approved policy versions are not configured. Registration and auth email remain disabled in the preparation path. | Supply the real operator/policy details and production-scoped secrets through the existing private configuration flow. Verify TLS, least-privilege grants, auth email provider, signup rules, canonical site URL and narrowly allowed authentication callbacks before enabling registration. User launch authorization does not supply these missing facts. |

After those corrections: stage a production build without domain promotion; run signup/login/onboarding and production-safe card/pack/team/market/social transactions, ownership/provenance reconciliation, simultaneous sale/open races, permissions and private-endpoint denial tests. Verify desktop Chromium, Android and iPhone/Safari behavior. Then configure the Vercel-provided DNS targets, TLS and canonical HTTPS redirects, promote the tested build, and repeat the public smoke tests. Do not mark an untested production build ready based on Preview results.

## Checks actually performed this turn

- Read-only local release/configuration, Vercel inventory, public HTTP/TLS and DNS inspection: [readiness.json](qa/fantasy-launch/readiness.json).
- Existing production-isolation/auth/export/Fantasy regression run: **19/19 passed**, [readiness-tests.tap](qa/fantasy-launch/readiness-tests.tap). These verify the guards; they do not make this Preview a production release.
- Browser checks of the **existing holding page only**: desktop Chromium and Android Chromium emulation returned 200 with no overflow or JavaScript errors. iPhone WebKit was not run because its browser binary is unavailable. [public-browser.json](qa/fantasy-launch/public-browser.json). Device emulation does not establish native-device behavior.
- Production signup/login/onboarding, card ownership, packs, teams, marketplace and social end-to-end tests: **not run; no production Fantasy application or verified production database is available**.
- Existing Edge code and original infrastructure were unchanged. No claim is made that unavailable production backends were updated or tested.

## Barry's Android APK

- File: `artifacts/android/Docked-Preview-S24-v8-Fantasy-Cards.apk`
- Version: `1.7-preview`, versionCode `8`; package `au.com.docked.app.preview`; min SDK 24, target SDK 36.
- Size: **11,044,694 bytes** (10.53 MiB).
- SHA-256: `ae888b5cfc393ed2ee9e66b4e1c1566382d70888d9c41585d1d9afdd401b902e`.
- Fresh archive/security audit passed: 988 entries, no credential/forbidden-file findings, correct Fantasy branding and exact isolated Preview origin. APK signature verified. [Audit](qa/fantasy-launch/android-audit.json).
- This is the completed Fantasy build, not the previous Edge build. It still connects to the invited-testers Preview, not docked.com.au.

[Gmail blocks APK attachments](https://support.google.com/mail/answer/6590?hl=en), so the authorized fallback was prepared on existing Docked Preview Supabase Storage. A new private bucket holds only the verified APK; no project, paid plan, public bucket or permissive policy was created. Existing `storage.objects` RLS was verified enabled with no object policies. A signed download URL expires **11 October 2026 at 10:36:46 am Sydney time**. The signed download was fetched and its hash matched; unsigned public access was denied. The file-scoped capability URL is kept in ignored `private-data/fantasy/barry-apk-link.json`, not committed to Git. It permits anyone holding that link to download only this APK until expiry; it is not recipient-authenticated.

**Email not sent.** The authorized send to `barrydearing@gmail.com` with subject `Docked Fantasy Cards — Android Preview App` was attempted once. Gmail returned `400 FAILED_PRECONDITION: Mail service not enabled`. No send/message ID was returned. The connected identity's email is a Hotmail address; a working email mailbox connection is required. No retry loop or alternate unauthorized sender was used.

The prepared message is saved in ignored `private-data/fantasy/barry-apk-email.txt`, including the expiring download link and Android outside-Google-Play installation steps. The requested claim that Fantasy is live at docked.com.au was corrected to state that public launch is pending and provide the existing Preview URL. No passwords, administrator credentials or server secrets were included. Tester login must be supplied separately; public signup remains closed. Connect a working Outlook/Gmail mailbox and send this prepared message, or send it manually from the user's email client before the link expires.

Native limitation remains unchanged: an earlier v8 build installed and launched on a Pixel 5 emulator, but repeated Launcher/System UI ANRs blocked interactive testing. The final APK is built, signed and audited; full native login, keyboard/back handling, transactions and physical Samsung testing remain unverified.
