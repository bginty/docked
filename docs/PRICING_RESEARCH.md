# Docked pricing research

**Research date:** 13 August 2026  
**Currency:** Australian dollars (AUD)  
**Validation status:** **Share with caveats - market orientation only; no price is approved**

## Executive conclusion

The draft RRPs are working hypotheses, not launch prices. Unpowered lounge and accessory markets are reasonably populated and price-transparent, but the directly comparable powered-float market is thin. All 10 powered observations are cross-border importer listings: five Ubuy headline prices exclude shipping and customs, while five Desertcart prices state that delivery, duties and taxes are included. Those prices are directionally useful but not interchangeable landed-Australia offers.

No SKU can pass commercial approval until landed cost, outbound freight, payment fees, warranty/returns exposure, packaging, stock and other variable-cost inputs are completed. Every proposed price remains blocked in [PRICE_APPROVAL_REGISTER.md](PRICE_APPROVAL_REGISTER.md).

## Scope and reproducible method

- The benchmarks below use all 104 genuine price-bearing observations in [`competitor-pricing.csv`](../data/competitor-pricing.csv), mapped into the 15 named Docked comparison categories.
- The rows cover 53 retailers and 101 unique URLs. Three category pages each support two distinct, separately priced products; there is no exact duplicate row.
- Each row is one product-price observation captured on 13 August 2026. Clearance, sale, member, marketplace, unavailable, from-price and import qualifiers are retained.
- Statistics use the listed AUD price. For an even row count, the median is the arithmetic mean of the two middle sorted values.
- The storage-pouch benchmark combines source categories labelled `Waterproof storage pouch` and `Water-resistant storage pouch`. Those are seller/source classifications, not approved Docked claims.
- A delivered price is recorded only where the source states a fixed inclusion. Postcode freight, remote-area surcharges, membership conditions and unknown import costs are not imputed.
- Product, warranty, return and performance statements are paraphrased and labelled as source claims where they have not been independently verified.

## Category benchmarks and draft positioning

Draft RRPs include GST. Position versus median is descriptive only and does not constitute approval.

| Category | n | Listed-price range | Median | Named Docked concept | Draft RRP inc GST | Position vs median |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Powered single motor | 5 | $207-$314 | $274.00 | Docked Cruise S1 | $499 | +82.1% |
| Powered dual motor | 3 | $409-$656 | $575.00 | Docked Cruise D2 | $649 | +12.9% |
| Powered dual motor with canopy | 2 | $359-$714 | $536.50 | Docked Shade D2 | $749 | +39.6% |
| Mesh hammock lounge | 6 | $15-$39.99 | $26.50 | Docked Drift Mesh Lounge | $59 | +122.7% |
| Supportive pool chair | 6 | $20-$69.99 | $59.90 | Docked Recline Pool Chair | $79 | +31.9% |
| Full-length pool lounge | 8 | $19-$499 | $94.95 | Docked Stretch Full-Length Lounge | $99 | +4.3% |
| Two-person float | 11 | $38.99-$399 | $80.00 | Docked Social Two-Person Island | $229 | +186.2% |
| Consumer multi-person island | 9 | $25-$999 | $317.90 | Docked Party Deck | $329 | +3.5% |
| Floating cooler | 7 | $29.95-$80.99 | $39.00 | Docked Chill Floating Cooler | $49 | +25.6% |
| Floating drink tray | 8 | $21.99-$49.95 | $33.97 | Docked Drinks Dock | $29 | -14.6% |
| Pool volleyball set | 6 | $9-$59.94 | $32.45 | Docked Rally Pool Volleyball Set | $59 | +81.8% |
| Rechargeable air pump | 7 | $29.97-$84.99 | $50.16 | Docked Inflate Rechargeable Air Pump | $39 | -22.2% |
| Double-action manual pump | 8 | $15-$37 | $24.93 | Docked Double-Action Manual Pump | $29 | +16.3% |
| PVC repair kit | 8 | $8.29-$37.95 | $18.48 | Docked Restore PVC Repair Kit | $19 | +2.8% |
| Storage pouch comparator set (seller ingress claims) | 10 | $10-$38.25 | $17.49 | Docked Dry Storage Pouch | $29 | +65.8% |

## Interpretation

### Powered range

The single-motor draft is 82.1% above its five-row median. The dual-motor draft is much closer to its benchmark, while the canopy draft carries a material premium over only two observations. All powered evidence is cross-border, samples are small and half the headline prices omit freight/customs. A premium could be defensible only after Docked verifies the exact product, local compliance, adult fit, control/safety system, Australian support, warranty, parts and delivered availability.

### Adult loungers and islands

The market mixes clearance inflatables, marketplace goods, established retail brands and premium fabric-covered products. The full-length lounge and party-island drafts sit close to very dispersed medians. The mesh, chair and two-person drafts are above theirs; the two-person concept has the largest premium in the range. Size, construction, verified capacity, materials, comfort and local warranty value would all need evidence before that premium could be defended.

### Games, pumps and care

The cooler, manual pump and repair-kit drafts are close enough to common retail points to test after costs are known. The tray and rechargeable-pump drafts sit below their medians and may lack contribution headroom. Volleyball and the storage pouch sit materially above their medians; each needs a stronger verified offer or a lower cost/price structure. The pouch must not carry any waterproof, water-resistant or submersible claim without exact test evidence, limitations and approved instructions.

## Data-quality validation

Overall assessment: **Share with caveats.** The dataset is traceable and adequate for directional market orientation, but not final pricing, demand proof, landed-cost modelling or product/compliance claims.

| Check | Evidence | Decision impact |
| --- | --- | --- |
| Required fields | All 104 rows have the expected date, retailer, product/type, positive numeric listed price, stock statement, HTTPS URL, source class and source-quality label. | Rows are traceable enough for review. |
| Duplicates and grain | No exact duplicate row. 101 URLs support 104 rows; the three repeated URLs are category pages with two different priced products each. | No duplicate-price inflation identified at the stated observation grain. |
| Delivered-price completeness | Only 10 of 104 rows contain a fixed delivered/collection price. | Never compare every headline as freight-inclusive. |
| Powered comparability | 10 of 10 powered rows are cross-border: 5 Ubuy and 5 Desertcart. | High uncertainty; no powered RRP approval. |
| Source-quality mix | 44 rows are labelled High, 58 Moderate and 2 Low under the stated rubric. | Medians combine evidence strengths and are not equally comparable offers. |
| Marketplace exposure | 22 rows are marketplace listings. | Seller, fulfilment and remedy terms can vary from the host retailer. |
| Warranty evidence | Only 8 rows state a source warranty claim. | Warranty value cannot justify a premium yet. |
| Returns evidence | Only 14 rows state an explicit source return claim; most others refer to general retailer, clearance or marketplace terms. | Model returns independently; do not assume low exposure. |
| Promotions/availability | Sale, clearance, member, unavailable and other qualifiers are retained in row notes. | Do not treat promotional lows as sustainable everyday anchors. |
| Product claims | Ingress ratings, buoyancy, motor, capacity and other performance details remain source claims. | Exact-SKU supplier/test/compliance evidence is required before storefront use. |

## Market gaps and opportunities

- No credible locally stocked Australian specialist set was found for adult-only, pool-only motorised floats with verified local compliance/support. That is a positioning gap and also evidence that demand and acceptable pricing are unproven.
- Powered listings are weak on Australian compliance, battery transport, replacement parts and local warranty handling. A genuine verified local support model could differentiate Docked.
- Many unpowered offers are generic, novelty-led or not consistently adult-positioned. Restrained design, adult sizing and reliable capacity information could create separation only when substantiated.
- Accessories are commoditised. Verified compatibility, instructions and useful consent-based bundles may be more defensible than standalone price premiums.

## Draft RRP planning bands

These addendum-supplied working bands are planning limits, not approvals, and never override unit economics.

| Category | Draft band inc GST | Named-concept draft |
| --- | ---: | ---: |
| Single-motor powered float | $449-$549 | $499 |
| Dual-motor powered float | $599-$699 | $649 |
| Dual-motor canopy float | $699-$799 | $749 |
| Mesh lounge | $49-$69 | $59 |
| Supportive chair | $69-$99 | $79 |
| Full-length lounge | $79-$119 | $99 |
| Two-person island | $199-$279 | $229 |
| Party island | $299-$399 | $329 |
| Floating cooler | $39-$59 | $49 |
| Floating drink tray | $19-$39 | $29 |
| Volleyball set | $49-$69 | $59 |
| Rechargeable pump | $35-$49 | $39 |
| Manual pump | $20-$35 | $29 |
| PVC repair kit | $15-$25 | $19 |
| Dry storage pouch | Not supplied | $29 |

## Unit-economics gate

[`pricing-calculator.csv`](../data/pricing-calculator.csv) contains 15 row-local formula models. Retail ex GST and GST are calculated from the draft price. Gross profit, margin, payment fee, warranty allowance and contribution remain blank until every required cost/rate input exists; blank is not zero.

Missing inputs for every concept include supplier/landed cost, freight/duty/brokerage, warehousing, outbound delivery, Shopify/payment fees, returns/replacement/warranty allowance, advertising, packaging, volume, discounting and bundle mix.

If the commercially viable price is materially above a defensible market position, record:

> **DO NOT LAUNCH - COST OR PRICING REVIEW REQUIRED**

Final price approval belongs in [PRICE_APPROVAL_REGISTER.md](PRICE_APPROVAL_REGISTER.md) and requires the owner, approver/date and completed economics. A draft RRP or calculated spreadsheet state is never approval.
