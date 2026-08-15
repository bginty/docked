# Production candidate preview evidence

Observed 14 August 2026 against unpublished Shopify theme `130871427130` at `cfbexf-h4.myshopify.com`. Historical exact source `0b8d127b83d68930992643d666a7d26c1f1b067d` was strictly pushed from 10:43:36 to 10:44:47 AEST. Initial brand-refresh source `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` and current integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` were subsequently pushed successfully with `--strict`; exact CLI start/end timestamps were not retained. The storefront remained password-protected, the candidate remained unpublished in prelaunch mode and live `Horizon` theme `130871099450` remained untouched. This folder is evidence for partial rendered QA, not a production-launch approval.

## Completed checks

- Real Shopify homepage render checked at 320, 360, 375, 390, 768, 1024 and 1440 CSS pixels in the Codex in-app Chromium browser.
- Following the current integrated one-word push, all seven widths had document/body `scrollWidth` equal to `innerWidth`. At 320 px, viewport/document/body widths were exactly `320/320/320`; the integrated header wordmark, hero art, note within the hero and footer wordmark measured `110 × 25.71`, `288 × 345.6`, `248 × 79.4` and `220 × 51.44` px respectively. The wordmark viewBox was `0 0 650 152`.
- Header wordmark widths at 320/360/375/390/768/1024/1440 were `110/157.575/163.963/180/180/180/180` px; footer widths were `220/220/220/152/216/220/220` px. At 1440 px, header/footer/hero widths were `180/220/552.14` px and navigation remained intact.
- The 320 px mobile menu opened with `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` and no overflow; desktop navigation remained intact. Header/footer links exposed the accessible name `Docked — home`.
- Header main fill rendered navy `#06283D` with cyan `#13BFE6`; footer wordmark rendered white with cyan wake on scheme 3; hero art rendered the navy mark, `18+` seal and complete preview-art accessible label.
- The favicon resolved from the theme asset, Organization JSON-LD used an absolute `docked-mark.svg` asset URL, and the console contained no errors or warnings.
- On the initial brand-refresh push, the password page rendered the hidden `Docked` name, favicon, H1 and modal. The final `5f46487…` source changed only wordmark SVG geometry.
- A real 320 px horizontal-overflow regression was found, traced to the mobile header wordmark/icons, fixed by capping the wordmark at 11 rem, uploaded to the same unpublished candidate, and retested with no horizontal overflow.
- Home, Powered Pool Floats collection, cart, Contact, Safety and Care, FAQ and branded 404 routes rendered without broken images, Liquid errors, mixed content, legacy finance copy or captured console errors.
- Mobile menu, desktop navigation, search dialog, predictive collection search and empty cart drawer operated. After the exact-commit push, the candidate measured `innerWidth=390` / `scrollWidth=390`; its opened mobile menu contained `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`.
- The candidate remained in `docked-prelaunch` mode and rendered checkout controls were disabled as `Ordering not yet open`.
- A real Draft product handle returned the branded 404 and exposed no add-to-cart form.
- Twelve Shopify Pages now exist. Contact, How It Works, Safety and Care, FAQ, Track Your Order and Accessibility are visible only behind the store password; Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy and Terms of Service remain hidden pending their applicable approvals. All 12 records have the intended template suffix, including the pre-existing Contact page.
- Safety and Care rendered the candidate safety content with one H1 and no 404. FAQ rendered eight questions, and an accordion was opened successfully.
- A controlled contact-form submission was accepted by Shopify at `?contact_posted=true` and returned **Thanks for contacting us**. Mailbox receipt remains unverified.
- The signed-out account button opened Shopify's new customer-account dialog with Sign in with Shop, an email form whose submit button stayed disabled until email entry, a marketing opt-in checkbox and Orders/Profile quick links. No credentials were entered, so authentication, logout and order-history flows remain untested.
- The three prepared redirects were imported. `/index.html` served homepage content and `/privacy.html` reached Shopify's privacy policy. `/about.html` still reaches a 404 because its correctly targeted About Docked page is intentionally hidden until the business-name gate is resolved.
- The exact-commit source maps Explore to Footer shopping (`198327042106`) and Help and policies to Footer support (`198327074874`). After the strict push, Explore rendered the exact seven planned collection links and Help and policies rendered `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`. Shopify's native Privacy policy link rendered separately through `show_policy`. Footer legal (`198327107642`) remains an unused Admin resource and did not render. The separate custom Privacy Policy Page remains hidden, and neither policy resource is approved. Unapproved Terms were intentionally withheld.

## Blocking results and unrun scope

- No public product page, variant, quantity, inventory, add/remove item, checkout or GST/invoice test is possible because all 15 concepts remain Draft and no SKU is approved.
- Current Edge, Firefox, Android Chrome, Safari/WebKit-equivalent and physical-device runs were not completed.
- The latest brand-refresh screenshot/CDP capture timed out. No new screenshot artifact was retained, so current-brand visual screenshot coverage remains incomplete despite the DOM/geometry/computed-style observations.
- `npm run test:storefront` was attempted with the preview URL but stopped before any assertion because Playwright is not installed. Automated accessibility, screen-reader, Lighthouse and checkout tests were not completed.
- Contact-form delivery, external inbound/reply mail and order/refund notifications were not verified. Customer-account entry rendered, but authentication, post-submit errors, logout and order history were not tested. On 15 August, Admin Notifications showed `support@docked.com.au` with **Email domain authentication — Needs setup** and a Shopify backup-sender warning; the owner still needs to complete domain authentication and the delivery matrix.

## Screenshot index

The latest brand-refresh screenshot/CDP capture timed out, so no new screenshot artifact was created. Its evidence is limited to Browser DOM, geometry and computed-style observations. The files below predate that latest run and remain qualified historical evidence.

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
