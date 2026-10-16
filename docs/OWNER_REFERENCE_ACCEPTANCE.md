# Owner dashboard reference acceptance

The supplied `1000050648.jpg` is the design target. Its native dimensions are **1280 × 853**, not 1536 × 1024. The 1536 × 1024 review uses the same approximate 1.2 scale and composition. This report distinguishes rendered local fixtures from authenticated or hosted acceptance.

## Reference measurements

Measurements are taken from the supplied image; JPEG compression makes colour samples approximate.

| Element            | Native reference     | Target at 1536 px             |
| ------------------ | -------------------- | ----------------------------- |
| Sidebar            | 182 px wide          | approximately 218 px          |
| Header             | 54 px high           | approximately 65 px           |
| Content left edge  | 205 px               | approximately 246 px          |
| Content right edge | 1261 px              | approximately 1513 px         |
| Welcome banner     | y=54–158             | y=65–190                      |
| KPI row            | y=159–258, 5 columns | approximately 119 px high     |
| Analytics row      | y=269–477            | approximately 250 px high     |
| Analytics columns  | 383 / 322 / 331 px   | approximately 36% / 31% / 31% |
| Information row    | y=488–722            | approximately 281 px high     |
| Operations row     | y=731–836            | approximately 126 px high     |

Representative sampled surfaces: canvas `#030c1d`, sidebar `#031323`, header `#020d1f`, KPI surface `#041424`. Dominant quantised panel colours are near `#081828`. The active navigation uses a blue gradient around `#003078` through `#004098`; cyan is reserved for the illuminated edge and trading accent. These are samples, not claims of an exact global palette.

## Review scope and honest differences

- Reference figures, growth percentages, named athletes, sample emails, payment amounts and service-green indicators are illustrative and must never be copied into the connected dashboard.
- The reference contains marked professional uniforms and athlete photographs. Original generic sports artwork must preserve the composition and lighting without reproducing those assets.
- Actual settled AUD revenue is unavailable while payment activation remains disabled. Revenue panels must preserve their geometry with an explicit unavailable state, not fabricated bars or zero receipts.
- A healthy database query does not establish Android, email, web or background-job health. Unknown services remain unknown.
- Local screenshots use clearly identified synthetic records supplied to the actual production components. They do not prove owner MFA, RLS, hosted delivery or physical Samsung acceptance.

## Required browser acceptance

The dedicated `scripts/owner-reference-browser.ts` harness captures 1536 × 1024, 1440 × 900, 1024 px, 412 px and 360 px views, and writes reproducible JSON evidence beside the screenshots. It checks layout overflow, serious/critical automated accessibility findings, global-search keyboard access, period selectors, navigation and quick-action destinations, plus unavailable financial and service states. The reference image is copied byte-for-byte into the comparison artifact; it is not retouched.

Authenticated authorization, mutation and financial invariants are covered by the separate platform/database suites. A fixture route resolving a link is not represented as proof that the linked production service completed an operation.

## Verification results

**Final local browser acceptance passed**, source run `browser-1792156234598`. All five final rendered views were visually inspected. No pixel-perfect, authenticated hosted or physical Samsung acceptance claim is made.

- [Side-by-side comparison](qa/owner-reference/final/comparison.html), with an unchanged byte-for-byte copy of the supplied reference.
- [1536 × 1024 desktop](qa/owner-reference/final/owner-1536.png) · [1440 × 900 desktop](qa/owner-reference/final/owner-1440.png) · [1024 tablet](qa/owner-reference/final/owner-1024-full.png) · [412 mobile](qa/owner-reference/final/owner-412-full.png) · [360 narrow mobile](qa/owner-reference/final/owner-360-full.png).
- [Machine-readable acceptance](qa/owner-reference/final/acceptance.json): no horizontal page overflow, zero serious/critical Axe findings, no client runtime errors at every viewport. Automated Axe checks are not full accessibility certification.
- Verified exact 13-item owner navigation order, four quick-action destinations, permitted editor sidebar, Ctrl/Cmd-K focus, search success/error/empty recovery, Escape focus restoration and no body scroll lock.
- All three period controls navigate using safe `period` URL values, preserve sport/scope and clear incompatible custom dates. The linked operational-detail disclosure opens on its hash destination.
- Tablet/mobile navigation opens, closes with Escape and restores focus; a synthetic `popstate` closes it. This is browser-event coverage, not physical Android Back acceptance.
- Actual announcement draft preview and clear work without any mutation request. Actual read-only moderation presentation opens with the correct outstanding content/member filters and excludes resolved cases.
- Chart bounds and unique numeric axis ticks are checked, and unavailable KPI text remains a single readable line at 360 px.

Measured 1536 px layout: sidebar **218 px**, header **65 px**, content left **245 px**, banner **124 px**, five-KPI row **120 px**, analytics row **251.5 px**. These closely follow the reference's approximately 1.2-scaled geometry. Original generic sports artwork, real-data-dependent row density, unavailable revenue/services, accessible chart tables and current Docked pack/card artwork remain intentional differences. The lower operational detail is retained below the reference composition rather than deleting existing owner functionality.

The test used headless Microsoft Edge/Chromium with touch-capable mobile viewport emulation. Physical Samsung Internet, Chrome-on-device, native Android and genuine hosted MFA remain separate acceptance work.

- Moderation platform regression: **3/3 passed** (`docs/qa/owner-reference-moderation-platform.txt`).
- Moderation database regression: **21/21 passed** (`docs/qa/owner-reference-moderation-sql.txt`). An added case proves that 105 newer content reports do not push an older member report out of its independently filtered, bounded queue.
- First browser launch failed due to Windows sandbox browser IPC; the isolated browser run succeeded outside that process restriction.
- Initial five-width checks passed, but manual screenshot inspection found tiny chart SVGs caused by a shared icon rule. A minimum rendered chart-size check was added; chart styling was corrected.
- A subsequent visual review found banner artwork overlapping KPI data and a narrow-screen unavailable value wrapping badly. Both were corrected and the five final screens were inspected again.
- The second browser run reached and passed all five viewports, search, period navigation and mobile menu checks, then failed a test locator in the moderation fixture. The accessible combobox locator was corrected and the final run passed.
- Two browser attempts were stopped while waiting for below-fold lazy images to decode. The screenshot harness now eagerly loads images only in its isolated document and bounds the asset wait to 15 seconds. Application lazy-loading behaviour was preserved; both subsequent full browser runs passed.

## Navigation and permissions inventory

All staff entry points retain `requireRole`, which requires a verified active account/session, an assigned server-side role and AAL2. Sidebar visibility is a convenience; the destination independently rechecks access. There is no new super-admin role.

| Destination        | Permitted existing roles                          | Connected scope / explicit limitation                                                                   |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Dashboard          | Owner; staff receive their existing staff landing | Executive reports remain owner-only                                                                     |
| Users              | Owner, admin, auditor                             | Search; admission and member integrity; role editing/support cases unavailable                          |
| Cards & Inventory  | Owner, admin, auditor                             | Card search; owner inventory/supply export; arbitrary minting unavailable                               |
| Packs              | Owner, admin, auditor                             | Purchased-pack search; catalogue and owner activity; configuration changes require reviewed release     |
| Marketplace        | Owner, admin, auditor                             | Existing market and moderation; hosted settlement remains gated                                         |
| Competitions       | Owner, admin, analyst, editor, auditor            | Search, standings, scoring rules, owner feed-health view                                                |
| Content & News     | Owner, admin, editor, auditor                     | Community publishing and announcement draft; separate CMS approval unavailable                          |
| Moderation         | Owner, admin, editor, auditor                     | Existing reports, investigations and target-specific controls; auditor read-only                        |
| Payments & Wallets | Owner                                             | Aggregate test ledger/reconciliation and existing withdrawal operations; real payments disabled         |
| Rewards & Credits  | Owner                                             | Entitlement/job health and ledger lookup; discretionary hosted issuance restricted                      |
| Analytics          | Owner, admin, auditor                             | Existing consent-based analytics; executive report owner-only                                           |
| Communications     | Owner, admin, editor, auditor                     | Local preview draft for writers; existing delivery reports per role; bulk delivery unavailable          |
| Settings           | Owner, admin                                      | Existing account/MFA, admission and owner health; sensitive platform changes remain reviewed operations |

Global search uses the same category/section permission map. Its results are paginated, permitlisted projections rather than raw profile, financial or credential records. Search includes members, cards, packs, transactions, competitions and moderation only where that staff role is allowed.

Dashboard moderation links pass `kind=content` or `kind=members` to the existing protected queue. The server applies the category and outstanding status before the 100-report limit; the UI opens with matching filters. `kind=listings` presents the unavailable listing-case intake explicitly, without inventing a zero count. Clearing local filters does not reveal records outside the server-selected category; an explicit link returns to all report categories.

### Quick actions

- **Issue Credits:** opens Rewards & Credits. Hosted discretionary issuance is explicitly restricted; no balance mutation is introduced. An existing isolated local allocator is not permission to activate hosted issuance.
- **Send Announcement:** opens Communications. Actual draft/preview/clear UI works locally; it does not send, save or imply delivery. External delivery is not activated.
- **Manage Packs:** opens the existing pack/search/catalogue workspace. Pricing, odds and availability retain reviewed release controls.
- **View Reports:** opens Analytics with existing reports available according to role.
