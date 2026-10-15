# Premium Social live beta release — 16 October 2026

The owner explicitly requested the existing live Docked site instead of the isolated Preview. This uses the existing admitted accounts, authentication and member data. Preview owner setup is not required for live access.

**Released:** https://docked.com.au/app. Both apex and www point to READY deployment `dpl_2NiphnUtRyiWiDK8xEru76LViwLX`. Application revision: `9dba5a2a2bff181670dbbc673cd908eefb77d487`. Target: `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, existing Supabase `pojoymtniryarxxunyvz`. Nine candidate checks and nine live checks passed; receipt: `qa/social-live-release/live.json`. Isolated Preview was not promoted or rebound to live data.

The application includes the completed premium Social homepage, profile-image crop/review flow, member discovery, collection privacy and communities. Existing fantasy gameplay, card design, pack opening/replay and wallet behavior are retained. Private offers remain non-settling on hosting. The final deployment explicitly sets `DOCKED_TEST_MARKET_READ_ONLY=true`: listing/buy/offer/accept commands are paused; reading and cancellation remain available. Pack purchases and fantasy entries are unaffected. Real money, cash redemption, real-document collection and public registration remain disabled.

## Verification

- 383/383 platform tests passed; 158/158 database tests passed in one uninterrupted run.
- Typecheck and full lint passed. Final release-helper lint also passed.
- The same application source previously passed a clean production-mode build and client canary check; this release additionally requires the hosted production build to succeed.
- Read-only live account checks confirm Owner, Barry and Luke are verified, admitted and enabled for gameplay/test wallet. MFA is required only for Owner. No authentication reset or new invitation is required.
- Actual restricted-role catalogue read: 986 rows in 650 ms under a five-second deadline. No direct Auth-schema access; all four new Social tables are available to the restricted application role.
- Live sign-in browser checks passed at 1440×900 and 412×815: form visible, no horizontal overflow. Screenshots: [desktop](qa/social-live-release/login-1440.png), [mobile](qa/social-live-release/login-412.png). No credentials were entered.
- Existing local browser evidence remains in [the Social visual handover](SOCIAL_VISUAL_PREVIEW.md), including desktop/mobile screenshots and profile-image behavior. It is not described as new hosted member acceptance.
- Nine raw secret-scan matches remain: eight fixture/generated values and the previously revoked obsolete APK capability. The changed test-fixture hash was reviewed: only two imported fixture paths were added. No new finding paths or scanner exclusions; the capability is absent from tracked source. This is not a clean raw scan.

No member session was impersonated, and no hosted purchases, pack openings, social posts, grants, team entries or other member transactions were used for QA. Physical S24 acceptance remains pending.

## Database and recovery

Applied in order and atomically:

1. `20261015131955_premium_social_collections.sql`
2. `20261015140207_premium_social_runtime_guards.sql`

Exact migration hashes match the independently rehearsed Preview migration chain. Before application, all 365 existing application tables were saved privately and the backup read back and hashed. Every pre-existing column value remained unchanged after migration. The backup covers application tables, not Auth/storage disaster recovery. Details and digest: `qa/social-live-release/migration-applied.json`.

Three historical isolated simulation/feed migrations are absent from the live history. They were explicitly excluded, not silently marked applied or replayed; the live feed dependencies already exist. No sporting-data collection, scoring or scheduler configuration was changed.

Rollback: `dpl_8fp6iXZZ9YtAx5QptNwsJ1bi5rg2` for both live domains. If needed, restore that application deployment and retain the compatible additive schema. Never overwrite later ledger, inventory, team or social records with the pre-release backup.

Initial verifier retries: the schema audit first rejected the three historical omissions before they were reviewed; no migration ran on those attempts. One read-only runtime diagnostic used an invalid parameterized SET statement; it was corrected to set_config and passed. The older security helper rejected the updated fixture hash; the exact diff was reviewed by the release-specific helper. These are not hidden as first-run successes.

The first candidate was not promoted: the general trading pause was absent, so the candidate was rebuilt with the explicit pause. An anonymous owned-media check initially expected HTTP 403; the documented response is HTTP 200 with `sign_in_required`, a null viewer and an empty media array. The verifier now checks that exact empty response; application access controls were not weakened.

## Member refresh

Use `https://docked.com.au/app` with existing individual credentials. The checked v22 shell configuration loads that exact URL; fully close and reopen it. Browser users should reload the page. No APK rebuild, install or Preview MFA setup is required for this web release. Owner moderation and dashboards retain existing MFA; Barry and Luke use ordinary sign-in.
