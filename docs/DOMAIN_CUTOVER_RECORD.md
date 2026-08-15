# Docked domain cutover record

Status: **NOT AUTHORISED — DOMAIN UNCHANGED**
Last updated: 15 August 2026 (Australia/Sydney)

`docked.com.au` continues to serve the legacy GitHub Pages finance site. No production DNS record has been changed. The public read-only observations below supplement [DNS before change](DNS_BEFORE_CHANGE.md); they are not a complete private DNS-zone export and do not prove provider write access.

## Current public DNS and web evidence

| Name | Type | Observed value | Observed TTL / note |
| --- | --- | --- | --- |
| `docked.com.au` | A | `185.199.108.153` | 600 |
| `docked.com.au` | A | `185.199.109.153` | 600 |
| `docked.com.au` | A | `185.199.110.153` | 600 |
| `docked.com.au` | A | `185.199.111.153` | 600 |
| `docked.com.au` | AAAA | No public answer observed | Do not infer absence from the private zone without export |
| `docked.com.au` | CNAME | No public answer observed | Apex uses A records |
| `www.docked.com.au` | CNAME | `bginty.github.io` | 3600 |
| `docked.com.au` | MX | priority 0, `docked-com-au.mail.protection.outlook.com` | Preserve |
| `docked.com.au` | TXT | `NETORG20352344.onmicrosoft.com` | Preserve |
| `docked.com.au` | TXT/SPF | `v=spf1 include:secureserver.net -all` | Preserve; operational alignment not tested |
| `_dmarc.docked.com.au` | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | Preserve |
| `autodiscover.docked.com.au` | CNAME | `autodiscover.outlook.com` | Preserve |
| `docked.com.au` | CAA | No public answer observed | Re-check provider export |
| `docked.com.au` | NS | `ns35.domaincontrol.com`, `ns36.domaincontrol.com` | GoDaddy-managed DNS; do not change nameservers |
| `docked.com.au` | SOA | Serial `2026081400` | Read-only 15 August observation; previous record was `2026053006` |
| DKIM selectors | TXT/CNAME | No repository selector; common selector probes returned NXDOMAIN | **DKIM remains unverified**; provider/mail-admin review required |

Web observations rechecked on 15 August 2026 at approximately 10:36 AEST:

- HTTPS apex returned 200 from GitHub Pages/GitHub infrastructure.
- HTTPS `www` returned 301 to the apex.
- The TLS certificate covered the apex and `www` and was valid through 28 October 2026 at observation time.
- Plain HTTP apex did not upgrade to HTTPS, no HSTS header was observed, and no canonical link was observed on the legacy page.
- The support address is configured in Shopify, but Email domain authentication reports **Needs setup** and no successful end-to-end mailbox test exists.
- The GitHub Pages rollback remains live.

These are dated observations, not guarantees at the future cutover time. Re-query immediately before and after any authorised change.

## Required full-zone backup

Before a cutover, an authorised DNS operator must export or screenshot every configured provider record and setting, including A, AAAA, CNAME, MX, TXT, SPF, every DKIM selector, DMARC, CAA, SRV, verification records, forwarding, DNSSEC, configured TTLs and domain locks. Public DNS cannot enumerate a private zone. Store the sensitive export in the approved controlled evidence location and record only a redacted reference here.

| Evidence | State |
| --- | --- |
| DNS-provider authenticated access | Not available/evidenced |
| Full private-zone export | Not captured |
| Shopify store access | Shopify CLI authenticated to `cfbexf-h4.myshopify.com`; this does not provide DNS-provider access |
| Shopify domain screen | Inspected; only `cfbexf-h4.myshopify.com` is connected and primary; no custom domain is connected |
| Shopify ownership-verification record | Not available because `docked.com.au` has not been connected |
| Shopify required apex value | Not obtained; no authorised connect-domain flow was started |
| Shopify required `www` value | Not obtained; no authorised connect-domain flow was started |
| Shopify verification TXT | Unknown |
| Authorised DNS operator | Not named |
| Cutover timestamp/window | Not authorised |

## OWNER DNS ACTION REQUIRED

**State: NOT AUTHORISED AND NOT EXECUTABLE. Do not apply this card now.**

This card becomes executable only after Shopify preview QA passes, the exact DOCKED business-name issue is resolved, the complete provider export exists, support email works, rollback access is confirmed, and the applicable exact owner authorisation phrase has been received in the active Codex session.

At execution time, copy the required values from **Settings → Domains** in the authenticated `cfbexf-h4.myshopify.com` Admin. Do not blindly use generic Shopify values or values saved in old instructions. The commonly documented examples `23.227.38.65` and `shops.myshopify.com` are references only, not authorised target values.

The authorised operator must remove all four GitHub Pages apex A records and then create **exactly one** Shopify apex A record. Do not replace each old A record with the Shopify value, which would create four duplicate Shopify records.

| Order | Action | Record | Host | Old/current value | New value | Authority/state |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Delete | A | apex / `@` | `185.199.108.153` | — | Not authorised; do not edit |
| 2 | Delete | A | apex / `@` | `185.199.109.153` | — | Not authorised; do not edit |
| 3 | Delete | A | apex / `@` | `185.199.110.153` | — | Not authorised; do not edit |
| 4 | Delete | A | apex / `@` | `185.199.111.153` | — | Not authorised; do not edit |
| 5 | Add exactly once | A | apex / `@` | None after steps 1–4 | **Copy the exact current apex value from Shopify Admin** | Not obtained; do not edit |
| 6 | Change | CNAME | `www` | `bginty.github.io` | **Copy the exact current `www` target from Shopify Admin** | Not obtained; do not edit |
| 7 | Add only if required | TXT | Shopify-specified host | None known | **Use only the unique value displayed by Shopify Admin** | Unknown; do not invent |

Records and settings that must remain untouched unless a separately authorised, verified change specifically requires them:

- MX `0 docked-com-au.mail.protection.outlook.com`;
- SPF `v=spf1 include:secureserver.net -all`;
- DMARC at `_dmarc`;
- Microsoft tenant TXT `NETORG20352344.onmicrosoft.com`;
- `autodiscover` and every DKIM selector;
- unrelated verification TXT records, CAA and SRV records;
- nameservers `ns35.domaincontrol.com` and `ns36.domaincontrol.com`;
- the GitHub Pages repository, branch, tag, files and configuration.

Do not change nameservers or transfer the domain to Shopify. Web-record cutover must not be combined with an unverified email migration.

## Preconditions for any DNS write

- [x] The target store is authenticated and confirmed through Shopify CLI; re-confirm immediately before a future DNS write.
- [x] A permanent unpublished theme preview exists.
- [ ] Full rendered QA has passed; current evidence is partial manual in-app-browser QA only.
- [ ] The exact DOCKED business-name issue is resolved with documented evidence.
- [ ] The intended mode—public prelaunch or full live sales—is confirmed.
- [ ] The matching exact authorisation phrase is received and recorded.
- [ ] The full provider zone export, configured TTLs and rollback operator are recorded.
- [ ] Support email inbound/outbound/reply and sender authentication are verified.
- [ ] The approved theme/content state matches the intended mode.
- [ ] Shopify Admin's current required DNS values are copied and independently checked.
- [ ] The legacy GitHub Pages site and HTTPS are reachable for rollback.

## Cutover verification record

All custom-domain cutover checks are **Not run**. The three redirect definitions were imported into Shopify Admin and partially exercised on the password-protected `myshopify.com` candidate: `/index.html` served homepage content, `/privacy.html` reached Shopify's privacy policy, and `/about.html` reached its intended hidden About Docked target and therefore remains 404 pending the business-name gate. Their future `docked.com.au` behaviour has not been tested:

- Shopify ownership/domain verification;
- apex and `www` resolution from multiple public resolvers;
- primary apex selection and `www` redirect;
- valid Shopify TLS certificate and HTTPS;
- canonical tags, sitemap and robots;
- intended theme/content, password and checkout mode;
- three approved redirects and unrelated finance-route 404 behaviour;
- absence of legacy finance copy from the new site;
- inbound/outbound support email after propagation; and
- preservation of MX, SPF, DKIM, DMARC and unrelated verification records.

Record the exact old/new values, operator, provider change ID, Shopify verification result, timestamps, propagation observations and redacted screenshots only after an authorised change.

## Immediate rollback values

If an authorised cutover later causes a confirmed critical fault, restore:

- apex A: `185.199.108.153`
- apex A: `185.199.109.153`
- apex A: `185.199.110.153`
- apex A: `185.199.111.153`
- `www` CNAME: `bginty.github.io`

Preserve all mail, identity and verification records. Verify both HTTPS hosts and support email after propagation. The full procedure is [Production rollback](PRODUCTION_ROLLBACK.md).
