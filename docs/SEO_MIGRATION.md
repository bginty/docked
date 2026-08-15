# Docked SEO migration runbook

Status: **PREPARED — NO DOMAIN CUTOVER OR REDIRECT IMPORT VERIFIED**  
Last updated: 13 August 2026

The migration keeps the same apex domain, `https://docked.com.au`, but replaces an unrelated finance information site with an Australian adult pool-leisure Shopify store. Preserving topical accuracy is more important than redirecting every historical URL. Google cautions that irrelevant redirects can be treated as soft 404s; Shopify redirects should be used only for a broken source URL with a real destination.

## Canonical and indexation target

- Primary canonical domain: `https://docked.com.au`.
- `https://www.docked.com.au` should redirect consistently to the apex after Shopify connection.
- Primary market: Australia; language: Australian English; currency: AUD.
- Use Shopify's generated canonical tags, `sitemap.xml` and default `robots.txt` unless a reviewed exception exists. Shopify documents these as built-in SEO features and warns that incorrect `robots.txt.liquid` changes can remove traffic.
- Do not submit the Shopify sitemap, request indexing or expose Draft products while the legacy site is still production or the store is an unapproved prelaunch.
- Because the hostname is not changing, do **not** use Google Search Console's Change of Address tool. This is a hosting/content and path migration on the same domain.

Official references: [Shopify SEO overview](https://help.shopify.com/en/manual/promoting-marketing/seo/seo-overview), [Shopify sitemap submission](https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map), [Shopify URL redirects](https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect), [Shopify robots.txt guidance](https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt), and [Google site-move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## Audited legacy URL decisions

The source inventory is [Legacy site inventory](LEGACY_SITE_INVENTORY.md). Import only the three approved mappings in [`data/url-redirects.csv`](../data/url-redirects.csv), and only after each destination exists and is approved.

| Legacy path | Decision | Destination / response | Reason |
| --- | --- | --- | --- |
| `/` | Same path, no redirect | New Shopify home | Canonical entry remains the home page |
| `/index.html` | Redirect | `/` | Equivalent alternate home entry |
| `/about.html` | Redirect after page publication | `/pages/about-docked` | Both are organisational “About” destinations; new page must clearly describe the ecommerce business |
| `/privacy.html` | Redirect after policy publication | `/policies/privacy-policy` | Both are privacy destinations, but the new reviewed commerce policy fully replaces the obsolete borrower-data policy |
| `/faq.html` | No redirect | Shopify branded 404 (or an intentional 410 only if a supported edge layer is later approved) | Historical questions concerned home lending; the new product FAQ is not equivalent |
| `/terms.html` | No redirect | Shopify branded 404 / optional supported 410 | Finance calculator/referral terms are not equivalent to ecommerce terms |
| `/preview.html` | No redirect | Shopify branded 404 / optional supported 410 | Historical broker lead preview has no commerce equivalent |
| `/#calculators`, `/#affordability`, `/#daily-answer`, `/#lead` | No redirect rule | Fragment is client-side and not sent to the server | Remove matching IDs/content; do not manufacture topical destinations |

Shopify's native redirect manager does not provide a general 410 control. A correct branded 404 is acceptable for these obsolete, unrelated paths; do not add an app or edge proxy solely to return 410. Do not redirect `/faq.html` to `/pages/faq` or `/terms.html` to a commerce policy merely because the page labels are similar.

## Before cutover

- [ ] Confirm final production routes exist, return 200 without preview parameters and have the intended templates.
- [ ] Keep all unapproved products Draft; verify Draft or hidden resources are absent from navigation, feeds, internal search and sitemap.
- [ ] Approve one unique title, meta description and H1 for every indexable product, collection and page.
- [ ] Use Australian spelling in visible copy (`motorised`, `colour`, `manoeuvrability`). Common `motorized` search spelling may appear naturally in metadata/search synonyms without making visible copy inconsistent.
- [ ] Target adults 18+; do not target children's, baby or toddler pool-product queries.
- [ ] Verify claims, specifications, availability, price and GST display against [Content source of truth](CONTENT_SOURCE_OF_TRUTH.md).
- [ ] Verify descriptive exact-image alt text. Do not keyword-stuff or describe placeholder art as a product.
- [ ] Ensure breadcrumbs and internal links resolve directly in one hop.
- [ ] Confirm a single accurate Product/Offer structured-data graph based on live Shopify data. Do not output Review/AggregateRating without genuine verified reviews.
- [ ] Use FAQ structured data only if the same qualifying question/answer content is visible and the markup remains appropriate under current search-engine rules.
- [ ] Confirm Organisation data uses the approved legal/public details and no unverified social profile.
- [ ] Scan deployed theme output, metadata, JSON-LD, menus, forms and asset names for former finance-business language listed in [Legacy site inventory](LEGACY_SITE_INVENTORY.md). Historical docs are excluded from the deployed theme scan.
- [ ] Confirm no former analytics ID, finance conversion goal, form endpoint, service worker, manifest cache or finance social image is present.
- [ ] Crawl the unpublished preview while authenticated and record broken links, redirect chains, canonical conflicts, duplicate titles/H1s, missing alt text and schema errors.
- [ ] Export current Google Search Console coverage, sitemap status, top queries/pages, external links and recent crawl errors if owner access exists. No access has been verified.
- [ ] Record a complete DNS-zone export and follow [DNS before change](DNS_BEFORE_CHANGE.md) and [Rollback plan](ROLLBACK_PLAN.md).

## Redirect import procedure

1. Publish and review the three destination resources in the target Shopify store, but keep the storefront password-protected until launch authority.
2. In Shopify Admin go to **Content > Menus > URL redirects > Import**.
3. Upload [`data/url-redirects.csv`](../data/url-redirects.csv), review the preview and import.
4. Confirm each source is eligible to redirect and each target resolves. Shopify redirects work only from broken URLs and reserves some paths.
5. Record the import operator, time, row count and redacted Admin result.
6. After domain cutover, test each mapping without an Admin session and with query parameters. Confirm one permanent hop, HTTPS and the apex canonical.
7. Confirm `/faq.html`, `/terms.html` and `/preview.html` return the branded not-found response and are not redirected by an app, CDN or stale rule.

Do not import a speculative redirect and do not add `/collections/all` or other Shopify-reserved source paths.

## Cutover window

- [ ] Obtain dated owner launch approval and confirm rollback operator availability.
- [ ] Freeze content/handle changes; export the final redirect list and Shopify catalogue snapshot.
- [ ] Connect only the web records Shopify shows for this store. Preserve all MX, SPF, DKIM, DMARC, CAA, SRV and verification records; do not change nameservers merely to connect Shopify.
- [ ] Set `docked.com.au` as primary and confirm `www` canonical behaviour and valid SSL.
- [ ] Verify the home page, one approved collection/product if any are Active, cart, search, policies, contact, 404, `robots.txt` and `sitemap.xml` from a signed-out browser.
- [ ] Keep products and checkout unavailable if payment, safety, inventory or shipping launch gates remain open.

## Search Console and post-launch monitoring

After the production domain and policies are approved:

- [ ] Verify the existing or new Search Console **Domain property** for `docked.com.au` using an owner-controlled method that does not disturb mail DNS.
- [ ] Submit `https://docked.com.au/sitemap.xml`; remove obsolete legacy sitemap submissions if present.
- [ ] Inspect the home page and representative product, collection, page and 404 URLs with URL Inspection; request indexing only for approved indexable URLs.
- [ ] Monitor Page indexing, HTTPS, Core Web Vitals, Merchant listings/Product snippets and manual/security actions.
- [ ] Review server/Shopify 404 reports and Search Console “not found” URLs weekly for the first month. Add a redirect only where a genuine equivalent exists.
- [ ] Compare organic landing pages and queries with the pre-cutover export. Expect the unrelated historical topic to fall away; do not attempt to retain it with misleading commerce redirects or copy.
- [ ] Re-test canonical host, redirects, schema, sitemap and finance-language exclusion after every handle, app, market or theme change.

## Migration evidence record

| Gate | Status | Evidence / operator / timestamp |
| --- | --- | --- |
| Final titles, metadata and H1 review | Not run |  |
| Structured-data validation | Not run |  |
| Redirect import (3 approved rows) | Not run |  |
| Unrelated legacy paths return 404/approved 410 | Not run |  |
| Canonical apex and `www` redirect | Not run |  |
| Shopify sitemap submitted | Not run |  |
| Former finance copy/tracking exclusion | Not run |  |
| 7-day and 30-day Search Console review | Not run |  |

