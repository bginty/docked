> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Docked transactional email — Microsoft 365 administrator handoff

**Update:** the owner has now registered **Docked Production Email** and its certificate. Live certificate authentication and one owner-confirmed Inbox delivery succeeded, but the send acknowledgement timed out. See [current test report](DOCKED-GRAPH-CONTROLLED-DELIVERY.md) and [remaining read-only Exchange audit](DOCKED-EXCHANGE-READONLY-AUDIT.md). Do not repeat the historical app-creation commands below. The production hook remains disabled.

Prepared 8 October 2026. No Entra application exists yet. The owner confirms `support@docked.com.au` can send and receive. Application authorization and actual delivery are **not verified**. Use the existing Microsoft 365 tenant and license; do not buy Azure services or another mail plan.

The hook has now been deployed in **disabled mode**, version 1, function ID `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, to the dedicated production project. Five actual hosted security checks passed. It is not connected to Supabase Auth and has no Microsoft credentials. No email has been sent. See [current checkpoint](FANTASY-PRODUCTION-MAIL-CHECKPOINT.md).

## Prepared implementation

`supabase/functions/docked-auth-email` implements a signed Supabase Auth Send Email hook using Microsoft Graph and a certificate-based OAuth client assertion. The sender is fixed to `support@docked.com.au`; its only project is `pojoymtniryarxxunyvz`. Links allow only the reviewed Netlify and Docked callbacks. Signup, recovery, magic-link and secure two-address email-change messages are supported. Invitations are deliberately rejected because the current application callback requires PKCE. No tenant-wide mailbox reading is requested.

A 3072-bit RSA certificate and private key were generated locally without installation into a Windows certificate store. The public upload file is:

`C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/production/microsoft365/docked-graph-public.cer`

Upload **only that public certificate**. The adjacent private key must stay in restricted local storage and, once authorized, the production Supabase secret store. Never paste it into chat, send it by email, commit it or place it in Netlify/browser environment variables. Certificate expiry and SHA-256 are recorded in the adjacent private metadata file; schedule rotation before expiry.

The certificate/key match was verified locally. Certificate expiry is **8 October 2027, 11:04:40 UTC**; SHA-256 fingerprint: `842CBED98C6984BD3D2BC15897EFDD46012C465A0ECD18C54769295942B791A1`.

## Administrator steps

1. Sign into the existing Microsoft Entra tenant with your normal MFA-protected administrator account. Create one single-tenant app registration named **Docked Production Transactional Email**. No redirect URI or public-client flow is needed. Record the Directory/Tenant ID and Application/Client ID.
2. In Certificates & secrets → Certificates, upload the prepared `.cer`. Do not create a mailbox password or enable basic SMTP authentication. The backend will authenticate with the private key and short-lived signed assertions.
3. Find the app's **Enterprise application service-principal Object ID**. This differs from the App registration Object ID. Record the former for Exchange's service-principal reference.
4. In Exchange Online, grant **Application Mail.Send** through **RBAC for Applications**, scoped to exactly `support@docked.com.au`. Do **not** add tenant-wide Microsoft Graph `Mail.Send`, `Mail.Read` or `Mail.ReadWrite` application permission in Entra: such grants are additive and can defeat the mailbox scope. No mailbox-read permission is needed by the sender.
5. Verify authorization is allowed for the support mailbox and denied for an administrator-selected different mailbox. Verify that the sender is a valid mailbox or authorized mailbox identity, rather than assuming that a working alias has identical Graph addressing behavior.

Example Exchange Online PowerShell commands for the administrator, after verifying all three GUIDs refer to this newly created app in the intended tenant:

```powershell
Connect-ExchangeOnline
$dockedClientId = '<Application-Client-ID>'
$dockedEnterpriseObjectId = '<Enterprise-Application-Object-ID>'
New-ServicePrincipal -AppId $dockedClientId -ObjectId $dockedEnterpriseObjectId -DisplayName 'Docked Production Transactional Email'
New-ManagementScope -Name 'DockedSupportMailboxOnly' -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'support@docked.com.au'"
New-ManagementRoleAssignment -Name 'DockedSupportSendOnly' -Role 'Application Mail.Send' -App $dockedEnterpriseObjectId -CustomResourceScope 'DockedSupportMailboxOnly'
Test-ServicePrincipalAuthorization -Identity $dockedEnterpriseObjectId -Resource 'support@docked.com.au'
Test-ServicePrincipalAuthorization -Identity $dockedEnterpriseObjectId -Resource '<another-owned-mailbox-for-negative-test>'
```

Inspect existing objects before rerunning commands; reuse matching objects instead of making duplicate registrations or assignments. These commands are a reviewed setup guide, **not commands already executed against your tenant**. If the exact mailbox filter is unsupported by your tenant tooling, stop and use an administrator-reviewed equivalent scope; never fall back to organization-wide permission. Role changes can take time to propagate.

Return only the Tenant ID, Client ID, service-principal Object ID, and the two scope-check outcomes to the agent. These identifiers are not passwords. Also confirm the tenant's actual Exchange data location under Microsoft 365 admin center → Settings → Org settings → Organization profile → Data location, and the existing mailbox retention/hold settings. Do not purchase Advanced Data Residency.

## Agent continuation after authorization

- Validate the certificate/key match and expiry locally; bind the exact tenant and client IDs. Store `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CERTIFICATE_PEM`, `GRAPH_PRIVATE_KEY_PEM`, `SEND_EMAIL_HOOK_SECRET` and `DOCKED_GRAPH_MAIL_ENABLED` only in the production Supabase function secrets. Do not upload any management token or database administrator password to the function.
- Deploy only `docked-auth-email` to project `pojoymtniryarxxunyvz`, from the isolated production CLI workdir. Its gateway JWT verification must be disabled because Supabase uses the Auth-hook signature; mandatory raw-body signature verification remains enabled in the handler. Configure the Auth Send Email hook with the matching signing secret only after the disabled endpoint and Microsoft permission checks pass.
- Keep public registration closed while performing controlled delivery tests. Record Graph acceptance, the received message in the controlled inbox, sender, time and the resulting Auth session. **HTTP 202 is submission acceptance, not delivery confirmation.** Do not log tokens, links, email bodies, private keys or access tokens into public evidence.
- Test signup verification and password recovery through the actual browser's PKCE flow; also test expired links, modified signatures, unsupported redirects and email change. Confirm both current/new-address messages and intermediate confirmation behavior. Do not use Auth admin auto-confirmation as proof of mailbox ownership or email delivery.
- Hooks have a five-second service deadline. The adapter shares a four-second network budget across authorization and sending. It returns a redacted error on timeout or partial delivery. Graph does not provide an exactly-once sending guarantee here; retries may produce duplicate copies of the same one-time link. Do not silently treat a partial two-message change as completed.
- The app's separate optional marketing/digest outbox stays disabled. This integration covers Auth transactional messages; it does not activate marketing or promises of additional notifications.

## Sources checked

[Microsoft certificate credentials](https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials), [Microsoft client-credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow), [Exchange application RBAC and additive permission warning](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [Graph sendMail and 202 semantics](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [Supabase Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Auth-hook deadline](https://supabase.com/docs/guides/auth/auth-hooks), [Microsoft tenant data-location guidance](https://learn.microsoft.com/en-us/microsoft-365/enterprise/m365-dr-overview).
