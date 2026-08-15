# DNS snapshot before any Docked cutover

Snapshot timestamp: 13 August 2026, approximately 22:38 AEST (UTC+10)

No DNS record was changed. Values below were read from public DNS and TTLs are the observed remaining TTL, not necessarily the zone's configured maximum.

## Web records

| Name | Type | Value | Observed TTL |
| --- | --- | --- | ---: |
| `docked.com.au` | A | `185.199.108.153` | 458 |
| `docked.com.au` | A | `185.199.109.153` | 458 |
| `docked.com.au` | A | `185.199.110.153` | 458 |
| `docked.com.au` | A | `185.199.111.153` | 458 |
| `www.docked.com.au` | CNAME | `bginty.github.io` | 3600 |

The four apex A records and `www` CNAME point to the existing GitHub Pages deployment. Public browser testing confirmed that `www` redirects to the apex HTTPS host.

No apex AAAA or apex CNAME record was returned.

## Mail and identity records

| Name | Type | Value | Observed TTL |
| --- | --- | --- | ---: |
| `docked.com.au` | MX | priority 0, `docked-com-au.mail.protection.outlook.com` | 3600 |
| `docked.com.au` | TXT | `NETORG20352344.onmicrosoft.com` | 3600 |
| `docked.com.au` | TXT | `v=spf1 include:secureserver.net -all` | 3600 |
| `_dmarc.docked.com.au` | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | 3600 |

## Authoritative nameservers

| Name | Type | Value | Observed TTL |
| --- | --- | --- | ---: |
| `docked.com.au` | NS | `ns35.domaincontrol.com` | 3600 |
| `docked.com.au` | NS | `ns36.domaincontrol.com` | 3600 |

The nameservers indicate GoDaddy-managed DNS. Nameservers must not be changed merely to connect Shopify.

## Required owner/provider snapshot before a future cutover

Public DNS cannot enumerate every private zone entry. Before changing any record, export or screenshot the complete DNS zone in the provider and record:

- all A, AAAA, CNAME, MX, TXT, CAA and SRV records;
- every DKIM selector and verification record;
- configured TTLs rather than only resolver TTLs;
- current forwarding and domain-lock settings;
- the exact Shopify apex and `www` values shown in Shopify Admin at cutover time.

## Cutover safeguards

- Preserve MX, SPF, DKIM, DMARC, Microsoft/Google/provider verification TXT, CAA and SRV records.
- Change only the web records Shopify explicitly requires.
- Do not change nameservers when record-level changes suffice.
- Do not change DNS until the unpublished Shopify theme, Draft catalogue, test checkout, payments configuration, email, shipping and compliance gates have passed.
- Keep the GitHub Pages deployment and its archive references intact for rollback.
