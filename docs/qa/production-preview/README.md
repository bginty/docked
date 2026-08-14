# Production candidate preview evidence

Observed 14 August 2026 against unpublished Shopify theme `130871427130` at `cfbexf-h4.myshopify.com`. The storefront remained password-protected and the theme remained in prelaunch mode. This folder is evidence for partial rendered QA, not a production-launch approval.

## Completed checks

- Real Shopify homepage render checked at 320, 360, 375, 390, 768, 1024 and 1440 CSS pixels in the Codex in-app Chromium browser.
- A real 320 px horizontal-overflow regression was found, traced to the mobile header wordmark/icons, fixed by capping the wordmark at 11 rem, uploaded to the same unpublished candidate, and retested with no horizontal overflow.
- Home, Powered Pool Floats collection, cart, Contact, Safety and Care, FAQ and branded 404 routes rendered without broken images, Liquid errors, mixed content, legacy finance copy or captured console errors.
- Mobile menu, desktop navigation, search dialog, predictive collection search and empty cart drawer operated. The rendered Main menu contained `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care` and `FAQ`.
- The candidate remained in `docked-prelaunch` mode and rendered checkout controls were disabled as `Ordering not yet open`.
- A real Draft product handle returned the branded 404 and exposed no add-to-cart form.
- Twelve Shopify Pages now exist. Contact, How It Works, Safety and Care, FAQ, Track Your Order and Accessibility are visible only behind the store password; Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy and Terms of Service remain hidden pending their applicable approvals. All 12 records have the intended template suffix, including the pre-existing Contact page.
- Safety and Care rendered the candidate safety content with one H1 and no 404. FAQ rendered eight questions, and an accordion was opened successfully.
- A controlled contact-form submission was accepted by Shopify at `?contact_posted=true` and returned **Thanks for contacting us**. Mailbox receipt remains unverified.
- The signed-out account button opened Shopify's new customer-account dialog with Sign in with Shop, an email form whose submit button stayed disabled until email entry, a marketing opt-in checkbox and Orders/Profile quick links. No credentials were entered, so authentication, logout and order-history flows remain untested.
- The three prepared redirects were imported. `/index.html` served homepage content and `/privacy.html` reached Shopify's privacy policy. `/about.html` still reaches a 404 because its correctly targeted About Docked page is intentionally hidden until the business-name gate is resolved.
- Admin navigation now also contains the seven-link existing Footer menu plus Footer shopping (`198327042106`), Footer support (`198327074874`) and Footer legal (`198327107642`) named resources. The legal resource contains only Shopify's existing native Privacy Policy resource; the separate custom Privacy Policy Page remains hidden, and neither is approved. Unapproved Terms were intentionally withheld. Local source maps Explore/Help to the named shopping/support menus, but that source change has not yet been evidenced as re-pushed or rendered on the candidate.

## Blocking results and unrun scope

- No public product page, variant, quantity, inventory, add/remove item, checkout or GST/invoice test is possible because all 15 concepts remain Draft and no SKU is approved.
- Current Edge, Firefox, Android Chrome, Safari/WebKit-equivalent and physical-device runs were not completed.
- Automated accessibility, screen-reader, Lighthouse and checkout tests were not completed.
- Contact-form delivery, external inbound/reply mail and order/refund notifications were not verified. Customer-account entry rendered, but authentication, post-submit errors, logout and order history were not tested. Shopify still reports the sender email as unverified even though `support@docked.com.au` is configured.

## Screenshot index

- [`homepage-320.png`](homepage-320.png) — corrected mobile homepage after the overflow fix.
- [`homepage-768.png`](homepage-768.png) — tablet-width homepage.
- [`homepage-1440.png`](homepage-1440.png) — desktop homepage.
- [`home-390.png`](home-390.png) — home-route capture with a historical filename; the actual file is 1424 px wide and is not 390 px evidence.
- [`powered-collection-390.png`](powered-collection-390.png) — empty Draft-only collection capture with a historical filename; the actual file is 1424 px wide and is not 390 px evidence.
- [`safety-390.png`](safety-390.png) — historical pre-fix 404 capture retained as regression evidence; the actual file is 1424 px wide and is not 390 px evidence. The current post-fix Safety result is recorded in `rendered-qa.json`.
- [`safety-current-desktop.jpg`](safety-current-desktop.jpg) — current rendered Safety and Care page after record/template creation.
- [`faq-current-desktop.jpg`](faq-current-desktop.jpg) — current rendered FAQ page.
- [`contact-success-current-desktop.jpg`](contact-success-current-desktop.jpg) — Shopify's confirmation after the controlled contact-form submission.
- [`not-found-390.png`](not-found-390.png) — branded 404 capture with a historical filename; the actual file is 1424 px wide and is not 390 px evidence.

Do not treat the historical `safety-390.png` capture as current-page evidence; use `safety-current-desktop.jpg` and the machine-readable result instead. None of the four retained `*-390.png` files is valid 390 px screenshot evidence; the manual Browser viewport observations are recorded separately.

See [`rendered-qa.json`](rendered-qa.json) for the machine-readable summary and [`../../POST_LAUNCH_QA.md`](../../POST_LAUNCH_QA.md) for the full launch QA register.
