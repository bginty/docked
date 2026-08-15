# Docked SKU approval workflow

Status: **DRAFT GATE — DC-02 AT STAGE 0; ACTIVE PROHIBITED**
Last updated: 15 August 2026

This workflow controls movement from a named concept to a Shopify Active product. It applies to the exact supplier model, SKU, variant, production revision and component set. No approval is inherited from another product, supplier declaration or similar test report.

DC-02 / **Docked Cruise D2** retains its existing concept ID and is the sole current planned Draft product. The other 14 concepts are withdrawn from the current plan; their workflow history remains recoverable at baseline commit `306e5dd`. Supplier component files received on 15 August 2026 do not move DC-02 beyond Stage 0: they remain under review, do not approve a final SKU and do not permit Active status.

## Status model

| Stage | Status | Exit authority |
| --- | --- | --- |
| 0 | Concept / Shopify Draft | None; this is the current state |
| 1 | Identity and commercial file complete | Procurement + owner |
| 2 | Evidence dossier complete | Product/compliance lead |
| 3 | Classification and specialist review complete | Relevant Australian specialist adviser(s) |
| 4 | Final sample, packaging and traceability accepted | Product/compliance + operations |
| 5 | Claims, warnings, imagery and policies approved | Supplier as relevant + compliance/legal + content |
| 6 | Price, inventory, shipping and support approved | Owner + operations |
| 7 | Shopify/test readiness passed | Ecommerce/QA + payments/operations |
| 8 | Final launch approval | Owner, after all prior sign-offs |
| 9 | Active | Authorised ecommerce operator only |

Stages cannot be skipped, backfilled after activation or closed with “to be confirmed”. A material change returns the SKU to the earliest affected stage and may require an immediate stop-sale.

## Stage 0 — create a controlled Draft concept

Required controls:

- Product status `Draft`; no live checkout representation.
- Concept ID assigned; final SKU, barcode, supplier, landed cost, stock, weight and dimensions remain blank or `Requires verification`.
- Draft RRP labelled as market-positioning only.
- Aquatic concepts marked adults 18+; this does not decide regulatory classification.
- Powered/Battery flags describe only the intended concept and are not certifications.
- Compliance, photography, copy and owner approval marked blocked/pending.

The Stage 0 record must state that no 160 kg load test was supplied; runtime (30/90 minutes), power (46/66 W) and speed (5 km/h/1.6 m/s) conflict; AI concept PNGs are not exact-SKU product photography; and the complimentary pump and each of the two included batteries require applicable component evidence.

## Stage 1 — identity and commercial gate

Exit requires:

- verified supplier and manufacturer identities/addresses;
- executed purchase agreement and model-specific commercial invoice;
- final model, SKU, variants and barcode where applicable;
- factory/change-control information;
- warranty, spare-parts, defect-escalation and recall contacts; and
- owner approval of the supplier relationship and purchase authority.

Do not place a commercial order where safety evidence is a condition “after shipment”.

## Stage 2 — evidence dossier gate

The product/compliance lead checks every applicable line in `docs/PRODUCT_EVIDENCE_CHECKLIST.md` and records it in `docs/COMPLIANCE_REGISTER.md`.

Exit requires final packaging, labels, English manual, material evidence, applicable reports, capacity/load evidence, traceability, packed measures, media licences and category-specific evidence tied to the exact production configuration. Component reports are accepted only for the exact components they identify and must reconcile to the final whole-product configuration. Missing, ambiguous, expired or model-mismatched evidence fails the gate.

For DC-02, Stage 2 cannot pass until an exact-model load/weight-bearing test resolves the proposed 160 kg claim; the 30/90-minute runtime, 46/66 W power and 5 km/h/1.6 m/s speed conflicts are reconciled; and the complimentary pump and both included batteries have their own applicable identity, safety, electrical, charging and transport evidence.

## Stage 3 — classification and specialist gate

### Aquatic SKU

- Written Australian classification covering design, size, capacity, foreseeable use, supplier marketing, packaging, instructions, imagery and age grading.
- Explicit aquatic-toy and swimming/flotation-aid/PFD decisions.
- If a mandatory standard applies, complete evidence for every current design, construction, testing, marking and warning requirement.
- Confirmation that adults-18+ merchandising does not conflict with required warnings or foreseeable-use analysis.

### Powered/electrical/battery SKU

- Motor/guard/controller hazard review where propelled.
- Electrical/EESS scope/risk and responsible-supplier/RCM determination for the product/charger.
- Battery identity, ratings, safety and transport review.
- Component-specific water-ingress review.
- ACMA/EMC/radio review if any transmitter/receiver is present.
- Written carrier acceptance for the exact packed battery configuration.

### Included-component gates

- Exact complimentary-pump architecture, instructions, warnings, electrical/charging scope and Australian compliance review as applicable.
- Exact identity, ratings, safety, charging and transport review for each of the two included batteries and the final packed configuration.

Only a competent reviewer may mark an applicability decision approved. The reviewer’s name, date, evidence reference and review scope are mandatory.

## Stage 4 — final sample, packaging and traceability gate

Exit requires:

1. The inspected sample matches supplier model, production revision, materials, both batteries, charger/charging method, complimentary pump, controller and reports.
2. Product, packaging, labels, manual, SKU/barcode and every included item reconcile.
3. Required warnings/markings are present and have the necessary permanence/durability evidence.
4. Batch/serial code links successfully from received unit to supplier lot and a test customer order.
5. Receiving inspection and non-conformance quarantine work.
6. No unresolved discrepancy or unapproved substitution remains.

## Stage 5 — content, claims, warning and licence gate

Exit requires:

- approved physical claims recorded with exact wording and evidence in `docs/APPROVED_PRODUCT_CLAIMS.md`;
- supplier/manual, Australian product-safety and legal review of the applicable Draft warnings;
- critical warning near Add to Cart, full warnings in the product Safety section and complete warning set on Safety and Care;
- specifications rendered only from verified fields;
- accurate licensed final-product photography/video, using clearly adult models for aquatic products; AI concept PNGs cannot satisfy this requirement or be presented as documentary product photography;
- no competitor assets, fake reviews, unsupported badges, child-focused content or unsafe use; and
- content/manual/packaging reconciliation signed and dated.

At present, the approved physical-product claim set is empty, so this gate cannot pass.

## Stage 6 — commercial and operations gate

Exit requires:

- verified landed cost and current Australian pricing research;
- owner-approved GST-inclusive final price; compare-at price blank unless lawfully substantiated;
- counted stock and final variant mapping; overselling off and preorder off unless separately approved;
- verified packed weight/dimensions and Australia-only carrier/rate configuration;
- battery-service acceptance where applicable;
- approved warranty/change-of-mind/returns process that preserves ACL rights;
- operating support mailbox and trained defect/safety escalation; and
- effective product-liability cover accepted by the owner.

## Stage 7 — Shopify and test gate

Exit requires evidence that:

- Draft product data, variants, inventory and verified metafields are correct;
- unverified values are hidden and no unsupported structured data/claim appears;
- GST-inclusive display and tax invoices pass full-price, discount, shipping, multi-item, refund and partial-refund tests;
- Shopify Payments/PayPal supported test flows pass without a real card, while live capture remains off;
- shipping, notifications, contact, accessibility, browser/mobile, performance, broken-link and safety-placement checks pass;
- support email authentication/delivery works; and
- rollback, stock quarantine and recall tabletop tests pass.

## Stage 8 — final owner release

The owner signs one release for the exact SKU/variants confirming:

- supplier/model/revision and all stage approvals;
- final cost, price, inventory and shipping offer;
- final claims, warnings, imagery, policies and warranty;
- merchant/payment, tax, email and test evidence;
- insurance and adviser outcomes; and
- permission to activate that SKU and enable the approved selling configuration.

Verbal approval, a supplier email or approval of one SKU is not a substitute.

## Stage 9 — activation and post-release control

An authorised ecommerce operator may change Shopify status from Draft to Active only after checking the signed Stage 8 record. Record timestamp, operator, product ID and live smoke-test evidence. Monitor complaints, incidents, returns, battery/motor faults, leakage, label/manual discrepancies and supplier change notices.

Immediately stop sale and reopen the workflow for a suspected safety issue, regulatory change, evidence expiry, unapproved substitution, report mismatch, serious recurring defect, missing warning, inaccurate claim or recall affecting the model/component.

## Approval record template

| Field | Required entry |
| --- | --- |
| Concept ID | Required |
| Final product title/model/SKU/variants | Required; `Requires verification` is not an approval |
| Supplier/manufacturer/revision | Required |
| Evidence dossier reference/version | Required |
| Classification decision and adviser | Required |
| Electrical/battery/radio decisions | Required where applicable |
| Sample/packaging/traceability result | Required |
| Claims/warnings/media approval | Required |
| Cost/price/stock/shipping approval | Required |
| Technical/test evidence | Required |
| Insurance/policy review | Required |
| Owner name/sign-off/date | Required |
| Shopify activation record | Completed only after activation |

## Current stage register

| Concept ID | Product title | Final SKU | Current stage | Active permitted? |
| --- | --- | --- | --- | --- |
| DC-02 | Docked Cruise D2 | Requires verification | 0 — Draft; supplier component files received 15 August 2026 and under review | No — Active prohibited |

The other 14 concepts are withdrawn from the current plan and are not eligible to advance. Use baseline commit `306e5dd` only if their historical records are needed for audit; any future revival requires a new documented range decision and a fresh Stage 0 review.
