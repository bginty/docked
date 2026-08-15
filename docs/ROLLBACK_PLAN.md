# Docked rollback plan

## Recovery assets

- Legacy repository: <https://github.com/bginty/docked>
- Legacy production commit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Remote archive branch: `archive/docked-finance-site-2026-08`
- Remote annotated tag: `docked-finance-site-before-pool-rebuild`
- Existing GitHub Pages web records are recorded in `docs/DNS_BEFORE_CHANGE.md`.
- `origin/main` and the existing GitHub Pages deployment remain unchanged during rebuild development.

## Rollback before DNS cutover

No public rollback is needed while all Shopify work remains on the rebuild branch or an unpublished theme. Leave `origin/main`, GitHub Pages, and the current DNS untouched.

If rebuild work must be discarded, create a fresh branch from the immutable tag rather than rewriting history:

```sh
git switch -c recovery/docked-finance-site docked-finance-site-before-pool-rebuild
```

Do not force-push `main`.

## Rollback after a future Shopify web-record cutover

Only an authorised DNS operator should perform these steps:

1. Pause theme/product publication or enable Shopify password protection as appropriate.
2. Restore the four apex A records:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Restore `www` as CNAME `bginty.github.io`.
4. Do not alter MX, SPF, DKIM, DMARC, verification TXT, CAA, SRV or nameserver records.
5. Wait for the configured TTLs and resolver caches.
6. Verify `https://docked.com.au/` and `https://www.docked.com.au/` serve the archived finance site over valid HTTPS.
7. Verify inbound and outbound domain email separately.
8. Record the rollback time, operator, records changed and verification evidence.

## Shopify-theme rollback

Shopify retains theme versions and unpublished themes, but no store or theme ID has yet been supplied. Before publication, record the current published theme name/ID and keep it available. If a theme-only rollback is needed, publish the previously verified theme from Shopify Admin and keep the Docked rebuild unpublished for diagnosis.

## Verification commands

Use public DNS and HTTPS checks after any authorised rollback:

```powershell
Resolve-DnsName docked.com.au -Type A -DnsOnly
Resolve-DnsName www.docked.com.au -Type CNAME -DnsOnly
Resolve-DnsName docked.com.au -Type MX -DnsOnly
Resolve-DnsName docked.com.au -Type TXT -DnsOnly
Resolve-DnsName _dmarc.docked.com.au -Type TXT -DnsOnly
```

Also verify the site visually, its certificate, apex/`www` canonical behaviour, and the business mailbox. A DNS response alone is not a complete rollback test.
