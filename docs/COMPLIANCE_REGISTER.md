# Docked compliance register

Status: **PRELAUNCH — DC-02 AND EVERY INCLUDED COMPONENT BLOCKED**
Register date: 15 August 2026

Website completion, supplier assurances and receipt of test files do not certify a physical product. `DC-02 / Docked Cruise D2` is the sole current planned product and remains Draft. Fourteen superseded Shopify product shells were archived, not deleted, on 15 August 2026; their research remains recoverable at baseline commit `306e5dd` but is not current catalogue authority.

## Register controls

Every requirement record uses these fields: requirement, applicability, evidence required, evidence received, document location, reviewer, review date, expiry/retest date, status and notes. Permitted statuses are `Not assessed`, `Pending evidence`, `Under review`, `Approved`, `Not applicable — rationale approved`, `Expired` and `Rejected`.

`DC-02` is a concept ID, not a supplier model, commercial SKU or purchase authority. An overseas mark, supplier declaration, component report, AI image or adult-only disclaimer does not establish whole-product or Australian compliance. A report can move a requirement to `Under review`; only an accepted scope/model match and documented reviewer decision can make it `Approved`.

## Current product scope

| Concept ID | Working name | Intended configuration | Shopify state | Approval state |
| --- | --- | --- | --- | --- |
| DC-02 | Docked Cruise D2 | One adult motorised inflatable pool lounger; two lithium batteries and a complimentary air pump proposed as included components | Draft only | Blocked — no final supplier model/SKU, reconciled whole-product dossier, accepted sample or approved claim set |

The product requirements and supplier material currently conflict on runtime (`30` or `90` minutes), rated power (`46` or `66 W`), speed (`1.6 m/s` or `5 km/h`) and dimensions (`157 × 195 × 460 mm` or `167 × 109 × 60 cm`). The `160 kg` load claim has no supplied load/weight-bearing test. Thrust (`2.8 kg`) also lacks an accepted exact-SKU test scope. All of these values are unapproved and must remain absent from public copy and product metafields.

## Evidence received 15 August 2026

| Evidence group | What the files appear to cover | Scope decision | Status | Required follow-up |
| --- | --- | --- | --- | --- |
| CE EMC / FCC Part 15B / RoHS PDFs | A `Propeller` subassembly, principal model `XS-191A`; `XS-192A` appears as a declared series model; applicant/manufacturer shown as Hunan Xinsheng Intelligent Technology Co., Ltd | Component scope only. Report folder/file labelling is inconsistent. The CE attestation is voluntary and does not itself authorise CE marking. None of these documents is an Australian whole-product approval. | Under review | Verify reports with issuer; obtain exact production component mapping, revision, complete product safety/risk evidence and applicable Australian supplier/RCM decisions |
| Battery/MSDS/UN38.3/packaging PDFs | A blue three-cell lithium-ion pack described as generic model `18650`, nominal `11.1 V`, `2600 mAh`, `28.86 Wh`; manufacturer shown as Shenzhen Ju Peng Yuan Electronic Technology Co., Ltd | Battery-component evidence only. Generic identity and production traceability are unresolved. The transport material does not establish the final configuration of two batteries packed with/contained in the lounger. | Under review | Reconcile both delivered packs and revisions; validate issuer/current applicability; obtain test summary, final package classification, charger evidence and written carrier acceptance |
| Four supplier PNGs | Concept scenes and feature graphics for a blue/white motorised lounger | C2PA metadata identifies OpenAI/gpt-image creation. Geometry and claims vary across images. They are not documentary exact-SKU photographs, test evidence or licensed public product media. | Rejected for public product use | Obtain licensed photographs/video of the exact final production sample, rights records and adult/safety review |
| Supplier statements | Two batteries included; complimentary pump; proposed quantity 20; sample available; sticker-logo option | Commercial statements only and not evidence of current stock, accepted model identity, component safety or approved packed contents | Pending evidence | Obtain final quotation/order terms, manufacturer and model identifiers, bill of materials, sample, packaging, manuals, stock and traceability records |

No confidential supplier report is to be committed to the public theme repository. Record hashes, controlled locations and reviewer outcomes in the evidence review without publishing the files.

## Business and operating requirements

| ID | Requirement | Applicability | Evidence required | Evidence received | Document location | Reviewer | Review date | Expiry/retest | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BIZ-01 | Legal selling entity, ABN and ACN | Applicable | Current authoritative registration and exact disclosures | Owner supplied GINTY UNITED INVESTMENTS PTY LTD; ABN 78 606 187 106; ACN 606 187 106 | Project addendum; authoritative check pending | Owner / adviser | — | Before launch/on change | Pending evidence | Do not abbreviate or invent the legal seller |
| BIZ-02 | Docked business-name and trademark use | Applicable; hard launch gate | Documented business-name resolution and brand clearance | Preliminary issue recorded; no resolution accepted | Controlled legal/business-name record | Owner / adviser | — | Before any public launch | Pending evidence | Domain ownership is not business-name authority; no ® |
| BIZ-03 | GST and tax invoices | Applicable | Verified GST settings and successful order/refund invoice QA | Owner states GST registered | Shopify/tax QA pending | Owner / accountant | — | Before launch/on change | Pending evidence | Consumer prices must include GST |
| BIZ-04 | Support email | Applicable | Inbound, outbound, contact/order/refund notification, SPF, DKIM and DMARC tests | Owner says mailbox is set up; end-to-end evidence not recorded here | Email QA record pending | Technical owner | — | Before launch/ongoing | Pending evidence | Setup alone is not full verification |
| BIZ-05 | Product liability insurance | Applicable | Insurer confirmation for this exact motorised aquatic product and included components | None | Controlled insurance record pending | Owner / insurer | — | Policy renewal | Pending evidence | Quote/application is insufficient |

## Supplier, product and traceability requirements

| ID | Requirement | Applicability | Evidence required | Evidence received | Document location | Reviewer | Review date | Expiry/retest | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SUP-01 | Supplier and manufacturer identity | DC-02 and each included component | Legal entities, addresses, authorised contacts and relationship to the final goods | Two component-manufacturer names appear in reports; dropship seller/final assembler relationship unresolved | Controlled supplier dossier pending | Procurement / compliance | — | On supplier/site change | Under review | A report applicant is not automatically the seller or final-product manufacturer |
| SUP-02 | Final model, revision, SKU and barcode | DC-02 | One identifier set reconciled across quote, order, sample, reports, packaging, manual and Shopify | Propeller series and generic battery model appear; no complete-lounger identifier accepted | Controlled SKU dossier pending | Product owner / compliance | — | Every change | Pending evidence | Keep supplier, SKU and barcode blank in catalogue |
| SUP-03 | Production sample and golden sample | DC-02 | Received sample matching final purchase specification and signed inspection | Seller says a sample can be provided | Sample record pending | Product / compliance | — | Before first order/on change | Pending evidence | Availability is not receipt or inspection |
| SUP-04 | Bill of materials and included contents | Lounger, two batteries, pump, charger/cable and all accessories | Final BOM, exact component models, quantities and package inspection | Supplier statements and component list only | Controlled SKU dossier pending | Product / compliance | — | Every revision | Pending evidence | Treat pump and batteries as included components, not separate products |
| SUP-05 | English manual, labels and packaging | DC-02 and included components | Final Australian-market revisions, warning placement and consistency review | A manual is said to be included; final approved revision not received/accepted | Controlled SKU dossier pending | Compliance / legal | — | Every change | Pending evidence | Plastic-bag warning alone is not complete product labelling |
| SUP-06 | Batch/serial traceability and recall support | DC-02, batteries, pump and charger | Coding method, unit-to-order lookup and supplier escalation test | None | Traceability record pending | Operations / compliance | — | Before launch/periodic | Pending evidence | Generic `18650` identity is insufficient traceability |

## Aquatic, mechanical and performance requirements

| ID | Requirement | Applicability | Evidence required | Evidence received | Document location | Reviewer | Review date | Expiry/retest | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AQU-01 | Written Australian product classification | Decision required for DC-02 | Exact-SKU review of design, foreseeable use, age grading, packaging, manual and imagery | Adult 18+ project direction only | `docs/PRODUCT_CLASSIFICATION_REGISTER.md` | Australian product-safety/legal adviser | — | Every material change | Not assessed | Adult-only positioning is not a classification decision |
| AQU-02 | Aquatic-toy / flotation-aid / PFD applicability | Decision required | Written applicable/not-applicable rationale and all evidence for the outcome | None | Classification record pending | Australian product-safety/legal adviser | — | Check current law before supply | Not assessed | A disclaimer cannot decide scope |
| AQU-03 | Occupancy and maximum load | Applicable | Exact-SKU load/stability/occupancy test, conditions and matching label/manual | One-person/`160 kg` claim; owner confirms no 160 kg test | Test dossier pending | Accredited laboratory / compliance | — | Per report/on design change | Pending evidence | `160 kg` must not be published |
| AQU-04 | Inflatable construction, seams, chambers and valves | Applicable | Drawings/material specification and applicable physical/mechanical tests | None accepted | Test dossier pending | Laboratory / compliance | — | On design/material change | Pending evidence | AI images are not construction evidence |
| AQU-05 | Approved environment and operating limits | Applicable | Exact pool conditions, depth/clearance, weather, entry/exit, supervision and prohibited uses | Draft “pool only” direction | Final manual pending | Supplier / compliance / legal | — | Every manual change | Pending evidence | No open-water use may be implied |
| MEC-01 | Propulsion, guards, entanglement and fail-safe controls | Applicable | Exact motor/propeller count, guarded intake/outlet, obstruction response, control/fail-safe and stopping/turning tests | EMC/FCC/RoHS component reports only | Mechanical risk dossier pending | Test specialist / compliance | — | On component/design change | Under review | Compliance reports do not establish mechanical safety |
| PERF-01 | Power, runtime, speed, thrust and charge time | Applicable if claimed | Exact final configuration, defined conditions, calibrated tests and matching manual/labels | Conflicting `46/66 W`, `30/90 min`, `1.6 m/s/5 km/h`; `2.8 kg` thrust and `3.8 h` charge statements | Claim reconciliation pending | Test specialist / compliance | — | On configuration change | Pending evidence | All numeric values blocked |
| PERF-02 | Dimensions and product weight | Applicable if published/shipping | Exact sample measurement with net/gross and inflated/packed/component basis | Conflicting component and lounger dimensions; `1.8 kg` scope unresolved | Measurement record pending | Product / logistics | — | On configuration/pack change | Pending evidence | Leave storefront and shipping fields blank |

## Electrical, battery, charging and transport requirements

| ID | Requirement | Applicability | Evidence required | Evidence received | Document location | Reviewer | Review date | Expiry/retest | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ELE-01 | Electrical-safety/EESS and RCM decision | DC-02, pump, charger and applicable components | Australian responsible-supplier/risk-level review, standards evidence, supplier declaration and marking decision | Overseas CE/FCC/RoHS component documents only | Australian electrical dossier pending | Electrical compliance specialist | — | Before supply/on change | Not assessed | CE/FCC/RoHS is not an Australian RCM approval |
| ELE-02 | Charger/cable/Type-C architecture | Applicable | Exact supplied charger and cable models, input/output, AU plug, charge protocol, protection and instructions | Type-C statement; battery report refers to `12.6 V` charge; no accepted supplied-charger evidence | Charger dossier pending | Electrical/battery specialist | — | On charger/cable change | Pending evidence | Do not publish charging claims |
| ELE-03 | Water ingress and dry charging | Applicable | Component-specific ingress tests/limitations and approved dry-charge instructions | None accepted | Test/manual dossier pending | Test specialist / compliance | — | On enclosure/connector change | Pending evidence | No “waterproof” claim |
| BAT-01 | Exact identity of both included packs | Applicable | Maker, unique model/revision, cells, protection board, ratings, labels, serial/batch and sample match for each pack | Generic `18650`, `11.1 V`, `2600 mAh`, `28.86 Wh` pack documents under review | Controlled battery dossier | Battery specialist | — | On any cell/pack change | Under review | Do not populate public battery metafields |
| BAT-02 | Battery safety and UN 38.3 validity | Applicable | Authentic/current exact-type evidence, test summary and configuration match | 2021 UN 38.3 report and other files received; exact delivered-pack match/current status unresolved | Controlled battery dossier | Battery/dangerous-goods specialist | — | Per report/current rules/on change | Under review | Two packs would total `57.72 Wh` only if the received ratings match; do not publish calculation |
| BAT-03 | Final transport classification, packaging and carrier acceptance | Applicable | Classification for actual sale configuration, package design/marks/docs, route/service acceptance and remote-area rules | Standalone-battery packaging evidence appears to cover a different multi-pack shipment configuration | Shipping dossier pending | Dangerous-goods specialist / carrier | — | Every route/package/service change | Pending evidence | No shipping promise or express/international service |
| BAT-04 | Charging, storage, damage, fire and disposal instructions | Applicable | Exact pack/charger instructions and incident/returns handling | None accepted | Manual/operations dossier pending | Battery specialist / operations | — | On component/instruction change | Pending evidence | Damaged/returned battery workflow required |

## Media, commercial and launch requirements

| ID | Requirement | Applicability | Evidence required | Evidence received | Document location | Reviewer | Review date | Expiry/retest | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MKT-01 | Licensed exact-SKU media | Applicable | Exact production-sample photos/video, creator/rights permission, model releases and safety review | Four AI concept PNGs only | `docs/ASSET_LICENCES.md` | Rights owner / compliance | 15 Aug 2026 | Before any use/on withdrawal | Rejected | Internal moodboard only; never documentary product media |
| MKT-02 | Approved product claims | Applicable | Claim-to-evidence matrix and owner release | No physical claim approved | `docs/APPROVED_PRODUCT_CLAIMS.md` | Compliance / legal / owner | 15 Aug 2026 | Every claim/change | Pending evidence | Blank is the correct storefront state |
| COM-01 | Price and unit economics | Applicable | Landed cost, GST, freight, fees, returns/warranty, margin/contribution and owner approval | `$649` planning price only | `docs/PRICE_APPROVAL_REGISTER.md` | Owner / finance | — | Before activation/on change | Pending evidence | Pending, not approved |
| COM-02 | Inventory | Applicable | Executed purchase, received/available quantity and inventory reconciliation | Proposed order quantity `20`; no stock evidence | Inventory record pending | Owner / operations | — | Before activation/ongoing | Pending evidence | Do not enter 20 as available inventory |
| COM-03 | Shipping | Applicable | Packed weight/dimensions, dispatch point, carrier quote/acceptance, battery treatment, handling and service matrix | None accepted | Shipping dossier pending | Operations / carrier | — | Before activation/on change | Pending evidence | Australia only initially; international disabled |
| COM-04 | Returns, warranty and recall operations | Applicable | Supplier support, ACL-consistent policies, spare/repair path and tested recall workflow | Draft policy/process only | Operations dossier pending | Owner / adviser | — | Before activation/periodic | Pending evidence | Do not promise an unapproved express warranty |
| LAU-01 | Individual activation approval | Applicable | All applicable records approved, owner activation approval and Shopify preflight | No approval | SKU release record pending | Owner | — | Immediately before activation | Pending evidence | DC-02 remains Draft; all 14 superseded product shells were archived on 15 August 2026 |

## Historical range preservation

The other 14 concepts are withdrawn from the current commercial plan. Their prior benchmark and register history remains recoverable at baseline commit `306e5dd`. Authenticated Admin reconciliation on 15 August 2026 confirmed their product shells were Archived rather than deleted; keep them Archived and non-public. The complimentary pump and both batteries are components of the proposed DC-02 pack, not separate current catalogue products.

## Change control

Any change to supplier, manufacturing site, model/revision, motor, guard, controller, battery cell/pack, charger/cable, pump, inflatable material, dimensions, capacity, packaging, manual, label, firmware, included contents, shipping configuration or public claim reopens every affected requirement. Keep the product Draft until the changed evidence is accepted and the release record is re-approved.
