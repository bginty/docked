# Docked supplier onboarding

Status: **DRAFT PROCESS — NO SUPPLIER OR SKU APPROVED**  
Last updated: 13 August 2026

This workflow applies before Docked orders, lists or activates any product. It is designed to establish supplier identity, exact-product evidence, traceability, content rights and operating support. It does not transfer Docked’s Australian supplier obligations to an overseas manufacturer or marketplace seller.

## Responsibilities

| Role | Responsibility |
| --- | --- |
| Owner | Supplier appointment, contracts, purchase authority, commercial terms and final release |
| Procurement | Identity checks, commercial file, samples, change notices and supplier communication |
| Product/compliance lead | SKU dossier, evidence mapping, classification coordination and compliance register |
| Specialist adviser/laboratory | Applicable Australian classification, testing and regulatory opinions |
| Operations | Inventory, traceability, shipping, warranty, defects and recall readiness |
| Content lead | Media licences, accurate product data and claim/warning reconciliation |
| Technical/ecommerce lead | Draft product setup, gated metafields and release controls |

Named people and advisers remain unassigned.

## Stage 1 — supplier pre-screen

Reject or hold the candidate before product work if identity, authority or traceability cannot be verified.

- Collect registered legal entity, registration number, registered/trading address and country.
- Collect authorised sales, compliance, quality, defect-escalation and recall contacts.
- Identify the legal manufacturer and every relevant manufacturing site.
- Record whether the candidate is manufacturer, authorised distributor, agent or marketplace trader.
- Verify authority to supply the exact brand/model and grant product-media rights.
- Review business references, quality processes, change-control process and prior recall/safety history where lawfully available.
- Record factory information and audit evidence where available; do not describe a factory as audited unless the audit is verified.

### Supplier master record

| Field | Required value |
| --- | --- |
| Supplier ID | Internal identifier; not yet assigned |
| Legal entity and registration | Requires verification |
| Registered/trading address | Requires verification |
| Manufacturer and site | Requires verification |
| Authorised contacts | Requires verification |
| Relationship/authority | Requires verification |
| Quality/change-control process | Requires verification |
| Compliance/defect/recall contacts | Requires verification |
| Approval status | Not approved |

## Stage 2 — commercial onboarding

- Execute a purchase agreement identifying exact models, revisions and authorised variants.
- Obtain a model-specific commercial invoice/quotation and Incoterms where relevant.
- Record unit cost, minimum order, tooling, freight, duties, lead time, payment terms and currency without committing sensitive banking data to Git.
- Define inspection/acceptance criteria, defect thresholds, remedies, change notification and evidence warranties.
- Require prior written notice and Docked approval for any material change to factory, model, component, cell, battery pack, charger, controller, firmware, material, colourway, valve, guard, label, packaging or manual.
- Agree warranty support, parts supply, replacement/repair process, defect escalation, recall cooperation and cost allocation.

Only the owner may execute or approve commercial commitments.

## Stage 3 — per-SKU evidence dossier

Create a separate dossier for every final model/SKU/variant family. Collect:

- product model, final SKU, barcode and production revision;
- manufacturer identity and manufacturing location;
- batch, lot or serial process and sample traceability data;
- final packaging, labels and English-language instruction manual;
- bill of materials or verified material declaration;
- PVC specification and applicable chemical test reports;
- verified user weight, total load and occupancy evidence;
- applicable valve, mechanical, physical, stability, seam, handle and attachment evidence;
- product dimensions, product weight, packed dimensions and packed weight;
- warranty terms, spare parts, approved replacements and defect escalation;
- product photography/video files plus written licence, territory, channels, term and modification rights;
- Australian shipping acceptance and special handling requirements; and
- the complete evidence listed in `docs/PRODUCT_EVIDENCE_CHECKLIST.md`.

Do not accept reports for a similar model, different battery/charger, unidentifiable sample or old production version without a documented technical justification approved by the reviewer.

## Stage 4 — category overlays

### Aquatic products

For powered floats, loungers, islands, pool games, floating coolers and drink holders:

- obtain a written Australian classification review for the exact SKU;
- consider aquatic-toy, swimming/flotation-aid, PFD and other regulated-product issues;
- verify final design, size, capacity, foreseeable use, age grading, supplier marketing, packaging, instructions and imagery;
- verify valves, construction, permanent warnings and mechanical/physical tests where applicable;
- verify approved age, occupancy, maximum load and water environment;
- verify boarding/exiting, loss-of-air, inspection, care and storage instructions; and
- reconcile Docked’s adults-18+ positioning with, but never use it to override, applicable warnings or classification.

### Powered floats

- motor model/count, ratings, guards, intakes and attachment;
- controller type, stop/fail-safe behaviour and turning/stopping evidence;
- hair, finger, clothing, jewellery and entanglement controls;
- safe isolation before entry, exit, lifting, inspection or obstruction clearing; and
- pool-size, cover, rope, net and nearby-swimmer restrictions.

### Electrical, charger and rechargeable pump

- charger model, Australian input/output ratings, plug and cable;
- Australian electrical-safety/EESS applicability and risk classification;
- responsible-supplier and equipment registration records where applicable;
- test reports, compliance folder/certificate and lawful RCM evidence where applicable;
- exact-component water-ingress reports and dry-charging controls; and
- charging, fault, storage and disposal instructions.

### Batteries and transport

- cell/pack chemistry, maker, model, voltage, capacity and watt-hours;
- model-specific transport test documentation/test summary and packaging configuration;
- safe charging, storage-charge, heat, swelling, damage, wetting, odour, fire and disposal instructions;
- confirmation whether installed in equipment or packed separately; and
- written carrier acceptance for each service/route.

### Radio/EMC

If a controller contains a transmitter/receiver, collect function, frequency and power information, applicable test reports, supplier declarations and records, registration/labelling evidence and written ACMA/EMC applicability review. An overseas mark does not by itself permit Australian supply.

### Other products

- Canopy: attachment, folding/removal, wind restrictions and any sun-protection substantiation.
- Games: pool size/depth, anchors, cords/nets and entanglement controls.
- Coolers/trays: verified capacity/stability, not-a-flotation-device warning and no-glass direction.
- Manual pump: pressure/method compatibility, inspection and safe-use instructions.
- Repair kit: contents, material/chemical evidence, safety data where applicable, compatibility, application limits and disposal.
- Storage pouch: exact water-ingress test, rating, limitations and closure/use instructions before any waterproof/water-resistant claim.

## Stage 5 — sample, packaging and data reconciliation

Use a final-production or controlled pre-production sample that matches the evidence set.

1. Photograph model/revision, labels, markings, packaging and included components.
2. Check SKU/barcode and batch/serial traceability.
3. Compare measurements and included items with supplier records; do not create public values from an informal measurement alone.
4. Check warnings are present, legible, durable as required and consistent across product, packaging and manual.
5. Confirm safe setup/use/charging/care instructions are internally consistent.
6. Record every discrepancy and block the SKU until the supplier issues controlled corrective evidence.

Sample inspection is not a substitute for required testing or legal classification.

## Stage 6 — content and licence approval

- Maintain a source/licence record for every image and video.
- Use only the final product and lawful adult-only imagery for aquatic products.
- Do not copy, scrape, hotlink or adapt competitor listing assets or reviews.
- Compare every title, specification, feature, instruction and warning to accepted evidence.
- Keep the approved physical-claim register empty until exact wording is signed off.
- Never publish non-toxic PVC, phthalate free, BPA free, eco-friendly, recyclable, puncture proof, heavy duty, commercial grade, waterproof, child safe or unsinkable without claim-specific evidence and approval.

## Stage 7 — operations and recall readiness

- Test order-to-batch/serial lookup and stock quarantine.
- Confirm receiving inspection, non-conformance hold and supplier escalation.
- Confirm approved battery carrier/service and packaging for each applicable SKU.
- Confirm warranty, parts, repair/replacement and safe disposal routes.
- Verify recall contacts and complete a tabletop recall exercise.
- Keep the support mailbox, incident log and controlled customer-contact export process ready.

## Approval outcome

| Outcome | Meaning |
| --- | --- |
| Rejected | Supplier or SKU cannot meet identity, safety, traceability, evidence or commercial requirements |
| Hold — information required | Material evidence or clarification is missing; no purchase/listing/activation |
| Conditionally onboarded | Supplier administration may proceed, but no SKU is approved and every condition is recorded |
| Supplier approved | Supplier identity/commercial file approved; each SKU still requires separate approval |
| SKU approved for activation | All SKU gates closed through `docs/SKU_APPROVAL_WORKFLOW.md`; owner release recorded |

Supplier approval never automatically approves a product. A SKU approval never covers a different model, variant, revision, component or production change.

## Automatic hold conditions

Place the supplier/SKU on hold for missing or mismatched identity, refusal to provide evidence, altered/ambiguous reports, unapproved substitutions, missing English instructions, warnings that conflict with marketing, untraceable stock, unlicensed media, unsupported certification/health/environmental claims, inability to support a recall, or pressure to list before review.
