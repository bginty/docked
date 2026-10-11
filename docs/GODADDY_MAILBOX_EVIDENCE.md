# Docked support mailbox — read-only evidence

Checked 11 October 2026. This is a settings audit, not permission to change the tenant or purchase services.

## Established facts

- Owner confirms GoDaddy sold the existing Microsoft 365 mailbox; `support@docked.com.au` is also its administrator login.
- Existing tenant `b34880d6-d28e-40c2-b389-232506c69650` and certificate-authenticated Graph sender already passed delivery acceptance. Exchange application send permission is scoped to the support mailbox. Sending does not grant settings/read access.
- Fresh DNS readback confirms Exchange Online MX. This corroborates the sender evidence but does not establish geographic location.
- Authenticated GoDaddy Email & Office settings were inspected on 11 October after the owner completed sign-in. The page identifies `support@docked.com.au`, display name Docked Support, and lists **Advanced Email Security** under Add-Ons. This verifies the displayed add-on, not its preservation configuration or a separate Backup/Archiving subscription. No personal inbox was read; no message sent or deleted; no permissions or policies changed.
- **Exchange sign-in completed:** the owner completed the separate federation sign-in. The authenticated Exchange admin center at `https://admin.cloud.microsoft/exchange#/mailboxes` shows one UserMailbox, Docked Support / `support@docked.com.au`. Its Mailbox tab shows **Default MRM Policy**, **no forwarding configured**; Others shows **archive disabled**; Manage litigation hold shows **Off**. No setting was changed or saved.
- GoDaddy Admin → Advanced still errors. Both the linked Microsoft 365 admin-center action and direct `https://admin.microsoft.com/` redirect to GoDaddy Email & Office, rather than an Organization Data Location page. Location remains a reseller evidence question, not a request for another sign-in or administrator identity.
- **Selected-message export passed:** following explicit owner approval for only “Docked hosted email queue check ded93c7bd111”, Outlook → More items → Download → Download as EML saved the existing synthetic message. Verified subject, expected diagnostic reference and decoded no-action/no-verification-link statement. No mail was sent or deleted. Receipt: `qa/friends-cutover/mailbox-evidence.json`. The local synthetic export is in Downloads; do not commit message contents.
- Outlook Deleted Items is empty and exposes **Recover items deleted from this folder**. The Exchange admin **Recover deleted items** button was disabled. Neither proves the recovery duration, permanent erasure or absence of holds. No recovery/purge action was executed.
- GoDaddy's [Advanced Admin Centers instructions](https://www.godaddy.com/en-ph/help/access-advanced-admin-centers-32132) say all its Microsoft 365 email plans can access Exchange administration. Paid Purview is not a prerequisite for this audit.

## Remaining provider-controlled facts — follow-up, not another sign-in request

| Fact | Exact evidence to inspect | Current state |
|---|---|---|
| Exchange mailbox at-rest geography | Existing Microsoft admin Settings → Org settings → Organization profile → Data location, Exchange row, if exposed; mailbox region readback as corroboration | Not verified; neither AU domain nor tenant country proves mailbox geography |
| Mailbox retention | Exchange support recipient's retention policy name and linked tag actions/ages; `RetainDeletedItemsFor`, `SingleItemRecoveryEnabled`, `RetentionHoldEnabled`, `ElcProcessingDisabled` | Default MRM Policy verified; effective tags/durations and other listed properties not exposed in inspected UI |
| Applicable holds | Mailbox litigation/in-place/label/delay holds plus organisation-wide in-place holds; identify any actual applicable policy through existing access or reseller | Litigation hold Off verified. Organisation/in-place/label/delay holds remain unverified; litigation Off does not establish their absence |
| Optional recovery services | Existing GoDaddy Email Backup, Email Archiving or Advanced Email Security add-ons and any configured retention | Advanced Email Security is listed in authenticated settings. Its retention/quarantine behaviour and separate Backup/Archiving subscriptions are not verified; do not buy an add-on |
| Selected support export | In support Outlook, select the owner-approved synthetic Docked diagnostic only; inspect/download `.eml` | PASS: actual 3,147-byte EML downloaded and content identity verified |
| Deletion/recovery | Inspect support Deleted Items/recoverable-items controls and retention labels without deleting messages | Empty Deleted Items and recover-items link verified. No deletion executed; recovery period and hold effects not established |

`scripts/microsoft-privacy-evidence.ps1` is a read-only alternative within an already authenticated Exchange session bound to the exact tenant. It does not install modules, expand grants or connect to another account.

## Provider documentation versus account settings

GoDaddy documents [message recovery](https://dk.godaddy.com/help/restore-a-deleted-message-in-outlook-41688?lc=en-US): by default Deleted Items can retain messages indefinitely; after removal from that folder it describes a 14-day recovery period. That is general guidance, **not a verified Docked setting or hold exemption**. [Microsoft](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-user-mailboxes/change-deleted-item-retention) explains configurable deleted-item retention. Holds can change effective preservation.

The optional [GoDaddy Email Backup product](https://www.godaddy.com/en-ca/help/what-is-email-backup-26444) can retain content after a mailbox is removed. Its existence does not prove Docked subscribes to it. Check current add-ons before making any erasure-duration promise. Ordinary deletion and infrastructure resilience are not the same as a customer-configured backup service.

For the listed Advanced Email Security add-on, [GoDaddy's quarantine documentation](https://www.godaddy.com/help/access-and-release-quarantined-emails-using-advanced-email-security-32047) describes a default 30-day quarantine. This is a provider default, not a readback of Docked's settings, and is distinct from Microsoft quarantine and mailbox Deleted Items. Do not use it as a blanket mailbox-erasure promise.

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

Additional account-specific context: authenticated Exchange confirms Default MRM Policy, litigation hold Off and archive Disabled; Outlook selected-message EML export works. The Microsoft 365 organization-admin route redirects to GoDaddy and Admin → Advanced errors. Please provide only the remaining location, effective policy/tag/recovery settings, organisation/in-place/label/delay holds and security/backup preservation details above. No enquiry has been sent.

## Policy reconciliation

The approved operator process and category retention schedule stand. Use the provider-qualified wording in [FREE_BETA_SERVICE_FACTS](FREE_BETA_SERVICE_FACTS.md). Add GoDaddy as the reseller/administration provider alongside Microsoft as email platform; do not claim exclusive Australian processing, instantaneous backup erasure, or automatic mailbox deletion jobs.

Only if an actual hold/add-on materially conflicts with the approved handling of active records do we need a concrete revised commitment. The remaining properties stay unknown; do not call the mailbox wholly free of holds. Historical rc2 bytes and existing owner consent remain unchanged. The final prepared packet is [2026-10-11-beta-rc3](policies/2026-10-11-beta-rc3/privacy.md), superseding the earlier qualified draft. It explicitly separates active-record targets from provider recovery/quarantine/backups/holds and disclaims unverified geography and all-copy erasure deadlines. The remaining enquiry is follow-up, not an automatic free-beta launch blocker; it remains unsent. Activation depends on the technical release checks in [NFL_RELEASE_CURRENT](NFL_RELEASE_CURRENT.md).
