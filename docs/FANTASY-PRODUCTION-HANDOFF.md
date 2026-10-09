> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Docked free-play production implementation — 8 October 2026

Later checkpoint: [Final production unblock](FANTASY-PRODUCTION-FINAL-UNBLOCK.md) records real PostgreSQL races passing, verified ABN/entity, the confirmed Supabase Free-project quota refusal and current hosting/mail decisions. The following is the historical implementation handoff.

Implementation commit: `ddea98889b8ba460bf812b4b834da3997ba0c5b0`. This is committed local work, not a deployed production commit.

**Public promotion remains blocked. No Fantasy production deployment exists.** The public holding page, isolated Preview, existing Edge code/data and original APK are preserved. No production database writes, DNS changes, paid services or payment activation occurred. Work continues on the original `pivot/fantasy-cards-preview-v1` branch from readiness commit `f9bdfe04`, without a reset.

## Verified destinations

| Item | Verified state |
|---|---|
| Public URL | https://docked.com.au — HTTP 200, valid HTTPS, existing GitHub Pages holding page |
| www | https://www.docked.com.au — HTTP 301 to HTTPS apex |
| Member Preview | https://docked-preview-s24-briant-ginty.vercel.app/fantasy/play — existing invited-tester workspace; homepage returned 200, anonymous Fantasy API returned 403 |
| Production deployment ID / deployed commit | None — no promotion performed |
| New empty Vercel production project | `docked-production` / `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST` |
| Verified Vercel team | `team_tf6xweKKyVCj9bTppUKttJ4l` / `briant-s-projects`, existing Hobby plan |
| Production Supabase project | Not created; manifest ref remains null |
| Intended Supabase organization | `ernfnkcbalhyqpsrzdwa` / Docked, verified Free plan, intended region `ap-southeast-2` |
| Preserved Preview resources | Vercel `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`; Supabase `bckkllmndoxzpzdqrevb` |

The new Vercel project has Next.js, Node 22, `npm ci`, and `node scripts/guard-hosted-build.mjs && npm run build`. Source is private; automatic custom-domain assignment is off. It has no Git link, deployment, environment secrets, attached database or assigned custom domain. The Vercel MCP connection returned a scope-specific 403; the existing explicitly scoped CLI credentials successfully created/configured/verified the project. No credential bypass or different account was used.

## Implemented locally

- Separate DB-owned production mode and runtime entry points, with exact reviewed resource binding. Preview retains its original environment gate, test-credit entry points and three-member limit. Production requires a verified nonanonymous live session, enabled account, current Terms/Privacy consent and an active membership.
- One permanent Starter receipt per account, including retries with different request keys. Allocation, edition counters, card identities and ownership provenance commit atomically. Starter cards are non-transferable. Opening a pack cannot issue cards again.
- Initial Starter allocation: **1,000 packs**, each **11 CORE cards: 1 GK / 4 DEF / 4 MID / 2 FWD**, without duplicate players. MFA administrators can authorize another allocation of **1–1,000** only after the current allocation is exhausted. Rollover reuses the same predefined edition pool and cannot raise permanent edition caps; old unopened packs remain valid and lifetime receipts never reset. Finite inventory is stated in the member interface. If genuine edition inventory is exhausted, further issuance fails safely; an operator must close new admissions or review a future separately declared catalog rather than promise unlimited packs.
- Daily period: **00:00–00:00 UTC**, determined by the server after obtaining the transaction lock. Default **10 non-transferable gameplay points**, with no spending, redemption, transfer or fantasy scoring multiplier. One receipt per account/period, including replay of old request keys. Every **7 claimed days** can receive **1 CORE card**, bounded by permanent edition stock, **100 cards across all accounts per UTC day**, and **10,000 reward packs** in the initial catalog. Expected stock exhaustion awards points only; unexpected issuance errors roll back the claim. Policy versions and outcomes are immutable.
- MFA-only policy changes: daily points **1–50**, card interval **7–365 claims**, shared daily card limit **0–100**. Historical awards preserve the policy version used.
- MFA-only free-round creation, fixed established football scoring, unique-player formation, audited statistics/simulation and immutable results. Card rarity and daily points never multiply performance scores. Public gameplay uses explicitly fictional players and simulated results, without cash prizes.
- Shared responsive UI, PLAY / CARDS / MARKET / SOCIAL / PROFILE navigation, production homepage copy, starter/reward/history controls and offline copy. Existing authentication/account routes and moderated social components are reused. Production state omits other accounts' identifiers, Preview shops, test wallets, test balances and private administrative catalogs.
- Marketplace buying, selling and trades are denied server-side and shown as closed. No approved non-monetary transfer mechanism was invented. Existing implementation is preserved for a later decision.
- Additive migration `20261007234952_fantasy_free_play_production.sql` is **not applied remotely**. Fresh initialization requires a clean Fantasy installation and reviewed project/policy values; it neither migrates Preview records nor changes existing Edge tables.

## Tests actually run

| Check | Result / scope |
|---|---|
| Full platform regressions | 375 passed |
| Full database regressions | 197 passed on disposable PGlite databases, including existing Preview/Edge rules |
| Final focused production DB run | 13 passed; includes one additional optional-card rollback scenario after the full suite |
| Release preparation/export regressions | 3 passed, including closed initial activation and explicit free-play readiness checks |
| Final production binding tests | See `qa/fantasy-production/test-results.json` |
| TypeScript / ESLint / client boundary | Passed |
| Local optimized Next.js build | Passed; this compiles code, not a verified live production environment |
| Dependency audit | Zero findings after pinning Sharp 0.35.5 |
| Secret audit | 601 source/client files; zero findings or scan errors |
| Server file traces | 98 trace manifests; no private-data, attachment, .env.local or .git references; no standalone private-data directory |
| Responsive screenshots | Four static Chromium component checks at 390/1440 px; no horizontal overflow; inspected reward and closed-market screens |
| Public preservation probes | Holding page 200, www 301, Preview homepage 200, anonymous Preview Fantasy API 403 |

The high-severity Sharp advisory was [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). An overly broad Open Graph filesystem trace was also fixed before the final build.

The focused SQL tests cover verified/anonymous/banned/disabled/stale-consent/expired-session denial, runtime-role permissions, duplicate claims, old-period replay, issuance rollback, stock fallback, global reward limit, lifetime Starter rollover, cross-user pack denial, supply/provenance, lineup lock and fixed immutable scoring. **PGlite serializes queries; these are not proof of simultaneous real PostgreSQL transactions.**

`scripts/fantasy-production-concurrency.ts` is prepared for an empty, disposable **loopback-only** PostgreSQL database named `docked_free_play_test_<suffix>`. It refuses cloud/Preview/production URLs and pre-existing data. It covers parallel Starter/open/daily requests, last-pack races and session expiry while waiting for the lock. It has **not run successfully** because the local Docker Linux engine is unavailable. A transaction actually waiting across UTC midnight remains an unverified boundary scenario.

Screenshots: `qa/fantasy-production/cards-390.png`, `cards-1440.png`, `market-390.png`, `market-1440.png`. They are explicitly labeled static layout fixtures: no hydration, real Auth/API, app/browser synchronization, iPhone Safari or native Android claim is made. Actual production signup/recovery/mail, social moderation, RLS, ownership and deployment smoke tests remain unrun because the production backend does not exist.

## Exact remaining launch gates / owner actions

**Hosting plan eligibility:** the only verified Vercel team is Hobby. [Vercel restricts Hobby to personal, non-commercial use](https://vercel.com/docs/plans/hobby). Establish that Docked's intended use qualifies, obtain provider confirmation, or supply an existing authorized commercial-capable team. Any required paid upgrade needs separate owner approval. Creating the empty destination did not deploy the business site, upgrade a plan or activate paid resources.

1. **Production database:** confirm available zero-cost project capacity in the Docked Free organization, or supply an existing separate Docked production project in Sydney. The connector's `get_cost` operation is unavailable; CLI inventory shows Docked Preview and unrelated Oura UAT only. No paid project or plan upgrade was attempted. Supply production-scoped credentials via ignored `private-data/production/connection.json`; never reuse Preview/Oura. Verify provider project identity independently before migrations. Apply all migrations only to the authorized separate database, then initialize production with the actual ref and approved policy versions. Verify `docked_app` least privilege, TLS, RLS and disabled legacy/commercial feature flags.
2. **Actual operator and policy facts:** complete ignored `private-data/production/operator.json` with verified legal name, applicable ABN, support contact, approved Terms/Privacy versions and current community/region policy. Existing draft/template text is not evidence of approval. User authorization to launch does not supply these facts. Update the public documents and consent policies consistently; do not fabricate approvals or relax existing gates.
3. **Authentication:** configure a production-authorized mail sender/provider within already approved costs, mandatory email verification, recovery, server-side rate limits and exact callback allowlists. Verify real delivery and account flows with controlled addresses. Do not install the Preview mail-capture hook or reuse tester credentials. Confirm the exact protected staging/deployment callback route before public testing; do not add wildcard redirects.
4. **Live integrity and UI:** make real PostgreSQL races pass on an isolated runner, then stage the production application while retaining the holding page. Verify actual signup, verification, recovery, current consent, Starter/reward replay and concurrent issuance, cross-account isolation, social visibility, Edge preservation and app/browser consistency. Use controlled production-safe accounts; do not substitute Preview results. Review operational Starter capacity and admission closure before stock exhaustion.
5. **Promotion:** only after those gates pass, mark the manifest approved, configure production secrets/flags, export committed sources, deploy and verify the exact source commit. Keep the existing domain until the replacement passes. Then use the project's freshly verified Vercel DNS/HTTPS targets, canonical www redirect and a rollback record; repeat public smoke tests. No payment activation is authorized. The existing HTTP apex still serves its old holding-page response; canonical HTTP-to-HTTPS migration is deferred with DNS/promotion.

The local environment preparation script remains fail-closed. Its readiness fields are records of evidence to obtain, not permission to mark unchecked assertions true. No routine technical approval is needed to continue once these external facts/access are available.

## Barry's APK

- Desktop: `C:/Users/61412/Desktop/Docked-Preview-S24-v8-Fantasy-Cards.apk`; original retained under `artifacts/android/`.
- Version **1.7-preview**, build **8**, package `au.com.docked.app.preview`; **11,044,694 bytes**.
- SHA-256: `ae888b5cfc393ed2ee9e66b4e1c1566382d70888d9c41585d1d9afdd401b902e`. Desktop file was hashed again at final verification. Existing APK signature/content audit identifies the completed Fantasy Preview, not Edge Signal.
- **Email NOT SENT.** Browser automation fails before initialization (trusted Node/helper setup errors), so the existing Chrome/Gmail session could not be used. The connected Gmail integration previously returned `400 FAILED_PRECONDITION: Mail service not enabled`. There is no sent message ID or Gmail confirmation.
- Ready-to-send message: `C:/Users/61412/Desktop/Docked-Barry-Android-Preview.eml` and `.txt`, addressed to **barrydearing@gmail.com**, subject **Docked Fantasy Cards — Android Preview**. It uses the verified private APK link, describes the website launch as pending, and includes Android outside-Google-Play installation instructions. It contains no administrator credentials or tester passwords.
- Existing private download link was fetched and hash-verified again. It expires **11 October 2026, 10:36:46 am Sydney**. It is a file-scoped bearer link, not recipient-authenticated. Reconnect a working mailbox/browser automation or send the prepared message manually before expiry. Do not evade Gmail's APK restrictions. Tester credentials must be provided separately through the approved private route.
- APK still targets the isolated three-tester Preview. No public/production APK was claimed. Previous emulator installation/launch evidence remains; interactive native testing was blocked by emulator ANRs. No physical Samsung or iPhone testing occurred this turn.

## Review budget

One existing reviewer ran the requested critical architecture review and a bounded follow-up on new production code at **Astra High**, read-only, with no nested delegation or data changes. Findings were investigated and fixed by the main agent, with regressions. **No Ultra audit ran.** The coordinator's runtime was not switched through a tool; no claim is made that it was changed to Astra Medium.
