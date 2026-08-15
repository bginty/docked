# Legacy Docked finance-site inventory

Inventory date: 13 August 2026 (AEST)

## Hosting and canonical behaviour

- Public canonical host: `https://docked.com.au`
- `https://www.docked.com.au/` redirects to `https://docked.com.au/`.
- Hosting: GitHub Pages backed by <https://github.com/bginty/docked>.
- Production source at audit: `origin/main` commit `b26add982e5f4c7cfab2b13f74a14500d7199530`.
- Public source architecture: static HTML, CSS and vanilla JavaScript.
- The home page loads some JavaScript from pinned GitHub commits through jsDelivr and also loads local `script.js`.

## Public and source-visible routes

| Route | Indexed or linked | Legacy purpose | Replacement handling |
| --- | --- | --- | --- |
| `/` | Sitemap and navigation | Finance landing page, calculators, affordability upload, lead forms and FAQ preview | New Shopify home page |
| `/index.html` | Internal links | Alternate home entry | Redirect to `/` |
| `/about.html` | Sitemap and navigation | Finance-site business and referral explanation | Redirect to `/pages/about-docked` after that Shopify page exists |
| `/faq.html` | Sitemap and navigation | Home-loan FAQ | Return a proper 404; the finance content is unrelated to the new product FAQ |
| `/privacy.html` | Sitemap and navigation | Borrower-data and referral privacy policy | Redirect to the reviewed Shopify privacy policy only after publication |
| `/terms.html` | Sitemap and navigation | Finance calculator/referral terms | Return a proper 404; do not imply the new commerce terms are equivalent |
| `/preview.html` | Present in source, omitted from sitemap | Redirect-style finance/broker lead preview | Return a proper 404 |
| `/#calculators` | Navigation | Loan calculators | Obsolete fragment; no redirect needed |
| `/#affordability` | Navigation | Bank-statement affordability check | Obsolete fragment; no redirect needed |
| `/#daily-answer` | Navigation | Daily borrower question | Obsolete fragment; no redirect needed |
| `/#lead` | Navigation and preview redirect | Broker/lender referral enquiry | Obsolete fragment; no redirect needed |

The legacy sitemap listed `/`, `/faq.html`, `/about.html`, `/privacy.html`, and `/terms.html`, with last-modified dates of 7 June 2026. `robots.txt` allowed all crawling and pointed to `https://docked.com.au/sitemap.xml`.

Redirects must be configured in Shopify only when the destination is genuinely equivalent. Obsolete finance URLs must not be mass-redirected to the store home page.

## Home-page content and functions

The live home page title was `Docked | Know before you apply` and its meta description targeted Australian borrowers. It contained:

- repayment, borrowing-power, refinance, deposit/LVR and extra-repayment calculators;
- a browser-side bank-statement quick check accepting CSV, TXT, OFX, QIF and some PDF content;
- an affordability summary and file-name handoff workflow;
- personal and loan-scenario lead forms;
- consent to share data with a broker, lender, aggregator or authorised credit representative;
- referral-fee and ASIC-related disclosure copy;
- a daily borrower question and finance FAQ content;
- `hello@docked.com.au` as the public contact address;
- finance-oriented organisation and website structured data.

No legacy form was submitted during the audit.

## Other page content

- `about.html`: finance calculators, browser-side statement checks, broker/lender referrals, referral compensation, and `hello@docked.com.au`.
- `faq.html`: extensive Australian home-loan, borrowing-power, LMI, LVR, HECS, guarantor, refinance and broker questions.
- `privacy.html`: borrower identity, income, expense, debt, property, consent, bank-statement and referral data handling.
- `terms.html`: calculator limitations, finance referrals, credit-assistance disclaimers, and borrower responsibilities.
- `preview.html`: immediate redirect to the finance lead section and broker-match copy.

## Legacy search terms requiring release exclusion

The replacement's deployed theme and current public copy must be scanned for:

- loan
- mortgage
- borrow / borrowing
- affordability
- broker
- lender
- refinance
- repayment
- credit assistance
- bank statement

Matches in this historical inventory and other non-deployed archive documentation are expected. They are forbidden in current storefront copy, metadata, schema, navigation, assets and customer-facing scripts.

## Legacy assets and code

Legacy public assets include the prior wordmark/icon/favicon, a finance hero SVG, calculators, lead-capture code, preview code, a Google Sheets webhook script, the finance sitemap and robot rules, and old CSS. None should be copied into the Shopify theme. The Git archive branch and tag are the recovery mechanism.

## Migration principle

The new Shopify store will ship a clean theme rather than retaining dormant finance code. Search engines should receive accurate Shopify canonical URLs, sitemap and schema. Only equivalent legacy routes receive redirects; unrelated finance routes should resolve as not found.
