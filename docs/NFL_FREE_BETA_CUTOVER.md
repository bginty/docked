# NFL-first free-beta cutover preparation

Owner scope is approved; no repeat release-scope approval is needed. This replaces the old production runbook's instructions to buy/create another host, database or email service. Reuse the existing exact Docked project and accounts. Do not execute DNS/admission changes while the shared readiness receipt is incomplete.

## Existing targets

- Vercel `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, team `team_tf6xweKKyVCj9bTppUKttJ4l`.
- Supabase `pojoymtniryarxxunyvz`, isolated `beta_*` and `sports_feed` records. Do not seed/reset/copy commercial holdings.
- Public destination `https://docked.com.au`, with `www` redirect. Keep Microsoft MX/SPF/DKIM/DMARC unchanged.
- Android identity `au.com.docked.app.preview`, existing signing certificate. Do not uninstall/reset owner sessions.

## Ready preparation versus activation

1. Preserve completed Exchange/export evidence in `12e10d3e` and the qualified `2026-10-11-beta-rc3` packet. Remaining GoDaddy geography/tag/backup questions are disclosed follow-up, not a generic launch gate. No paid Purview or repeated mailbox sign-in is required. Preserve accepted owner login/MFA and approved retention intent.
2. Save current DNS/domain/deployment preimages immediately before cutover. The holding page remains the recovery target; never restore the retired storefront.
3. Use the already-tested beta app/database role and final committed source. Preserve closed payments, prizes, cash trading, withdrawals and KYC collection; no EPL entry. Do not substitute a permanent/commercial database role because the Vercel target becomes production.
4. Configure exact HTTPS production callback/recovery origins and metadata. Keep generic Auth self-registration disabled; use the existing individual invitation/admission path. Within one operator database transaction, call `transitionFriendsPolicy` from `scripts/friends-policy-transition.mjs` before enabling admission: it requires closed gates, aligns admission and gameplay policy versions, and audits actor/reason/prior/result/digest exactly once. Do not update one store alone or rewrite historical member consent. Existing members must accept the current versions. Enable friend/swap gates only with an audited readiness receipt, retaining AU18+, ten lifetime testers and admin MFA. The existing `DOCKED_TWO_PERSON_BETA` flag exposes the reused swap UI/API; server `friends_control` and admission are authoritative, not that flag's historical name.
5. Deploy without moving the domain first; verify anonymous denials and verified owner/member authentication through the intended domain/callback configuration. Attach domain using Vercel's current project-specific DNS recommendations, not a guessed IP. Custom-domain access must not need Vercel login/shared bypass. Test HTTPS, www, expired/revoked invitations, callback origin, API isolation and ordinary AAL1 versus owner AAL2.
6. Record `api/beta-release` identity and actual hosted checks, then produce the domain-connected APK with `npm run android:live-beta`. Its manifest validator requires real accepted domain evidence. Never forge that receipt using protected Preview or SQL-only QA. The current owner-connected v16 is explicitly a protected QA build, not the friends distribution build.

## Invitation preparation

Required owner input: each recipient's email and explicit authorisation to invite them; at most ten testers total. Do not ask the owner to collect identity documents. Invitation acceptance gathers Australia/state, age attestation and current policy consent, then binds the one-use invitation to the verified account. Ordinary members need no MFA enrolment; administrators retain MFA. Use existing transactional sender and exact recipient allowlist only after authorisation. No invitation was created/sent by this preparation document.

## Recovery

Before public activation: restore the preceding compatible protected deployment if needed. After cutover: close new admission/mutations, move web traffic to the recorded neutral holding page or a compatible accepted release, retain all new accounts/cards/journals. NFL collection can be paused by disabling only its named jobs; never drop the evidence or revert the database wholesale. The additive swap migration preserves original private functions but revokes runtime bypass access; do not expose them as a rollback shortcut.

Operational readiness is not evidence of a completed upcoming match. Week 6 is genuine and future; historical two-user acceptance stays rollback-only. Observe first fresh scheduled ingestion and subsequent correction/finalisation before calling results operationally accepted. No prizes are generated.
