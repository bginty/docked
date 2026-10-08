# Fantasy Cards Preview V1 — audit and implementation plan

Checkpoint: `checkpoint/pre-fantasy-cards-preview-v1`; branch: `pivot/fantasy-cards-preview-v1`. Starting checkout was clean. Production is not a target.

## Existing architecture and reuse

Next.js 16 / React 19 App Router, TypeScript, PostgreSQL via postgres.js and Supabase Auth SSR. Reuse verified identity, confirmed-email and live-session checks, private database roles, deployment identity/TLS guards, same-origin checks and rate limiting. Profiles remain `public.profiles`; social identities remain `private.social_profiles`. Existing Feed/Following, likes, comments, block/mute/privacy, reporting and moderation stay in place. Existing recognition and Points remain historical; fantasy championship results have a distinct immutable ledger.

Navigation currently exposes Edges, Feed, Following, Points and My Edge. Adapt the existing shell for a server-enabled fantasy Preview, with Play, Cards, Market, Social and Profile. Preserve legacy research routes and all odds/model workers, schemas and history. Existing PWA and Capacitor Android bridge, safe areas, keyboard behavior, package identity, signing and build pipeline remain.

Database changes use additive versioned migrations. Existing private schemas have RLS and revoked browser access; sensitive community operations establish verified transaction-local claims. Tests include node:test platform suites, PGlite PostgreSQL migrations/security tests and Playwright. Vercel is already guarded and linked by `config/hosted-preview.json` to a separate Supabase project; production has a separate manifest. No production database migration, deployment, DNS change or payments are authorized.

## Implementation order

1. Review foundations before dependent features. Closed fantasy member allowlist (maximum three active members), server-only Preview gate, immutable edition/card identity and provenance, balanced test-credit ledger, transactional operations. Revalidate live session after locking. Prefer correctness over throughput for three testers: serialize fantasy mutations with one transaction advisory lock; lock time uses wall-clock time.
2. Server-generated, persistent pack outcomes; starter position guarantees; no supply increase or duplicate serials. Atomic settlement and multi-card trades. Prevent transfers of cards committed to an unresolved locked lineup. Unlocked lineups must be validated again at lock/result time.
3. Configurable competition formation/tier/first-year rules, versioned scoring, deterministic fictional stats, immutable results and championship awards. Retired cards persist; replacement eligibility is single-use.
4. Reuse shell/auth/social components; build collection, packs, team builder, market, wallet, profile and secure admin. Test-credit-only copy throughout.
5. Database adversarial tests, three-member acceptance, typecheck/lint/build and responsive browser checks. One bounded final read-only integrity review, fixes and regression tests. Preview deployment only after integrity checks pass and its target is verified.

## Brand inventory

Existing `source-assets/brand/docked_production_brand_pack`, central brand map and canonical PNG are available. Requested `DOCKED-Website-Mobile-Kit`, START-HERE.md, ASSET-MAP.md, asset-manifest.json and PREVIEW.html were not found in the repository inventory. Continue using inspected existing logo assets; do not fabricate replacement artwork. Record final search scope, assets and limitations in BRAND-INTEGRATION.md.

Resolved: the user identified the Desktop kit. Its supplied updated assets are integrated as described below and in BRAND-INTEGRATION.md.

## Review budget

Main chat cannot switch its own model/effort through the available tools; do not claim Astra Medium was selected. Foundation reviewer explicitly requested as `gpt-6-astra` / `high`, read-only, no nested delegation. Final review is bounded to at most three topic reviewers, High or Extra High. Ultra is optional and will not be used if the runtime cannot enforce the requested constraints. No repeated full audits.

## Website/app parity steering — incorporated 8 October 2026

Continue the same branch and preserve all completed/uncommitted work. The existing Android Capacitor shell loads the same Next.js application over the isolated HTTPS Preview origin. Browser and Android therefore share accounts, server APIs, database transactions and all authoritative fantasy/social data. No duplicate website inventory, wallet or accounts will be created.

Provide a branded Preview public homepage explaining fictional players/test credits with the approved tester login route. Member workspace must work directly in desktop and mobile browsers, with Play/Cards/Market/Social/Profile and responsive wide-screen layouts. Verify mobile pack opening -> desktop cards, desktop lineup -> mobile lineup, desktop listing -> second-account mobile purchase, balances/provenance and trade/social consistency. Run real multi-connection database races separately from browser emulation. Physical Android testing, emulator testing and browser viewport checks must be reported distinctly.

Desktop brand kit located at `C:/Users/61412/Desktop/DOCKED-Website-Mobile-Kit`; START-HERE, ASSET-MAP, manifest, gallery source and actual selected artwork inspected. The earlier missing-input note is resolved. Source artwork remains unchanged; only required runtime assets imported.

## Current checkpoint

Shared functional website and Android remote-shell implementation complete. Foundation review ran on Astra High. One bounded final review ran ownership on Astra Extra High, wallet on Astra High, fantasy on Astra High; all read-only with no nesting. No Ultra was run and the main model was not switched. Pack reservation, retry-idempotency and lock/formation findings were investigated and fixed; configurable duplicate-player competitions are intentional, while defaults prohibit duplicates.

Completed: 373/373 platform tests and 185/185 database tests pass. Typecheck, lint, optimized website build and guarded hosted deployment pass. The exact additive migration was dry-run, applied and RLS-verified on isolated Preview only; three synthetic tester accounts and genuine manager MFA are ready. Existing users, Edge history and production were preserved.

Three-user cross-client acceptance passed 74 recorded assertions, with four additional social checks and 13 live database integrity checks. All five tabs passed 30 responsive layouts; five mobile automated WCAG checks had no violations. Public-only offline caching and supplied metadata branding passed on the final deployment. The Preview homepage and workspace are live; delivery URLs, credentials route, screenshots, migration/security details and actual review settings are in FANTASY-CARDS-DELIVERY.md.

Android v8 builds and passes the APK security/branding audit. Installation and activity launch were verified on a Pixel 5 emulator before the final delivery rebuild; interactive native testing remains unverified because Launcher/System UI repeatedly stopped responding. No physical Android device was connected. Browser emulation is separately reported and is not claimed as native testing. No unresolved critical integrity failures were found. No production deployment, production database write, DNS change, real payment or public release occurred.

## Production launch request — 8 October 2026

The user subsequently authorized public production launch and APK email delivery, conditional on readiness. Production promotion is stopped: the delivered application is explicitly Preview-only, no separate production application/database identity is configured, and production enrollment/economy rules are not implemented. No isolation or release safeguard was bypassed. The current public domain remains the GitHub Pages holding page. Full findings and exact corrective actions are in FANTASY-PRODUCTION-READINESS.md.

The Fantasy v8 APK was freshly audited and a private 72-hour download link was prepared on existing Preview storage. Email to Barry was attempted once but rejected by Gmail with “Mail service not enabled”; no delivery is claimed. Prepared email/link remain in ignored private-data/fantasy for sending through a working mailbox. Production and DNS remain unchanged.

## Autonomous free-play production checkpoint — 8 October 2026

The subsequent free Starter/daily reward authorization is implemented locally on this same branch. Separate production SQL entry points, immutable account/UTC-period claims, finite edition stock, MFA stock/round administration and shared responsive UI preserve the completed Preview. See FANTASY-PRODUCTION-PLAN.md and FANTASY-PRODUCTION-HANDOFF.md for implementation, tests, actual review configuration and remaining live gates.

Created only the empty, separate `docked-production` Vercel project on the existing Hobby team; no deployment or domain change. Production Supabase, real Auth mail/consent configuration and live concurrency/production smoke checks remain blocked. The holding page, three-tester Preview and Edge infrastructure/data remain unchanged. Barry's hash-verified v8 APK and ready-to-send `.eml`/`.txt` are now on the Windows Desktop. Browser automation cannot initialize, so no email was sent this turn.
