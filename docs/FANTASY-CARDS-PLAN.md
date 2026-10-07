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

371 platform tests pass. Complete database run: 184/185 initially; the new manual-statistics test fixture incorrectly used an already-past competition creation time. After correcting only that fixture, all 17 fantasy tests pass. Static checks and optimized website build pass. The exact additive migration was dry-run, applied and RLS-verified on isolated Preview only; three synthetic tester accounts and genuine manager MFA are ready. Existing users, Edge history and production were preserved. Next: cross-client browser acceptance, screenshots, Preview delivery and native build/audit.
