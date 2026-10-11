# Docked support mailbox — read-only evidence

Checked 11 October 2026. This is a settings audit, not permission to change the tenant or purchase services.

## Established facts

- Owner confirms GoDaddy sold the existing Microsoft 365 mailbox; `support@docked.com.au` is also its administrator login.
- Existing tenant `b34880d6-d28e-40c2-b389-232506c69650` and certificate-authenticated Graph sender already passed delivery acceptance. Exchange application send permission is scoped to the support mailbox. Sending does not grant settings/read access.
- Fresh DNS readback confirms Exchange Online MX. This corroborates the sender evidence but does not establish geographic location.
- Authenticated GoDaddy Email & Office settings were inspected on 11 October after the owner completed sign-in. The page identifies `support@docked.com.au`, display name Docked Support, and lists **Advanced Email Security** under Add-Ons. This verifies the displayed add-on, not its preservation configuration or a separate Backup/Archiving subscription. No personal inbox was read; no message sent or deleted; no permissions or policies changed.
- The visible Admin → Advanced link (`https://productivity.godaddy.com/settings#/admin/advanced`) returns **Something's gone wrong**, with a contact-admin message. Direct `https://admin.exchange.microsoft.com/` recognises `support@docked.com.au` and redirects to GoDaddy's Microsoft 365 federation sign-in, displaying **Please sign in again to continue**. The Email & Office session did not carry through to Exchange. That separate password/MFA interaction is now the precise immediate blocker, not an unknown administrator or missing purchased plan.
- GoDaddy's [Advanced Admin Centers instructions](https://www.godaddy.com/en-ph/help/access-advanced-admin-centers-32132) say all its Microsoft 365 email plans can access Exchange administration. Paid Purview is not a prerequisite for this audit.

## Facts still requiring the signed-in configuration

| Fact | Exact evidence to inspect | Current state |
|---|---|---|
| Exchange mailbox at-rest geography | Existing Microsoft admin Settings → Org settings → Organization profile → Data location, Exchange row, if exposed; mailbox region readback as corroboration | Not verified; neither AU domain nor tenant country proves mailbox geography |
| Mailbox retention | Exchange support recipient's retention policy name and linked tag actions/ages; `RetainDeletedItemsFor`, `SingleItemRecoveryEnabled`, `RetentionHoldEnabled`, `ElcProcessingDisabled` | Not verified |
| Applicable holds | Mailbox litigation/in-place/label/delay holds plus organisation-wide in-place holds; identify any actual applicable policy through existing access or reseller | Not verified; empty mailbox hold list alone is insufficient |
| Optional recovery services | Existing GoDaddy Email Backup, Email Archiving or Advanced Email Security add-ons and any configured retention | Advanced Email Security is listed in authenticated settings. Its retention/quarantine behaviour and separate Backup/Archiving subscriptions are not verified; do not buy an add-on |
| Selected support export | In support Outlook, select the existing synthetic Docked diagnostic only; inspect Save as/download `.eml` and the permitted export action | Provider capability documented; account-level operation pending |
| Deletion/recovery | Inspect support Deleted Items/recoverable-items controls and retention labels without deleting messages | Account-level settings pending |

`scripts/microsoft-privacy-evidence.ps1` is a read-only alternative within an already authenticated Exchange session bound to the exact tenant. It does not install modules, expand grants or connect to another account.

## Provider documentation versus account settings

GoDaddy documents [message recovery](https://dk.godaddy.com/help/restore-a-deleted-message-in-outlook-41688?lc=en-US): by default Deleted Items can retain messages indefinitely; after removal from that folder it describes a 14-day recovery period. That is general guidance, **not a verified Docked setting or hold exemption**. [Microsoft](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-user-mailboxes/change-deleted-item-retention) explains configurable deleted-item retention. Holds can change effective preservation.

The optional [GoDaddy Email Backup product](https://www.godaddy.com/en-ca/help/what-is-email-backup-26444) can retain content after a mailbox is removed. Its existence does not prove Docked subscribes to it. Check current add-ons before making any erasure-duration promise. Ordinary deletion and infrastructure resilience are not the same as a customer-configured backup service.

GoDaddy documents [export options](https://www.godaddy.com/en-in/help/export-or-backup-my-contacts-calendar-email-and-tasks-5862); use the existing web client for a selected support message where supported, avoiding a broad export that captures unrelated personal information. Do not purchase desktop Outlook or eDiscovery merely for this check.

## Specific GoDaddy enquiry — prepared, NOT sent

> I administer support@docked.com.au in our existing Microsoft 365 subscription purchased through GoDaddy. Please provide a read-only confirmation for this mailbox in tenant b34880d6-d28e-40c2-b389-232506c69650:
>
> 1. What is its current Exchange Online primary/archive data-at-rest geography, and where can I view that fact? This is not a request for an assurance that all processing is in that geography.
> 2. What mailbox retention policy/tags, deleted-item recovery duration and single-item recovery setting apply? Are any litigation, in-place, organisation-wide, retention-label or delay holds applicable? Please identify their names/IDs and effective preservation, or state which cannot be inspected through my existing plan.
> 3. Are Email Backup, Email Archiving or other preservation/security services currently enabled for this mailbox? If so, what retention and deletion/recovery limitations apply, including after a mailbox/message is removed?
> 4. Using my existing subscription, how can I export selected support messages and remove active/recoverable copies when no hold requires preservation? Please distinguish user deletion, recovery windows and provider backup expiry.
>
> Please do not change settings, create accounts, add permissions, purchase/upgrade services, disable working mail or remove records. If any requested fact requires your internal check, please provide the result rather than quoting an upgrade.

Additional account-specific context for that enquiry: the authenticated mailbox settings list Advanced Email Security, but Admin → Advanced reports “Something's gone wrong.” Please explain the existing-plan administration route and the listed security add-on's quarantine, recovery and retention limits. No enquiry has been sent.

## Policy reconciliation

The approved operator process and category retention schedule stand. Use the provider-qualified wording in [FREE_BETA_SERVICE_FACTS](FREE_BETA_SERVICE_FACTS.md). Add GoDaddy as the reseller/administration provider alongside Microsoft as email platform; do not claim exclusive Australian processing, instantaneous backup erasure, or automatic mailbox deletion jobs.

Only if an actual hold/add-on prevents that approved intent do we need a concrete revised commitment. Until settings are read, label their status unknown internally and keep the new external policy packet pending. Historical approved rc2 bytes and existing owner consent remain unchanged.
