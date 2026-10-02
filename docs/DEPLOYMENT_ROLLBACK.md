# Preview, deployment and rollback

## Current deployment is untouched

Original production: GitHub Pages, bginty/docked, main/root, commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8`, domain docked.com.au. Remote main was verified read-only on 2 October 2026. The original working source `0b7baa1d86126888a485221e03c10c94bfb54949` is tagged `docked-storefront-before-value-2026-10-02`. Old source/assets are retained under legacy/storefront; historical deployment evidence remains in docs/STATIC_PAYPAL_*. No order/fulfilment/accounting storage was touched.

## Local preview

```powershell
npm ci
npm run build
npm run start
```

Open http://localhost:3000. APP_ENV defaults to preview; tips, registration and sending remain pending without explicit configuration. To develop use `npm run dev`. This is a Next.js server application, not a static export. Do not upload the repository root to Pages. For standalone hosting copy .next/static and public into the standalone deployment according to Next's official instructions, then run its server with HOSTNAME/PORT configured. The standard local start command uses Next's server; a standalone warning does not indicate a failed local preview.

## Before any hosted preview

Identify a dedicated Docked project, region and budget; supply distinct preview database/auth configuration and a safe mail sink. Build the exact reviewed branch with pinned dependencies. Keep noindex and access protection, all production flags off. Apply the migration only to the approved empty preview database. Run Auth verification/recovery/deletion, MFA, publication/expiry/settlement/correction and notification suppression with local/authorised fixtures. Obtain a shareable preview URL and record its immutable build commit.

## Production cutover — not executed

Pass docs/LAUNCH_CHECKLIST.md. Record the exact release authority, reviewed commit, hosting project, database and expected domain records. Export DNS first; preserve MX, SPF, DKIM, DMARC, nameservers and unrelated domains. Keep the old Pages project and production data. Change only approved web A/AAAA/CNAME records after the new environment is healthy. Confirm apex/www HTTPS, canonical/sitemap/favicon/social metadata, retired URLs, cache invalidation and no checkout scripts. Do not activate ads/affiliates/paid plans.

Record public launch once in private.launch_record with authority. Database constraints prevent resetting it. A redeployment never creates or updates this row. No automatic paid conversion exists.

## Rollback procedure

Pause new publication and sending first. Preserve all publication/settlement/outbox evidence and do not reverse production database data. Roll application hosting to the last reviewed deployment while retaining compatible additive schema. If restoring prior domain routing, use the recorded prior web DNS only; never alter email records. The old storefront may only be restored if its offer/payment state is independently reconfirmed and the owner authorises that rollback; otherwise deploy an approved neutral maintenance page with legacy support. Never restore historical finance content.

Verify the exact served commit, source health, no duplicate sends after worker restart, archived-record access and HTTPS. Record incident, actor, rollback target, timestamps and post-rollback checks. A local restore drill does not authorise production DNS or data changes.
