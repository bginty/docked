# Docked shipping setup

Status: **BLOCKED — RATES, PACKED DATA, CARRIER AND BATTERY ACCEPTANCE NOT SUPPLIED**  
Last updated: 13 August 2026

Launch shipping is Australia only. International markets, local pickup, preorders, free-shipping thresholds and unverified express services remain disabled. Do not publish a rate, dispatch time or delivery estimate until the exact service and operating capacity have been approved and tested.

## Required inputs per final SKU/variant

- final model, SKU and shipping origin/fulfilment location;
- packed length, width, height and gross weight, measured on the final retail/shipping pack;
- carton count, dimensional-weight treatment, oversize/remote-area rules and packaging standard;
- carrier/service quote, surcharges, tracking capability, loss/damage process and written acceptance of the product;
- launch stock, cut-off and actual handling/dispatch capability;
- for every battery product: chemistry, cell/battery count, voltage, capacity, watt-hours, installed-in-equipment versus packed-with/separate configuration, manufacturer/model, protection against short circuit/accidental activation, applicable transport test documentation and any dangerous-goods classification/marking; and
- insurer, supplier and carrier approval for the exact product, pack, route and return method.

No powered product or rechargeable pump may enter a shipping profile until these fields pass [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md) and the carrier confirms acceptance in writing. Australia Post, for example, treats lithium batteries as dangerous goods and applies configuration, energy, service, packaging and quantity restrictions; its current published rules do not prove that a Docked product is accepted. Re-check the contracted carrier's terms at onboarding and before every material product/pack change. See [Australia Post dangerous/restricted items](https://auspost.com.au/business/shipping/shipping-guidelines/dangerous-prohibited-items).

## Shopify configuration sequence

1. **Markets** — keep only Australia enabled for product sales. Remove international countries/zones from delivery availability. Do not treat a Markets setting as carrier approval.
2. **Locations** — create only genuine inventory/fulfilment locations. The Heidelberg Heights address must not be presented as a public pickup or walk-in location. Local pickup stays off unless separately authorised and operational.
3. **Product shipping data** — mark physical products correctly; enter verified variant weight and customs/origin data where required. Enable Shopify inventory tracking and disable “continue selling when out of stock”.
4. **Packages** — configure each actual carton/package with measured dimensions and tare assumptions required by the selected rating/label method.
5. **Profiles** — use the general profile only where one rate set genuinely applies. Create a custom profile for battery, oversized or otherwise restricted products only when their services differ. Shopify explains that profiles apply rules by product and fulfilment location; products omitted from a custom profile remain in the general profile. See [Shopify shipping profiles](https://help.shopify.com/en/manual/fulfillment/setup/shipping-profiles).
6. **Zones and rates** — Australia only. Add an approved Standard rate. Add Express only for exact SKUs/postcodes the carrier accepts. Configure remote-area exclusions/surcharges from the contracted source. Keep free shipping absent until owner margin approval.
7. **Mixed carts** — test products across every profile/location combination. Shopify can combine shipping rates; ensure the customer sees a coherent, commercially correct service rather than an unexplained or duplicated charge.
8. **Delivery text** — publish only tested service names and estimates. Separate handling/dispatch from carrier transit; avoid guarantees unless the service genuinely provides one and operations can meet it.
9. **Notifications and tracking** — use Shopify's fulfilment notification with the actual carrier and tracking URL; do not mark fulfilled before the parcel is packed, checked and accepted/handover is evidenced under [Fulfilment workflow](FULFILMENT_WORKFLOW.md).
10. **Policy** — publish the adviser/owner-approved Shipping & Delivery policy with service area, calculation basis, dispatch process, tracking, address errors, split shipments, remote areas, delay/loss/damage support and battery limitations.

## Proposed profile decision table

This is architecture, not rate approval.

| Product class | Proposed profile | Permitted service state |
| --- | --- | --- |
| Non-powered, standard-size accessories/loungers | General Australia | Standard pending packed data and carrier/rate approval; Express pending separate acceptance |
| Rechargeable powered floats and rechargeable air pump | Battery/restricted profile | **Disabled** until exact battery dossier, packaging and written carrier acceptance pass |
| Oversized/multi-carton islands/decks/bundles | Oversized profile if contracted rates differ | **Disabled** until final pack and service acceptance pass |
| Any international order | No active zone | **Disabled** pending destination-by-destination compliance, tax, battery and carrier review |
| Local pickup | None | **Disabled by default**; no public showroom or walk-in service |

## Rate approval record

Complete before configuration. Prices below intentionally remain blank.

| Profile / zone | Service | Carrier product | Customer GST-inclusive rate | Docked cost / surcharges | Conditions / postcode exclusions | Approver / effective date |
| --- | --- | --- | ---: | ---: | --- | --- |
| General / Australia | Standard |  |  |  |  |  |
| General / Australia | Express |  |  |  |  |  |
| Battery/restricted / Australia | Approved service |  |  |  |  |  |
| Oversized / Australia | Approved service |  |  |  |  |  |

## Checkout test matrix

Use Draft/test products and a Shopify test payment method. For every row, capture rate name, amount, estimated wording, tax, accepted/excluded postcode and order result.

- [ ] Metro address: each single profile and mixed cart.
- [ ] Regional address: each single profile and mixed cart.
- [ ] Remote/territory postcode that should be accepted.
- [ ] Remote/territory postcode that should be excluded or surcharged.
- [ ] PO Box/parcel locker/business address according to contracted service rules.
- [ ] Powered/battery item; non-powered item; oversized item; bundle; multiple quantities.
- [ ] Cart below/at/above any later approved threshold.
- [ ] Express hidden where any line is ineligible and displayed only where all conditions pass.
- [ ] Invalid/incomplete address and corrected address.
- [ ] Discount, shipping discount, full refund and partial refund with GST/tax-invoice reconciliation.
- [ ] Tracking link and notification; delayed, returned-to-sender, lost and damaged-parcel workflows.

## Release evidence

| Gate | Status | Evidence / owner / date |
| --- | --- | --- |
| Final packed measures for every SKU | Blocked | No final SKU/supplier data supplied |
| Battery/transport dossier | Blocked | No exact battery data supplied |
| Written carrier/service acceptance | Blocked | No carrier selected/approved |
| GST-inclusive rates and margin approval | Blocked | No rates or final landed costs supplied |
| Australia-only profile configured | Not verified | Shopify Admin not inspected |
| International and local pickup disabled | Not verified |  |
| Checkout matrix passed | Not run |  |
| Shipping policy approved/published | Blocked | Commercial and adviser review required |

