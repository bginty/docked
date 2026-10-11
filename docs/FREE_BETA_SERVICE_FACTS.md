# Free NFL beta: existing services and release gates

11 October 2026. Current low-cost operating plan. Paid-product requirements do not block the free ten-person AU18+ invitation beta. No subscription, upgrade, paid verification service or replacement mail infrastructure was created.

## Support mailbox: verified configuration

**Service: Exchange Online.** Live DNS returns `docked-com-au.mail.protection.outlook.com` as Docked's MX. MX alone could represent a gateway; stronger corroboration is the successful Graph application-only send, owner-confirmed support Inbox receipt, and owner-supplied Exchange Application Mail.Send assignment scoped to `support@docked.com.au`.

Tenant: `b34880d6-d28e-40c2-b389-232506c69650`. Existing application: `b725bf93-6183-40c5-9aac-839e02ace03a`. The 9 October receipt records certificate client-credentials authentication against that tenant. This is not merely a personal Outlook.com delegated-mail connection. [Authentication evidence](qa/fantasy-production/graph-application-preflight.json), [delivery evidence](qa/fantasy-production/hosted-mail-queue.json), [Microsoft application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

**Administrator and reseller confirmed by the owner, 11 October 2026:** `support@docked.com.au` is both the mailbox and the existing Microsoft 365 administrator sign-in, purchased through GoDaddy. Use GoDaddy Email & Office and its linked Microsoft administration. This resolves account identity; do not ask again or use the unrelated personal Microsoft account. See [GoDaddy mailbox evidence](GODADDY_MAILBOX_EVIDENCE.md) for the exact read-only check and narrowly scoped unanswered facts. No new tenant, mailbox, licence or app is needed.

**Application dependency:** the working transactional sender depends on the existing tenant and mailbox-scoped Exchange assignment. Keep it. Sending permission does not confer mailbox-reading/retention-administration permission. No permission expansion, new diagnostic message or invitation occurred.

**Signed-in evidence and exact next action:** the owner completed Email & Office sign-in; the authenticated page confirms Docked Support and lists Advanced Email Security. Admin → Advanced returns “Something's gone wrong.” Direct https://admin.exchange.microsoft.com/ redirects the known `support@docked.com.au` account to a separate GoDaddy Microsoft 365 sign-in saying “Please sign in again to continue.” Complete password/MFA in that new browser tab and leave Exchange open. No need to repeat the already-completed mailbox-settings login, identify another administrator or purchase a plan. Exchange location/holds and the listed security add-on's retention still require inspection.

Inspect only support settings and Docked configuration, never personal inbox content.

## Minimal privacy verification

- Prefer selected-message **Save as .eml** in existing Outlook for support exports. Paid Purview/eDiscovery is **not required** for ten testers. [Microsoft export instructions](https://support.microsoft.com/en-us/outlook/mail/save-an-outlook-message-as-a-eml-file-a-pdf-file-or-as-a-draft). Demonstrate with the already-existing synthetic Docked test message; do not send another.
- Read support-mailbox retention/hold properties and organisation hold IDs using `scripts/microsoft-privacy-evidence.ps1` in the existing authorised session. Inspect Purview only if an applicable existing hold/label/policy requires it. Do not purchase access. Unknown holds remain unknown.
- Record Exchange at-rest location if exposed by existing settings; otherwise mark unverified. That is not all processing locations. [Microsoft data locations](https://learn.microsoft.com/en-us/microsoft-365/enterprise/m365-dr-services-data-location?view=o365-worldwide).
- Visible-folder deletion is not immediate permanent erasure; recovery and holds can retain copies. [Microsoft deleted-item retention](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-user-mailboxes/change-deleted-item-retention). App export/de-identification tests do not prove mailbox/provider deletion.

The approved retention intent stands. Proposed provider-qualified replacement wording:

> We revoke beta access on a verified closure request and aim to remove eligible account details and published content within 30 days. We keep only necessary ownership/game evidence for unresolved rounds or disputes, then remove identity links under our beta schedule. Routine support cases are scheduled for removal 12 months after closure. Our operational-log target is no more than 30 days and security-log target no more than 90 days, except documented incidents reviewed at least every 90 days. Some provider logs expire sooner. Recoverable copies, backups and applicable holds may remain after active records are removed; we do not promise instant erasure of those copies. We explain known limitations when handling a request and reapply completed deletions before restored data returns to active use. Microsoft, Supabase and Vercel provide email, database/authentication and hosting. We do not claim all processing occurs in Australia.

This is concrete proposed wording, not a claim of verified holds or automatic deletion. Preserve approved policy bytes; reconcile the actual free-beta policy packet before invitations. No paid compliance console is a launch requirement.

## Costs: reuse existing capacity

| Service | Current evidence / published rate | Additional subscription proposed |
|---|---|---|
| Supabase | Docked org API confirms existing Pro; published base US$25/month, one Micro covered by compute credit. Actual compute/add-ons/usage invoice not audited. | None |
| Vercel | Docked team API confirms existing active Pro, USD; published US$20/month platform fee includes one deployer and US$20 usage credit. Extra seats/usage invoice not audited. | None |
| NFL data | nflverse downloadable data has no subscription charge; attribution, cache and retention controls remain. Execution/storage uses existing quotas. | $0 |
| Support email | Existing Exchange Online mailbox/application; actual reseller/mailbox renewal **UNKNOWN**. Do not assume free because a personal account is open. | None |
| Domain / holding host | Existing services; actual renewal/hosting invoice **UNKNOWN**. | None |
| Payments, prizes, withdrawals, KYC | Disabled; no identity documents collected. | $0 |

Known published platform base: **US$45/month**, not the total bill. Tax, usage, email/domain/legacy host may add to it. Proposed new subscriptions: **$0**. Do not downgrade/rebuild working infrastructure to change account type. [Supabase pricing](https://supabase.com/pricing), [Vercel Pro](https://vercel.com/docs/plans/pro-plan). Team receipt: `qa/nfl-member/current-cost-plan.json`; Supabase org `otldyeunbqabbcjydjpe` returned `plan=pro`.

Supabase Pro documents seven-day backups/log retention; Vercel Pro runtime logs ordinarily last one day (30 with an optional add-on). These are plan capabilities, not an audit of every actual drain/export/hold. Shorter native windows do not justify a retention upgrade for this beta. [Supabase](https://supabase.com/pricing), [Vercel runtime logs](https://vercel.com/docs/logs/runtime).

## A — required for friends

1. Narrow support settings/export check and provider-qualified policy packet. Existing operator/process, retention intent and player eligibility approvals stand.
2. Domain/callback/recovery configuration and authenticated browser acceptance after release preparation. Ordinary member AAL1, admin MFA, server admission and ten-person cap remain. No shared hosting bypass.
3. Owner supplies/authorises recipients before sending. No invitations yet.
4. Observe a fresh hosted bulk dataset download on its bounded schedule; cached-task and scheduled-reconciliation passes are not fresh-download runtime proof. Inspect failures before depending on unattended scores.
5. S24/visual human acceptance remains pending, separate from automated tests.

## B — paid products/withdrawals only

Commercial card/artwork rights, paid-pack method/supply, merchant approval, tax/refund terms, live payment reconciliation, cash prizes, KYC vendor/beneficiary verification and withdrawal compliance. All disabled; none blocks this free beta.

## C — later growth

Dedicated transactional provider, expanded observability, paid feeds/higher capacity, richer EPL data, automated support and paid eDiscovery only if demonstrated need. EPL remains unavailable until verified; no NFL dependency. No new subscriptions proposed.
