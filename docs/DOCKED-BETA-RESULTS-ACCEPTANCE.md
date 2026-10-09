> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Docked beta results and launch checkpoint — 9 October 2026

Continued from `bdaac082` on `pivot/fantasy-cards-preview-v1`. **Not launched.** Existing email integration, NFL work and Android packaging are preserved. The public holding page remains until the mandatory gates pass.

## Implemented and tested

- Added append-only operator-controlled release history and durable beta/stable classification for fantasy rounds and daily reward receipts. Pre-migration records retain `legacy`; they are not relabelled official. Existing card supply, ownership and lifetime starter entitlement remain permanent.
- Runtime and database release channels must match. A shared PostgreSQL transaction lock serializes release transitions with gameplay. Old-round mutations are rejected; an exact saved receipt remains recoverable after a transition, with current eligibility/MFA and payload identity rechecked.
- Production championship totals aggregate all eligible current-release results, not only the last 100 displayed results. Shared standings expose social profile IDs and aggregate points, not other users' Auth IDs or lineups. They require approved social, leaderboard and public-profile permissions for both participants and exclude private, blocked, disabled and inactive accounts.
- Daily points are separate by release while the permanent daily claim constraint remains unchanged. Changing release cannot award a second reward for the same UTC period. History retains the original release classification.
- Added beta labels and server-calculated tied ranks. Fixed the existing three-column statistics grid overflowing a 320-pixel screen.

This covers **fantasy** championship and daily reward separation. It does not approve official betting records, activate regional community policies or claim hosted community rankings have passed acceptance.

## Verification

| Check | Result |
| --- | --- |
| Platform suite | PASS — 430 tests |
| Full isolated database suite | PASS — 211 tests |
| Focused production fantasy database suite | PASS — 16 tests, including privacy/permission isolation, release transition and saved-receipt recovery |
| Real local PostgreSQL 17.10 | PASS — nine scenarios, including an actually blocked concurrent beta claim during release transition; no additional award |
| Final fantasy platform subset | PASS — 13 tests |
| Chromium component checks | PASS — 320/412/1366 pixels; server totals, tied ranks, reward history and overflow |
| TypeScript / changed-source ESLint | PASS |
| Optimized Next build | PASS — isolated export without environment files/cloud credentials; final CSS rebuild tracked in evidence |
| Secret boundary | PASS — zero actual production-secret matches; 54 client assets, 101 server traces |
| Hosted signup/invitation/recovery/gameplay | NOT RUN — protected application staging and policy configuration remain unavailable |
| Android/iPhone native | NOT RUN — no actual device acceptance or new APK |

Screenshots are authored isolated component fixtures, not hosted acceptance: [mobile standings](qa/beta-results/ISOLATED-beta-standings-412.png), [desktop rewards](qa/beta-results/ISOLATED-beta-rewards-1366.png). Initial fixture failures were corrected: reward history must be expanded, and the fixture must use the real layout's `fantasy-mode` class. The corrected theme exposed genuine 320-pixel statistics overflow, which was fixed and retested.

A bounded read-only reviewer found missing leaderboard/public-profile authority and receipt recovery across release transitions. Both were fixed with regression tests. No nested delegation or Ultra audit ran. This chat's primary model/effort could not be changed or independently confirmed; **no Astra High switch is claimed**. A separate final integrity review remains appropriate after actual hosted Auth/gameplay acceptance, without restarting previous audits.

## Infrastructure and staging

- Exact production project readback: `pojoymtniryarxxunyvz`, organization `otldyeunbqabbcjydjpe`, Sydney `ap-southeast-2`, healthy PostgreSQL 17.11. Before these migrations: zero Auth users, cards, production rounds and daily claims; fantasy mode still inactive/Preview default in this dedicated database. No Preview database connection is involved.
- **Applied and verified:** production-only dry-run and apply contained exactly `20261008145441_nfl_community_catalogue.sql` and `20261008151700_fantasy_beta_result_isolation.sql`, after implementation commit `d93e08d6`. No seed or role changes. [Production readback](qa/beta-results/production-readback.json) confirms both versions, initial beta history, inactive NFL catalogue, RLS and least-privilege function access. Zero Auth users/cards/rounds/claims remain. The CLI used a dedicated working directory and explicit production project reference, never the repository's Preview link.
- Netlify exact-site readback confirms `2292ba6e-7073-4804-b69a-26b41c9a9fb1`, account `6ac753a0bfe95a1bc4d156b9`, `docked-production.netlify.app`, with no published deployment. The deploy URL returned by site metadata is **not evidence of a successful application deployment**.
- [Netlify documentation](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/) supports private projects on credit-based Free. Site API metadata did not expose the visibility setting. Browser inventory failed twice with a runtime/sandbox helper error; no browser action or visibility change was completed.
- Costs remain owner-confirmed Supabase US$25/month before tax and Netlify Free; no new paid configuration. No current invoice/usage audit is claimed.

Post-migration security advisor returned no warnings/errors. Its 70 informational `rls_enabled_no_policy` notices describe intentionally default-deny private tables with restricted function access, including the new release ledger; no permissive policies were added. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Final [read-only email/hosting check](qa/fantasy-production/hosted-mail-scheduler-security.json) confirms public signup disabled, verification required, scheduler disabled and the prior Inbox-confirmed receipt still accepted with one dispatch and its encrypted payload erased. Apex HTTPS returns 200 for the holding page, www redirects 301 to apex, staging remains 404. No new message was sent.

Automatic approval review rejected changing the shared `config/hosted-production.json` `approved` flag because unresolved legal/authentication/staging prerequisites could make it unsafe. The flag remains false. No alternate edit was attempted and no gate was bypassed; activation awaits resolution and approval of those prerequisites.

## Exact remaining actions

1. **Netlify owner:** at [Docked project visibility](https://app.netlify.com/projects/docked-production/configuration/general/#project-visibility), set/confirm **Private** for production and previews on the existing Free plan. Confirm the actual setting; do not upgrade or choose paid password protection. A functioning authorized browser session is needed to verify protected access and complete hosted browser tests.
2. **Policy owner:** approve the reviewed Terms/Privacy/community/reward/beta versions, country/state scope, retention/provider disclosures and responsibility for support/privacy/moderation. Drafts remain in `FANTASY-PRODUCTION-POLICY-DRAFT.md`; operator approval flags and versions remain unset. Company/ABN/support details are already supplied; no request to republish the private street address.
3. **Owner account:** confirm intended administrator login email, then enroll the owner's authenticator after verified invitation. Exact friend email addresses are needed before expanding beyond the authorized support-only test recipient.
4. **Technical email continuation:** once protected staging is verifiable, finish the already-authorized support-only invitation, confirmation, recovery, expiry/replay and send-failure reconciliation tests. The earlier Graph 202 and owner-confirmed Inbox delivery are valid diagnostic evidence, not full hosted Auth acceptance. No extra diagnostic email is needed. Other-mailbox negative authorization remains untested.
5. **NFL:** securely configure a production-authorized provider credential and verify Free quota and rights registration. The 32-team catalogue/community UI/parser work is complete locally; actual current-season fixtures, results and hosted community persistence remain unverified. Optional advanced prediction/full fantasy stays disabled.
6. **Launch/APK:** after mandatory hosted/legal/security/gameplay checks, promote with DNS/HTTPS rollback, complete a real deployment receipt, and build the existing guarded Android Beta target. No live administrator, friend access, new APK or Barry delivery is claimed at this checkpoint.

No public signup, production mail activation, payments, marketplace or official betting models were enabled. Oura and Preview were not accessed or modified; unrelated Vercel and the holding page remain untouched.
