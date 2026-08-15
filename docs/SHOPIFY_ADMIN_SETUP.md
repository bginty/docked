# Shopify Admin setup

Status: **RUNBOOK ONLY — SHOPIFY ADMIN NOT INSPECTED OR CONFIGURED BY THIS REPOSITORY AUDIT**  
Last updated: 15 August 2026

Use this checklist in the correct Docked Shopify store after an unpublished theme upload. Record redacted evidence for every completed gate. A checked-in setting or Draft catalogue row does not prove the corresponding Admin setting is live.

## 1. General store settings

- [ ] Store name: **Docked**.
- [ ] Legal seller: **GINTY UNITED INVESTMENTS PTY LTD**.
- [ ] ABN: **78 606 187 106**; ACN: **606 187 106**.
- [ ] GST status configured on the confirmed basis: **Registered for GST**.
- [ ] Business/correspondence address: **135 Bamfield Road, Heidelberg Heights VIC 3081, Australia**.
- [ ] Country/region: Australia; currency: AUD; time zone: Australia/Melbourne; weight unit: kilograms.
- [ ] Approved customer price wording: **All prices are in Australian dollars and include GST.**
- [ ] Customer contact email value: support@docked.com.au, but do not mark it verified until all mailbox and sender tests pass.
- [ ] Do not configure the address as a public shop, showroom, walk-in service, pickup point or open returns counter.

Use [Legal entity details](LEGAL_ENTITY_DETAILS.md) as the controlled value source.

## 2. Required v16 customer-account compatibility gate

The theme source uses Shopify’s `<shopify-account>` component and a `customer_account_menu` setting. The custom theme metadata (`Docked` 1.0.0) does **not** by itself prove compatibility with Shopify’s v16 customer-account requirements or the store’s selected customer-account experience.

Before customer accounts are enabled or linked publicly:

- [ ] Confirm in Shopify Admin which customer-account experience/version the store will use and that it meets the required **v16 compatibility gate**.
- [ ] Confirm the uploaded theme and all account-related apps/extensions are supported for that experience.
- [ ] Create/verify the `customer-account-main-menu` resource or deliberately select the approved alternative in theme settings.
- [ ] Verify the account control appears only when customer accounts are enabled and has a correct accessible name, focus behaviour and mobile placement.
- [ ] Test signed-out display, sign-in, authentication code/email delivery, signed-in menu, profile, addresses, order history/details, permitted self-service actions and sign-out.
- [ ] Test account-to-cart/checkout continuity, policy/support links and all customer-account notifications.
- [ ] Test keyboard, screen-reader labelling, zoom, mobile/desktop and failure/expired-code states.

If any compatibility or flow check fails, leave customer accounts disabled or use an explicitly approved compatible configuration. Do not publish a broken account control or claim that account functionality is available.

## 3. Draft product creation

Create or retain only **DC-02 / Docked Cruise D2** as the sole current planned **Draft** product. Keep it unavailable to the Online Store and every other sales channel; Active status is prohibited until its complete release record passes. The complimentary pump and two batteries are included components, not separate Shopify products. No product may become Active merely because its concept row imports successfully.

Authenticated Shopify Admin verification on 15 August 2026 recorded the other 14 product shells as Archived rather than deleted. Verify they remain Archived and absent from every sales channel, collection, menu, search/feed surface and recommendation. Do not delete the repository audit trail: the prior 15-concept plan remains recoverable at baseline commit `306e5dd`.

For DC-02 and any genuine variant, set and verify only after the relevant source has been approved:

- title, handle, actual brand/vendor, product type, collections and status Draft;
- final SKU, barcode where applicable, genuine variants and option values;
- owner-approved GST-inclusive price, genuine compare-at price only where supportable, and cost per item;
- Shopify-tracked inventory, location, quantity, physical-product/shipping flag and verified weight;
- licensed exact-SKU media, useful alt text, SEO title/description and approved manual; and
- all evidence-backed metafields and product-specific warnings.

Keep unknown values blank. Supplier component reports received on 15 August 2026 remain under review and do not establish a final SKU. Do not enter the unsupported 160 kg capacity or choose between the conflicting 30/90-minute runtime, 46/66 W power or 5 km/h/1.6 m/s speed claims. Do not convert draft RRPs, concept names, supplier claims, AI concept PNGs or placeholders into production facts or exact-SKU product photography.

## 4. Product metafields

Create definitions under namespace `custom` with types appropriate to the data and existing Liquid usage. Do not populate a value until its exact-SKU evidence is approved.

| Group | Required keys |
| --- | --- |
| Merchandising/classification | `adult_only`, `powered`, `powered_float`, `seating_style`, `verified_occupancy`, `canopy`, `approved_use_environment`, `minimum_user_age` |
| Motor/control | `motor_configuration`, `motor_count`, `control_type`, `rated_power_w` |
| Battery/charging | `battery_type`, `battery_capacity_mah`, `battery_voltage_v`, `battery_watt_hours`, `verified_runtime_minutes`, `verified_charge_time_hours`, `charger_model`, `charger_rcm_status`, `charging_instructions` |
| Size/material/performance | `maximum_user_weight_kg`, `inflated_length_cm`, `inflated_width_cm`, `packed_dimensions`, `product_weight_kg`, `material`, `pvc_grade_or_thickness`, `verified_water_ingress_rating` |
| Contents/instructions | `included_items`, `included_pump`, `how_it_works`, `setup_instructions`, `usage_instructions`, `care_instructions` |
| Safety/compliance/service | `safety_warnings`, `compliance_reports`, `warranty_period`, `manual_url` |

Confirm boolean, number, measurement, list, rich-text and URL types against the theme before bulk entry. Preserve units in structured fields where Shopify supports them. The storefront must hide missing unverified values, not replace them with promotional assumptions.

## 5. Collections

Use one current merchandising collection and verify no Draft or withdrawn product becomes visible through an automated rule:

| Collection | Handle |
| --- | --- |
| Powered Pool Floats | `powered-pool-floats` |

The Shopify `/collections/all` route may remain as a system route but is not a second planned category. Remove the withdrawn collection handles from current menus and theme assignments, and archive or remove unused Admin collections after recording their IDs. Check the remaining collection title, description, SEO, adult-only framing and empty state. DC-02 remains Draft and hidden until its release gate passes.

## 6. Navigation

Desktop and mobile must use the same logical hierarchy:

- **Shop**
  - Powered Pool Floats
- How It Works
- Safety and Care
- FAQ
- About
- Contact

Also verify search and cart access, policy/help footer links and the customer-account item only after the v16 gate passes. Remove legacy finance destinations; do not redirect irrelevant legacy pages solely to manipulate search rankings.

## 7. Shopify Search & Discovery

Do not expose comparison filters that create no meaningful choice for a single current product. Configure only search/sorting behaviour supported by genuine structured DC-02 data, and keep capacity, runtime, power, speed and component claims absent while unresolved. Test no-result states, mobile controls, keyboard access and Australian/American motorised/motorized search synonyms. Do not add child-targeted synonyms; follow the [adult-only merchandising policy](ADULT_ONLY_MERCHANDISING_POLICY.md).

## 8. Markets and language

- [ ] Activate Australia only at launch, in AUD.
- [ ] Keep all international markets/international shipping inactive.
- [ ] Use Australian English in visible copy.
- [ ] Confirm product availability, domain behaviour, duties/tax wording and checkout are correct for the Australia market.

Do not open another market until product, carrier, battery, tax, legal and consumer-policy requirements are separately approved.

## 9. Inventory, overselling, preorders and shipping

- [ ] Make Shopify inventory the source of truth and track quantity at the correct location.
- [ ] Turn **Continue selling when out of stock** off for every variant; verify sold-out behaviour.
- [ ] Keep preorders disabled. They require separate owner approval, genuine allocation and a clearly supported estimated dispatch date.
- [ ] Do not publish fabricated low-stock messages.
- [ ] Create an Australia-only shipping zone with owner-approved rates and remote-area rules.
- [ ] Keep local pickup disabled unless separately approved as a genuine service.
- [ ] Enable express or battery-containing services only after carrier acceptance for the exact packed configuration.
- [ ] Enter verified product and packed measures; do not promise free shipping or dispatch timing without approval.

## 10. Taxes, GST and invoices

- [ ] Configure Australian GST using the confirmed registration status and GST-inclusive consumer pricing.
- [ ] Verify product, collection, cart, checkout, discount, shipping, refund and order displays.
- [ ] Configure automatic delivery of a compliant **Tax Invoice** for every completed order.
- [ ] Complete every scenario and evidence requirement in [GST and tax-invoice QA](GST_AND_TAX_INVOICE_QA.md).

Do not mark this section complete based on theme copy alone.

## 11. Payments and checkout

- [ ] Follow [Payments setup](PAYMENTS_SETUP.md); Shopify-native providers and hosted checkout only.
- [ ] Keep Shopify Payments test-only or unconfigured while banking/merchant verification is pending.
- [ ] Keep PayPal Express unconnected or in supported testing until the genuine owner-authorised business account is available.
- [ ] Confirm customer contact method, Australian address handling, marketing consent with no pre-ticked opt-in, order processing, fraud settings, abandoned checkout and policy links.
- [ ] Display only methods genuinely enabled by Shopify; do not activate live capture.

## 12. Pages and policies

Create, assign and review Home, Shop, How It Works, Safety and Care, Shipping and Delivery, Returns and Refunds, Warranty, FAQ, About Docked, Contact, Track Your Order, Privacy Policy, Terms of Service and Accessibility, plus cart, search, 404 and password/prelaunch experiences.

Policy review must separate change of mind, transit damage, incorrect item, minor/major defect, warranty, misuse/wear and product-specific issues without attempting to remove Australian Consumer Law rights. Use the exact legal entity/address qualification and require return authorisation through support@docked.com.au.

## 13. Notifications and support

- [ ] Brand and test order confirmation, shipping, delivery (where available), cancellation, refund and customer-account notifications.
- [ ] Add correct support, policy and concise Safety and Care links.
- [ ] Verify support@docked.com.au inbound, outbound, reply path, sender authentication, SPF, DKIM, DMARC and spam placement before publication.
- [ ] Confirm no notification replies to a personal Gmail address.
- [ ] Test every notification with redacted test data and retain evidence.

## 14. Domain and release

- [ ] Keep the theme unpublished/password protected until all launch gates pass.
- [ ] Snapshot DNS and preserve MX, SPF, DKIM, DMARC and verification TXT records.
- [ ] Connect docked.com.au only with the exact current records shown by Shopify; set the canonical host and verify apex/www/SSL behaviour.
- [ ] Preserve the legacy deployment for rollback during the initial cutover.
- [ ] Publish only approved products/theme after explicit owner authority; enable live capture last.

Final status remains **Code Complete — Owner Action Required**, not Production Live, until Admin evidence, product approvals, tests and owner authorisation are complete.
