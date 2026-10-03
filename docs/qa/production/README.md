# Production preparation and storefront retirement

Prepared 4 October 2026. The old storefront is retired and the branded transition page is live. The new application's full production release remains pending resource, hosting, operator and account-delivery inputs. See [retirement acceptance](retirement/README.md) and the [release runbook](../../PRODUCTION_RELEASE.md).

## Scope and findings

- Added an explicit, initially unapproved production resource manifest, build/runtime isolation and a committed-source export. Preview and unrelated Supabase projects cannot be used as production. Provider polling, official publication, forward paper, external notifications and commercial activation stay closed.
- Separated transactional Auth readiness from optional notifications. Signup now requires explicit Privacy consent on both entry paths; production policy versions must be approved. Existing Auth identities cannot acquire another signup's profile or consent. A reserved-handle race preserves the new account's consent and defers its username to onboarding. Uncertain cross-service failures return a repair-required state without deleting an ambiguous Auth identity.
- Production presentation no longer shows Preview invitations or claims account email was sent while disabled. Operator facts come from explicit configuration. The homepage uses current tip status and published CMS content. Unknown anonymous jurisdiction does not imply the visitor is restricted. PWA startup uses the account gate while preserving the installed identity.
- Prepared a restricted database role and a bounded community maintenance runner. The existing general worker would encounter publishing permissions before account-erasure retries; community maintenance must operate separately. No new hosted role, migration, worker schedule or account was activated.
- Actual Docked Preview catalog inspection revealed managed Auth ownership and grant restrictions absent from the original embedded test schema. The migration now uses narrow private Auth projections owned by the migration role; it does not change managed Auth ownership, policies or grants. The tests model a separate managed Auth owner, RLS and a non-superuser migration role. A session expiring while waiting for the policy lock is checked again after the lock. The [catalog evidence](supabase-auth-catalog.json) contains metadata only.
- The newly supplied sensitive Preview Odds API key exposed an overly strict storage guard. Inert credentials are now permitted only for the canonical Preview with `MARKET_DATA_POLLING_ENABLED=false`; positive or missing activation flags remain rejected. That explicit Preview-only false flag was created and verified without retrieving the API key. No provider request or redeployment was performed by this configuration change. See [receipt](preview-polling-closed.json).

## Verification boundary

Application verification is local and uses isolated fixtures. An optimized Next.js build is not a Vercel production deployment. Local PostgreSQL tests are not genuine production Supabase acceptance. No real email, sporting-data request, research evaluation, mobile production release or paid upgrade is implied.

The final full platform suite passed **259/259** and the full local PostgreSQL suite passed **126/126**, with no skipped tests. The initial database run had three failures in an isolated recognition adapter that lacked the new fixed Auth-relation fragment support. The adapter was repaired without weakening the assertions; both the failed run and focused 3/3 rerun are retained. See [platform results](platform-results.tap), [database receipt](database-results.json) and [database results](database-results.tap). The dependency audit found **zero vulnerabilities**.

The complete integrated browser suite passed **79/79** with no retries. It used an isolated optimized build with hosted credentials blanked and external fetches blocked, covering public gates, Auth forms, app navigation, social fixtures, mobile keyboard/safe areas, accessibility and responsive layouts. The local hydration suite passed **2/2** against the actual rendered Auth form with an intercepted fictional endpoint, without real credentials or delivery.

A separate production-header projection found a 320px overflow from the longer closed-registration label. The compact **Accounts** label preserves the existing destination and availability logic; the full hero label remains descriptive. The final optimized rebuild passed, and its **three actual-header projection checks passed** at 320/390/1366 pixels with no overflow, overlap, Axe violations or console errors. Mobile controls retain at least 44px height and 24px width; desktop inline controls satisfy the checked target-spacing condition. Initial overstrict test assumptions and the original overflowing screenshot/geometry are retained in the web regression evidence. The final total is **82 integrated browser cases plus two standalone hydration cases**, verified in the recorded runs; the 79-case broad run preceded the label-only change, and the focused three used the rebuilt final source.

The desktop spacing assertion follows the [W3C target-size spacing exception](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), using conservative enclosing squares. This targeted check is not a claim of complete WCAG certification.

Final build ID: `cKNo4yyY_hO4MjaFIHLUx`. All six documented server credential canaries were injected into the isolated build; `check:client` passed across **50 browser assets**. Type checking and full lint passed after the application change; the final test-only spacing correction was checked separately.

An initial actual-value credential scan checked 3,639 tracked/unignored source files and 161 public/browser assets with zero matches, findings or errors. That initial build did not inject canaries; its receipt is retained. The final source audit checked **4,043 tracked/unignored files** for configured local Preview credentials and the authorised CLI token, and verified all **426 export hashes** before scanning the committed web export for actual values and credential patterns. The final browser/public audit checked **161 assets**, with no findings or errors. Values were never emitted. The newly supplied sensitive Vercel Odds API key was never retrieved, so its actual value is explicitly outside these comparisons. See [final source/export receipt](final-source-secret-audit.json) and [final browser/public receipt](final-browser-secret-audit.json).

Three isolated production-presentation browser cases passed at 320/412/1366 pixels, with no API requests, Axe violations, overflow or console errors. [Presentation evidence](../../qa/production-readiness/PRESENTATION.md) preserves its initial harness-only failure and corrected result.

## Outstanding external work

The owner must resolve the pending dedicated Supabase project cost acknowledgement, paid hosting choice, verified operator/support details and approved policies. Production registration additionally needs transactional SMTP/sender configuration, ordinary regional authority and genuine hosted lifecycle acceptance. Website DNS cutover follows acceptance of the new application. The transition page remains the public fallback; the retired storefront must not be restored.

## Source provenance

- `b14c3a9`: permit inert stored Preview provider credentials only with explicit polling disabled.
- `1e2991624125aaea413515c30d3be9b0460533cb`: production isolation, restricted database/account runtime, presentation and release tooling; regression coverage included.
- `baf3c87611eee8f45ca08ad3649242739b1f1a34`: separate static storefront retirement on `main`; not a new-app production release.

The reviewed application export contains 426 allowlisted files from `1e29916`, prepared locally for Preview. Production export remains blocked by the unapproved resource manifest. The public holding page and existing stable Preview were independently healthy at [the recorded check](final-hosting-status.json); that receipt distinguishes their different source commits.
