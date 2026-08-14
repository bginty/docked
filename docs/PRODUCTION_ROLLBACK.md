# Docked production rollback

Status: **PREPARED — UNPUBLISHED CANDIDATE ONLY; NO PRODUCTION CUTOVER HAS OCCURRED**
Last updated: 14 August 2026 (Australia/Sydney)

The public site still uses the legacy GitHub Pages deployment, so no immediate rollback is required. This plan defines three independent recovery methods for a future authorised Shopify release. It supplements the original [Rollback plan](ROLLBACK_PLAN.md) and does not authorise a publication, DNS write or deletion.

Current commerce safety state: the Docked candidate remains unpublished and password-protected; all 15 product shells are Draft with inventory not tracked, no images and channels 0; the seven planned collections are empty; Domestic Australia has no shipping rates, no international zone exists, local delivery/pickup are off, and no payment provider or live capture is active. Only the `myshopify.com` domain is connected. No commerce or DNS rollback is presently required.

## Recovery assets verified in the project record

| Asset | Recovery reference |
| --- | --- |
| Repository | `https://github.com/bginty/docked` |
| Legacy commit | `b26add982e5f4c7cfab2b13f74a14500d7199530` |
| Archive branch | `archive/docked-finance-site-2026-08` |
| Annotated tag | `docked-finance-site-before-pool-rebuild` |
| Release branch | `release/docked-shopify-production-2026-08` |
| Release starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Legacy apex A | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| Legacy `www` CNAME | `bginty.github.io` |
| Legacy public state | Live/reachable at the latest read-only audit |
| Existing live Shopify theme | `Horizon`, ID `130871099450`; preserved and unmodified |
| Unpublished Docked candidate | `Docked Production Candidate 2026-08`, ID `130871427130` |

Never force-push or delete the archive branch/tag, GitHub Pages repository/configuration, legacy source or documented DNS snapshot.

## 1. Shopify theme rollback

Use when the domain and commerce configuration are sound but the newly published theme causes a critical storefront defect.

Precondition before publication:

- record the current published Shopify theme ID/name and preview it;
- keep it in the Shopify theme library;
- record the tested Docked candidate theme ID, exact commit and authorisation; and
- name the authorised Shopify rollback operator.

Procedure:

1. Confirm the incident is theme-related and capture evidence; do not delete the failing theme.
2. In Shopify Admin, identify the recorded previous live theme by exact ID/name.
3. Publish that preserved theme using Shopify's supported Admin or CLI operation without a force flag.
4. Verify home, navigation, product, cart, checkout entry, policies, account, mobile and console from a signed-out browser.
5. Keep the Docked candidate unpublished for diagnosis and preserve orders/customer records.
6. Record operator, timestamps, old/new theme IDs, incident reference and verification result.

Current rollback theme ID: **`130871099450` (`Horizon`)**. It remains the existing live Shopify theme; because the Docked candidate is unpublished, no theme rollback is currently required. Re-confirm the live theme immediately before any future publication.

## 2. Commerce rollback

Use when a product, price, inventory, shipping, tax, payment, fulfilment, compliance or support defect makes sales unsafe or inaccurate while Shopify itself may remain reachable.

Procedure, limited to the affected scope:

1. Stop advertising/traffic acquisition and notify the launch owner.
2. Return affected products to Draft; if systemic, return every product to Draft.
3. Re-enable storefront password protection or publish the approved non-selling prelaunch experience where appropriate and authorised.
4. Disable the affected payment method; re-enable test mode when supported and appropriate.
5. Disable affected shipping rates/profiles or service regions.
6. Preserve orders, payments, refunds, customer records, evidence and audit logs. Do not delete test/real orders to hide the incident.
7. Triage placed orders and customer notifications under the approved operations, returns and recall procedures.
8. Verify that checkout/live capture is unavailable and no affected SKU remains purchasable.
9. Record products, providers, settings, operator, time, customer impact and recovery conditions.

Do not enter or record bank credentials, identity documents, card data or customer personal data in Git. Do not charge/refund a real transaction without the appropriate authorised workflow.

## 3. DNS rollback

Use after diagnosing a confirmed critical cutover failure that requires restoring the legacy site. Do not roll back merely because propagation is incomplete; first compare authoritative and recursive DNS, Shopify verification, TLS state and configured TTLs.

Only an authorised DNS operator may:

1. Pause commerce/publication as appropriate.
2. Restore these four apex A records:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Restore `www` CNAME to `bginty.github.io`.
4. Remove only a Shopify web-verification record that the cutover evidence specifically identifies as safe to remove.
5. Preserve MX, SPF, every DKIM selector, DMARC, Microsoft/provider verification TXT, CAA, SRV, `autodiscover` and nameservers.
6. Wait for configured TTLs/caches and verify both HTTPS hosts serve the legacy site.
7. Re-test inbound/outbound support email and authentication separately.
8. Record exact records, provider change ID, operator, timestamps and verification evidence.

Do not change nameservers, transfer the domain or delete the Shopify/legacy deployment as part of DNS rollback.

## Verification commands

Use public DNS in addition to provider and Shopify screens:

```powershell
Resolve-DnsName docked.com.au -Type A -DnsOnly
Resolve-DnsName www.docked.com.au -Type CNAME -DnsOnly
Resolve-DnsName docked.com.au -Type MX -DnsOnly
Resolve-DnsName docked.com.au -Type TXT -DnsOnly
Resolve-DnsName _dmarc.docked.com.au -Type TXT -DnsOnly
```

Also verify TLS, apex/`www` behaviour, the visible legacy content, relevant legacy routes and mailbox delivery. DNS answers alone do not prove the application or email works.

## Code recovery without history rewrite

If a clean recovery branch is needed, first confirm the current worktree has no uncommitted work. Do not discard, overwrite or carry unrelated changes. If it is not clean, preserve the work and use a separate clean Git worktree or clone. Then create the recovery branch from the immutable legacy tag:

```powershell
git switch -c recovery/docked-finance-site docked-finance-site-before-pool-rebuild
```

Do not reset, amend or force-push protected or archival history.

## Rollback decision record

Complete this only during a real incident:

| Field | Value |
| --- | --- |
| Incident ID/severity |  |
| Decision authority |  |
| Rollback type | Theme / commerce / DNS |
| Trigger evidence |  |
| Affected theme/products/payments/domain |  |
| Operator and timestamp |  |
| Previous state restored |  |
| Storefront verification |  |
| Checkout/live-capture state |  |
| Email verification |  |
| Customer/order follow-up |  |
| Follow-up owner |  |

See [Domain cutover record](DOMAIN_CUTOVER_RECORD.md), [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md), [Post-launch QA](POST_LAUNCH_QA.md) and [Production launch gates](PRODUCTION_LAUNCH_GATES.md).
