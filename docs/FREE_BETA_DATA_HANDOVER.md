# Free friends beta continuation — 11 October 2026

Branch: `pivot/fantasy-cards-preview-v1`. Starting commit `78e6a661`; recoverable tag `checkpoint/free-beta-data-20261011-78e6a661`. This continues the release, not a replacement of the accepted dashboard/UI or owner login. No password reset or MFA enrolment occurred.

## Delivered and verification boundaries

| Area | Result |
|---|---|
| Current-player eligibility | Owner approval recorded for all current EPL/NFL players in NEW isolated beta grants/competitions. First-year minimum zero; commercial eligibility, old editions/rules/history untouched. EPL only association football. |
| Catalogue preparation | Stable provider ID/current-team adapters, EPL scope/position/date validation and deterministic complete-team planner. Tests prove EPL XI and NFL seven under existing rules without rookie-season data. This is contract-fixture coverage, **not issued real cards**. Actual rights-checked catalogue import, reviewed beta editions and auditable separate replacement grants still need execution. Fictional owned cards have not been renamed/burned. |
| Provider pipeline | Fixed-host header-auth fetch, licence gates, quotas, leased retry jobs, hashed raw revisions, licensed payload expiry retaining provenance, frozen fixture/player mapping and serialized append-only scoring journal. Reuses the existing rules/lock/correction/finalisation engine. PostgreSQL concurrency tests pass. **Not a connected live provider or deployed worker.** |
| Privacy | Local isolated scoped export, media/content removal, revocation, email de-identification, cross-user denial, rollback and retry tests pass. Additive migration `20261010210741_support_privacy_and_beta_catalogue.sql` applied to exact Docked project `pojoymtniryarxxunyvz`; all pre-existing rows unchanged, no public/runtime grants, admission remains off. No real privacy request executed. Shared Auth, residual UUID links, third-party narratives, mailbox/log/backup copies remain separate tasks; receipts explicitly do not claim full anonymisation. |
| Android preparation | Corrected future live-beta package to `au.com.docked.app.preview`, retaining installed owner QA identity and existing signing setup. Receipt still requires a verified live backend; no fake receipt or replacement APK produced. Future build must increment version and compare signature with v15. |
| Invitation preparation | Existing maximum-ten AU member planner retained and stale one-person error corrected. No invitation sent, recipient guessed or account created. |

The SQL support operations are `support_privacy_case`, `support_privacy_export` and `support_privacy_redact`, callable only through a trusted operator connection with an independently verified existing owner AAL2 session. They are not a member-accessible deletion bypass. Verify requester identity and record reason, export privately if requested, execute local redaction, then complete each outstanding external/shared-identity task on the receipt. Never mark the case fully erased just because local redaction passed.

## Owner decisions — only two product/policy questions remain

1. **Will you operate support/moderation at support@docked.com.au?** Recommended process: check daily; acknowledge routine cases within two business days; target routine privacy resolution within 30 days. Restrict compromised access/remove dangerous content promptly, record reasons, offer complaint review, direct immediate danger to emergency services and seek specialist assessment for suspected breach notification. No messages are authorised by this proposal alone.
2. **Approve or amend this retention proposal?** Revoke immediately; eligible account details/posts/media within 30 days. Support messages 12 months after closure; routine logs 30 days; security logs 90 days. Recorded exceptional holds reviewed every 90 days. Unlink game identity within 30 days after relevant rounds/disputes close; review remaining beta evidence at beta end, delete/further de-identify within 12 months of beta closure absent a documented exception. Provider backup/hold reality must be verified before promising these timings. Ownership/issuance evidence is needed to prove scarcity, transfers and earned points, but does not require names/email indefinitely.

Player eligibility is **approved**, not a third question. No spending approval is presumed.

## Exact evidence and secure configuration needed

Microsoft administrator access was unavailable: admin.microsoft.com opened the personal Hotmail terms screen. Nothing was accepted. Existing Docked mail evidence proves scoped sending only, not mailbox residency/holds/export. Do not broaden the mail application's permissions.

- Sign into the Docked **work administrator** at admin.microsoft.com → Settings → Org settings → Organization profile → Data location → Commitments. Record Exchange Online's at-rest region/date. It does not establish all processing locations.
- Run `scripts/microsoft-privacy-evidence.ps1` in an existing authenticated Exchange administrator session for tenant `b34880d6-d28e-40c2-b389-232506c69650`. Supply the read-only output (no credentials). It checks support mailbox retention tags, mailbox holds and organization hold IDs.
- Purview → Solutions → Data Lifecycle Management → Microsoft 365 → Retention policies; also Records Management labels and eDiscovery case holds. Record mailbox inclusion/exclusion, retain/delete duration/action, mode/distribution status and any holds. Verify scoped export and deletion/recoverable-item behavior using an already-existing synthetic support message, not a real purge. Record export entitlement and format.
- Provide actual Supabase/Vercel backup/log expiry evidence. The proposed schedule is not an assertion that vendor defaults already implement it.
- Provider credentials belong only in the separate server operator worker secret store (`SPORTMONKS_API_TOKEN`, `SPORTSDATAIO_API_KEY`) or an ignored owner-access-only local setup. Do not paste keys in chat, put them in APK/public variables, or add them to the current member web app. First supply written source/plan rights and field confirmation; credentials alone cannot open the gates.

## Provider recommendation and exact scoring gaps

EPL: Sportmonks Starter advertises **EUR29/month billed monthly**, five leagues and 2,000 calls/entity/hour. NFL: SportsDataIO commercial NFL licence **QUOTE REQUIRED**. Seek written free-beta/evaluation permission before any purchase. No verified free source currently covers every required field and intended hosted use. [Official Sportmonks price](https://www.sportmonks.com/football-api/plans-pricing/) and [SportsDataIO licensing](https://sportsdata.io/help/data-rights-and-licensing-questions).

Confirm hosted free-fantasy use for one owner plus ten AU adults, current EPL/NFL roster identifiers, required statistics, revisions/finalisation, raw/derived retention and attribution. Photos, club logos and paid collectible-card sales are separate rights, not inferred from statistics access. Use approved Docked artwork. Concrete unsent provider enquiries and activation checklist are in [FREE_BETA_PROVIDER_ACTIVATION](FREE_BETA_PROVIDER_ACTIVATION.md).

EPL scoring still needs exact regulation/on-pitch timing, ordered boundary events and assistance semantics matching Docked's rules. NFL still needs reliable offensive fumble-recovery TD attribution because the documented field is deprecated. Missing evidence remains **pending**, never zero or final. No rule was weakened. Complete vendor-field derivations only after clarification; any proposed scoring change must be a new approved future ruleset, not a rewrite of locked rounds.

Next full-round scheduling candidates, not active Docked deadlines: NFL Seahawks–Broncos **16 October 2026 11:15 AEDT**, EPL Everton–Chelsea **17 October 2026 22:30 AEDT**. [Broncos schedule](https://www.denverbroncos.com/schedule/) and [Premier League schedule](https://www.premierleague.com/en/news/4675097). Current rounds already started. No live competition/deadline was published: complete provider round mapping and a confirmed whole-round lock offset must precede creation.

## Ready versus blocked

Ready for restricted owner use: existing protected app/dashboard/community fixtures; preserved owner authentication; operator privacy schema; local provider/scoring and catalogue contract tests. [Owner Preview](https://docked-production-r4171qdhn-briant-s-projects.vercel.app/app), application `6b735cfb`, deployment `dpl_2TVVnzgb2Je3Vjjs8u5WoMfsiAdL`.

Existing connected APK: `artifacts/android/Docked-v15-Owner-Connected-QA.apk`, v15 / 1.14-preview. SHA256 `e91b7d6cf43d2364df77a3f34ebb7bebe7d79506b11999f31ec67888cb6e70da`. Previously issued private download expires 17 October 2026 23:05:43 Sydney. No new binary or physical acceptance is claimed. Install as an update; do not uninstall/clear storage. Visual approval and S24 review remain pending.

**Not ready for external friends yet.** Beyond the two decisions and evidence above, activation work remains: scoped hosted worker deployment/read models, complete provider fields and genuine acceptance, licensed catalogue import/separate beta grants, final policy version, and hosted two-member admission/social/free-swap/scoring checks. The current web environment guard is owner-only protected Preview; a reviewed domain/admission release configuration must be applied and tested, not bypassed. The live-beta APK guard deliberately refuses the current holding page. No hosting-protection secret will be embedded or shared.

After those gates pass: snapshot domain/environment/callback/recovery configuration; deploy to protected staging, verify session/admission isolation; release the authorised domain without Vercel login while keeping application admission AU18+/ten testers; verify HTTPS and invitation/recovery links; build the next same-package APK against its real acceptance receipt. Supply up to ten intended tester emails and explicit sending authority only when invitations are wanted. Payments, prizes, cash trading, KYC and withdrawals stay disabled; free swaps require the existing tested gate.

## Executed checks and recovery

- Platform 231/231; database/RLS 147/147; targeted provider/catalogue/Android/invitation 15/15.
- Disposable PostgreSQL friends/privacy acceptance and 20-way feed quota/lease/reconciliation concurrency pass, including injected rollback and raw retention.
- Typecheck, lint and production web build pass. Production dependency audit: zero reported advisories.
- Known-credential deployable source/config/browser scan passes. Broad heuristic scan flags seven existing synthetic/template fixture files; reviewed as non-secret examples, recorded without suppressing the scanner. No new provider secret supplied.
- Hosted schema/permission verification passes. Provider tests are contract fixtures, not live observations. No new browser/emulator/device UX claims; accepted dashboard/UI evidence was deliberately not repeated.

Recovery: app and public holding page were not redeployed or changed. Existing v15 stays available. The additive privacy functions are operator-only and unused for real accounts; leave them dormant rather than run a destructive down migration. Source checkpoint above restores pre-work code without changing ownership/history. No irreversible data retirement, paid service, invitation or tenant setting change occurred.
