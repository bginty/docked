# Final production unblock checkpoint — 8 October 2026

Later update: the owner selected Netlify Free. See [Netlify preparation and current database capacity](FANTASY-NETLIFY-PREPARATION.md). The following records the earlier `d5d82965` checkpoint and its then-current options.

Continued from implementation `ddea9888` and handoff `04c3377a` on the existing `pivot/fantasy-cards-preview-v1` branch. No reset, feature rebuild, duplicate infrastructure, paid upgrade, production migration, DNS change or release occurred.

**Fantasy production is not live.** https://docked.com.au still serves the holding page over valid HTTPS (200); https://www.docked.com.au redirects to the apex (301). The invited Preview homepage remains available (200), and its anonymous Fantasy API remains denied (403). See `qa/fantasy-production/final-unblock-check.json`. Existing Edge code/data and Preview were not modified remotely. Full authenticated Edge/Preview regression was not repeated against live services.

## Infrastructure and costs

| Resource | Verified result |
| --- | --- |
| Vercel production destination | Reused `docked-production`, `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST` |
| Vercel team | `team_tf6xweKKyVCj9bTppUKttJ4l`, Hobby |
| Production deployment ID / deployed commit | None |
| Docked Supabase organization | `ernfnkcbalhyqpsrzdwa`, Free |
| Production Supabase project | None; provider refused the authorized Free-project creation request |
| Preserved Preview database | `bckkllmndoxzpzdqrevb`, ACTIVE_HEALTHY |
| Other existing Free project | Oura CRM UAT `dwdjeecjdkkiidoutnme`, ACTIVE_HEALTHY; untouched |
| New charges activated | None |

Supabase's exact refusal identified `bginty` as having reached the **two active Free-project limit** across organizations where the account is administrator/owner. A subsequent inventory still contained only the two original projects. No project was paused/deleted/transferred, no paid compute option was requested, and no plan was upgraded. This is a confirmed capacity refusal, replacing the previous unknown-capacity blocker. [Supabase billing rules](https://supabase.com/docs/guides/platform/billing-on-supabase).

Vercel Hobby permits personal, non-commercial use only. The owner-confirmed business launch cannot proceed on this plan. Retaining the requested Vercel destination requires an authorized commercial-capable plan/team; Pro currently starts at **US$20/month**, including one deploying seat, with possible additional usage, seats and taxes. No trial or upgrade was activated. [Hobby eligibility](https://vercel.com/docs/plans/hobby), [Pro pricing](https://vercel.com/docs/plans/pro-plan).

An eligible free commercial hosting option **does exist: Netlify Free**. Its current plan has **300 credits/month, a hard limit and no automatic recharge**; service can pause when allowance is exhausted. Its commercial-use allowance is documented separately from its current quotas. This is a candidate for a modest launch, not proof of capacity for unknown traffic. No Netlify account/project was created: switching would change the explicit Vercel-reuse instruction and requires adapting/reverifying the Vercel-specific deployment identity guards, Next.js adapter, authentication URLs and release checks. [Commercial use](https://www.netlify.com/blog/introducing-netlify-free-plan/), [current plan limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

Supabase Pro is **US$25/month per organization plus compute**, with US$10/month compute credit. If Docked's organization keeps Preview and adds production as two Micro instances, the indicative baseline is **US$35/month** (25 + 10 + 10 − 10), before taxes, overages or add-ons. Combined with one-seat Vercel Pro, the indicative baseline is **US$55/month**, not a guaranteed bill or approved spend. Verify the dashboard quote and set agreed spending controls before any upgrade. An existing separately authorized production project/capacity can avoid a new subscription. [Supabase pricing](https://supabase.com/pricing).

## Verified operator facts and unresolved policy details

The preserved `legacy/storefront/contact.html`, `terms.html` and `privacy.html` identify **Ginty United Investments Pty Ltd**, **ABN 78 606 187 106**, **ACN 606 187 106**, and **support@docked.com.au**. The official [ABN Lookup record](https://abr.business.gov.au/ABN/View?abn=78606187106), fetched successfully on 8 October 2026, matches the entity/ABN/ACN and reports active status since 23 June 2015.

The historical storefront lists **135 Bamfield Road, Heidelberg Heights VIC 3081, Australia**, explicitly for correspondence and authorized returns, with no showroom or pickup. ABN Lookup reports the main business location as **VIC 3909** and does not provide a full street address. These can represent different address purposes; the current business/registered address and whether the recorded correspondence address remains suitable for Fantasy support are **not verified**. Do not silently equate them.

The support domain has a Microsoft 365 MX record. That proves mail routing, not that this mailbox is accessible, monitored, or authorized for SMTP sending. A working support/auth sender remains unverified. The existing Gmail connector returned `FAILED_PRECONDITION: mail_service_not_enabled`.

Recovered facts and provenance are saved in ignored `private-data/production/operator.json`. Entity verification is recorded separately; overall details/policy approval remain false. No identity or policy gate was bypassed. Current public document templates still need the Fantasy free-play terms and data handling/retention/complaints details finalized before setting a consent version. The existing Edge terms must remain available for Edge functionality. No invented address, retention period or policy approval was supplied.

## New tests and fixes

The previous Docker blocker was worked around using an optional, pinned **embedded-postgres 17.10.0-beta.17** runtime installed only under ignored `tmp/`. It starts an actual PostgreSQL 17.10 Windows server on a random **127.0.0.1** port with SCRAM authentication, a unique empty test database, UTF-8 encoding and no OS-user creation. All migrations run against synthetic local auth fixtures. No Supabase connection or shared data is used.

The first attempts failed for two test-environment reasons: Windows default WIN1252 could not store a migration's Unicode text; then the harness double-encoded JSON payloads with postgres.js. Fixed explicit UTF-8 initialization and changed the harness to `tx.json(payload)`, matching the already-correct production adapter. A TypeScript JSON-value mismatch was subsequently fixed. No game rule or production SQL change was needed.

**Eight real PostgreSQL scenarios pass**, recorded in `qa/fantasy-production/real-postgres-races.json`:

1. Twenty concurrent Starter claims and twenty concurrent pack opens produce one 11-card allocation.
2. Twenty concurrent daily claims produce one 10-point award.
3. Another account cannot open the first account's pack.
4. Twenty concurrent seventh claims produce one controlled one-card reward, with no financial ledger entries. Six previous-day receipts are explicit local fixtures, not a claim of observing seven real days.
5. Marketplace/trade/credit commands are denied; direct reward-table access is denied to anon/authenticated/runtime roles; Fantasy tables have RLS enabled.
6. Owner policy changes require MFA; claim receipts and permanent edition caps cannot be rewritten.
7. A session that expires while waiting for the transaction lock cannot enroll or receive a Starter.
8. Two users racing for the last Starter allocation yield one success, with edition limits and ownership provenance intact.

The focused production database regression suite also passed **13/13** on PGlite. TypeScript and ESLint checks pass after the harness type fix. The prior 375 platform / 197 database regression results and local build remain historical evidence from `ddea9888`, not new runs. No application source, migration or production dependency changed in this checkpoint. The optional runtime is not a production dependency.

The seven changed/unignored files at the final audit had no exact matches against known private credentials/link values; all five changed evidence/document files passed credential-pattern scanning with no errors. The optional test runtime dependency audit reported zero vulnerabilities. See `qa/fantasy-production/final-unblock-secret-audit.json`; this is a changed-file audit, not a new deployed-bundle certification.

Reproduce locally from the repository root:

```powershell
npm install --prefix tmp/free-play-postgres-runtime --save-exact embedded-postgres@17.10.0-beta.17
node scripts/fantasy-production-local-postgres.mjs
```

The runner stops its server and retains ignored local test logs/data. Alternatively point the existing harness at a fresh UTF-8 loopback database named `docked_free_play_test_<suffix>`. It rejects remote addresses and nonempty databases. Never use production/Preview credentials for it.

These tests do **not** verify hosted Supabase Auth, actual email verification/recovery, deployed RLS, production account flows, a real wait across UTC midnight, social moderation delivery, or real app/browser synchronization. Production-safe end-to-end smoke tests still require production infrastructure. Prior 390/1440px screenshots were static Chromium fixtures; no new Android/iPhone native or Safari testing is claimed.

## Approved launch mechanics remain unchanged

- One 11-card Starter per verified eligible member, permanent per-account receipt; initial allocation 1,000 packs, 1 GK / 4 DEF / 4 MID / 2 FWD. Controlled MFA rollover preserves edition caps and lifetime receipts.
- Ten non-transferable gameplay points per UTC daily period; one controlled CORE card every seven successful claims, subject to finite inventory, 100 shared cards/day and the initial 10,000 reward-pack cap. No financial value or fantasy score multiplier.
- Marketplace, buying/selling/trades and all real-money mechanics remain disabled. No test wallets or Preview inventory are connected to production.

## Barry's delivery

Desktop APK: `C:/Users/61412/Desktop/Docked-Preview-S24-v8-Fantasy-Cards.apk`. Version **1.7-preview**, build **8**, **11,044,694 bytes**, SHA-256 **ae888b5cfc393ed2ee9e66b4e1c1566382d70888d9c41585d1d9afdd401b902e**. Both Desktop and original APK hashes match. This remains the Fantasy **Preview** APK.

The existing private download returned 200 and matched the same exact hash. It expires **11 October 2026 at 10:36:46 am Sydney**. The bearer URL remains private and is not copied into source or this report.

**Email was not sent.** Gmail is unavailable as described above; there is no sent-message confirmation. Ready-to-send `.eml` and `.txt` files remain on Desktop under `Docked-Barry-Android-Preview`, addressed to Barry with the private link and Android outside-Google-Play installation instructions. No bypass, new mailbox or administrator credentials were used.

## Exact owner actions, then remaining technical work

1. **Hosting decision:** authorize retaining Vercel with the quoted paid-plan budget, provide an existing commercial-capable authorized Vercel team, or explicitly choose Netlify Free and connect that account so migration can be verified. No paid authorization has been inferred.
2. **Database capacity:** provide legitimate available separate production capacity/project, or explicitly approve the Docked organization upgrade with Preview plus production compute included in the quote. No existing project will be paused or deleted merely to free quota.
3. **Contact and policy facts:** confirm the current business/correspondence address and monitored support route; finalize Fantasy Terms/Privacy retention and complaints provisions and approve the resulting versions. The legal entity and ABN themselves have now been independently verified.
4. **Mail access:** connect an authorized production SMTP sender/provider within the approved cost limit and a controlled inbox for verification/recovery tests. Supabase's default sender is team-address-only and unsuitable for public signup; do not disable confirmation to work around this. [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).
5. **Barry:** reconnect a functioning Gmail session/connector or manually send the prepared message before the private link expires.

Once those external gates are resolved: provision/configure the isolated backend, apply and verify migrations/RLS, configure actual MFA administrators and exact auth callbacks, stage with the holding page retained, run real signup/recovery/consent/pack/reward/social/cross-client tests, then promote the verified commit and change domain routing. Record the resulting deployment ID and production smoke evidence. No further routine permission is required within the existing authorization.

No new reviewer or Ultra audit ran in this checkpoint; the prior bounded Astra High review remains recorded in the handoff. No model/effort switch is claimed.
