# DC-02 supplier evidence review

Status: **BLOCKED — EVIDENCE RECEIVED, NO STOREFRONT PRODUCT CLAIMS APPROVED**

Review date: 15 August 2026

Product concept: DC-02 Docked Cruise D2 rechargeable motorised pool lounger
Review type: preliminary document, transport and media applicability review; not a certification, legal opinion or product approval

## Decision

The supplied evidence is useful, but it does not establish that the complete DC-02 lounger is safe, compliant, shippable or accurately described for sale in Australia.

The CE, FCC and RoHS documents identify a **Propeller** subassembly, principally model `XS-191A`, with `XS-192A` included only as a declared series model. The battery documents identify a generic-model `18650` 3S lithium-ion pack and several transport tests for cartons of 60 standalone batteries. None of those records establishes the complete lounger, its two-drive configuration, final charger, complimentary air pump, retail package, Australian regulatory position or the proposed `160 kg` load claim.

Accordingly:

- DC-02 must remain **Draft** and unavailable for purchase.
- The product-compliance, approved-product, licensed-media, shipping and product-liability launch gates remain **blocked**.
- All numeric physical, performance, load, runtime, speed, power, battery, charging and dimension claims remain blocked from customer-facing use.
- The four supplied PNGs are AI concept artwork, not exact-SKU documentary photography, and must not be published as product media.
- No supplied archive, PDF or image has been copied into the repository. This register records hashes and findings only.

## Evidence custody and archive manifest

The source archives were inventoried and extracted into a temporary review directory. The extracted content consisted of PDFs and PNGs, plus a duplicate/nested RAR; no scripts or executable files were identified. Hashes below are the chain-of-custody references for the files as received.

| Source archive | Size (bytes) | SHA-256 | Review classification |
| --- | ---: | --- | --- |
| `CE ROHS FCC (1).rar` | 9,125,166 | `6FE252932A282B2F09126F21D3D16EA556B58AC08EEEE04E79AA607DB947E628` | Six propeller-component compliance PDFs |
| `NC 965 1.219 更新26年 18650 2600mah 11.1V 3S并排 20251229.zip` | 21,419,508 | `DF747518E42DEE5831CEA27B435C89FA00013023C1FECF42DCCE93F1ED4C9741` | Six battery/transport PDFs and a nested RAR |
| `Pics.zip` | 7,929,790 | `461570C7EF659E5C4B6975359CA3509A5CEE60D3F78FB7E83CEEB63ADE65D749` | Four AI-generated concept PNGs |

The archives should be retained in the controlled supplier dossier outside Git. A future replacement or revision must be hashed and reviewed as a new evidence version rather than silently replacing these files.

## Propeller compliance-file matrix

The applicant/manufacturer named in these records is **Hunan Xinsheng Intelligent Technology Co., Ltd.** The tested/referenced product is `Propeller`, model `XS-191A`; `XS-192A` appears as a series model based on the manufacturer's declaration. The records do not identify a Docked lounger SKU or complete inflatable chair.

| Received file | Internal report/certificate ID | Date shown | Model and stated scope | Preliminary finding | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `CE-ROHS/DSP25120664-1.pdf` | `DSP25120664-1` | 11 Dec 2025 | Propeller `XS-191A`; series `XS-192A`; selected applicant-supplied parts/materials | EU RoHS restricted-substance report for selected propeller components only; not complete-lounger evidence | `A857C18999021DE5E84EBF745E2F2E1150F95330F0BB7E58682194C374679CD3` |
| `CE-ROHS/DSP25120664.pdf` | Certificate `DSP2512255` | Dec 2025 | Propeller `XS-191A`; series `XS-192A` | Certificate must be read with the underlying report and verified with the issuer; no Australian product approval results | `E2A7E5C66B600531B970BE78978BF14E7F085312D5584CD5B797EA4221C446E4` |
| `CE-EMC/DSP25120665-1E.pdf` | Internal report `SSP25120665-1E` | Tests 8–18 Apr 2025; issued 23 Dec 2025 | Propeller `XS-191A`; series `XS-192A`; 11.1 V, 2600 mAh; USB 5 V test arrangement stated | FCC Part 15B test report marked PASS within its stated sample and test scope; not Australian ACMA evidence by itself and not a complete-lounger assessment | `D9DCFA916B947C28D59F5AFB505911B74F4A7341D10FB755C362019F4D23F913` |
| `CE-EMC/DSP25120665.pdf` | Certificate `SSP2511113C` | 23 Dec 2025 | Propeller `XS-191A`; series `XS-192A` | FCC certificate associated with the component report; folder and filename do not match the internal `SSP` ID | `E256F91DAB726EBAE6DB14CAE16E134DDA934DE282E8CC52758AF36EDE0FDAB2` |
| `FCC/SSP25120663-1E.pdf` | `SSP25120663-1E` | Tests 8–18 Apr 2025; issued 23 Dec 2025 | Propeller `XS-191A`; series `XS-192A`; EN IEC 61000-6-1:2019 and EN IEC 61000-6-3:2021 | CE/EMC report marked PASS within its stated component/sample scope; does not establish the final assembled product or Australian supplier obligations | `09BDE4A7196910862C0BDBD7C38D08AAA9C88B341B48473EAF396AB949E0E703` |
| `FCC/SSP25120663.pdf` | Attestation `SSP2511112C` | 23 Dec 2025 | Propeller `XS-191A`; series `XS-192A` | Voluntary attestation states that it does not replace an EU Declaration of Conformity or itself authorise CE marking | `46D8F7160EAA98AEB18B54BF28FE9700477242E429F93F32738275C1953EB527` |

### Propeller-report anomalies and verification tasks

- The folders appear transposed: the `CE-EMC` folder contains the FCC report/certificate, while the `FCC` folder contains the CE EMC report/attestation. Internal document IDs and actual content, not folder names, control this review.
- The `DSP25120665...` filenames contain reports whose internal IDs begin `SSP25120665...`.
- `XS-192A` coverage relies on a manufacturer series declaration. Obtain the exact model-difference table and confirm whether the production drive unit is `XS-191A`, `XS-192A` or something else.
- The EMC/FCC tests occurred in April 2025, but the reports were issued in December 2025. Obtain issuer verification, sample photographs, serial/batch identifiers, application records and a reason for the interval.
- Verify each laboratory, certificate/report number, accreditation scope and unaltered original directly with the issuer. This review does not allege that any document is invalid; it records unresolved provenance and applicability.
- A CE mark, voluntary attestation or US FCC result does not establish Australian electrical, EMC, radio, product-safety or responsible-supplier compliance.

## Battery and transport evidence matrix

Across the battery documents, the described pack is attributed to **Shenzhen Ju Peng Yuan Electronic Technology Co., Ltd.** and uses the generic model designation `18650`. The stated configuration is three 3.7 V, 2600 mAh 18650 cells in series (`3S`), nominally `11.1 V`, `2600 mAh` and `28.86 Wh`; reported dimensions are approximately `67.9 × 55.2 × 19.1 mm`, mass approximately `143.6 g`, maximum discharge current `2.6 A`, and charge voltage `12.6 V`. These are evidence-document facts about the described pack, not approved DC-02 claims.

| Received file / internal reference | Issued / validity | Configuration and scope | Preliminary finding | SHA-256 |
| --- | --- | --- | --- | --- |
| NRCC maritime report `251128760617-22` | Issued 26 Nov 2025; effective 1 Jan 2026; expires 31 Dec 2026 | 60 battery packs per carton; special provision `SP188` | Time-limited maritime transport assessment for the tested standalone-battery carton, not the two-battery DC-02 retail package | `8348B1D8B69BAD36397AA7584659F2FFEEDD462822108258523FD1A7CD3C47C2` |
| NRCC MSDS `251128760617-29` | Issued 26 Nov 2025 | Generic `18650` lithium-ion battery information | General battery safety/data record; does not establish exact delivered-pack identity, final product safety or carrier acceptance | `34D9C826002F2180B44A2EBC443E7EC8DE6335535D11409D28E6D18B9AA77F70` |
| Beijing DGM air report `PEKGZ202512276423GA600001`; item `PEKGZ202512276423` | Valid for 2026 | `UN3480`, Packing Instruction `PI965` Section IB, cargo aircraft only, state of charge not above 30% | Air assessment is for standalone batteries, not batteries packed with or contained in the lounger | `B7F71D4BFBD5C1FA67C49F9BEF1B20659A96A0464F90F922150A2FCE61222CDE` |
| NCJC stacking report `NCJC250461247-0003` | Issued 24 Dec 2025 | 60-pack, 10 kg cartons; 240 kg applied for 24 h | Carton stack test marked PASS for the tested bulk-battery package; final notice incorrectly names `NRCC` and `nrccsafety.com` instead of NCJC, requiring corrected issuer confirmation | `3FAFB0F180ADBE308DDBAE5CE068AD9D558F348E94C3148E2E4AC2BCCEC4927B` |
| TCT UN 38.3 report `TCT211101B005` | Tested 1–19 Nov 2021; issued 22 Nov 2021 | UN Manual of Tests and Criteria, Revision 7; T1–T8 for a generic-model `18650` pack | Tests are recorded as PASS, but exact production-pack continuity, a current test summary and current-revision acceptance remain unverified | `61DA1B177D18BCF4744129C75260BCB0AD4397042B74DD3D6EA29D3BF0924F00` |
| TCT 1.2 m drop report `TCT241125D147` | Tested 8–10 Dec 2024; issued 10 Dec 2024 | 60 battery packs in the tested carton | Package drop test marked PASS for the bulk standalone-battery carton; not a test of the lounger retail shipment | `16CD6D323F934D4AD5F6A61CBD18372283267476D7F593388C9947178D67A01E` |

### Battery transport assessment

The user/supplier intends to include two packs, which would total `57.72 Wh` nominal if both packs are exactly the documented `28.86 Wh` type. That arithmetic is useful for internal reconciliation only; it does not prove runtime, output, safety, pack matching or shipper acceptance.

The received air evidence classifies **standalone batteries** as `UN3480` under `PI965` Section IB and cargo-aircraft-only conditions. A customer shipment containing a lounger and two batteries would instead need a dangerous-goods specialist and the selected carrier to determine the actual `UN3481` configuration—batteries **packed with** equipment (`PI966`) or **contained in** equipment (`PI967`)—from the final packaging arrangement. The supplied 60-pack carton stack/drop records do not test that retail arrangement.

Before any shipping profile is enabled, obtain:

1. A unique battery-pack model/part number, production drawings, cell manufacturer/model, protection-board/BMS specification, batch/lot traceability and evidence that the production pack is unchanged from the UN 38.3 sample.
2. The manufacturer-issued UN 38.3 test summary and written laboratory/carrier confirmation that the 2021 Revision 7 result remains acceptable for the unchanged battery type under current requirements.
3. An electrical architecture showing whether one pack powers each motor, whether packs operate concurrently, actual normal/stall current, over-current protection, fusing, connector ratings and isolation.
4. A final dangerous-goods classification, marks/labels, state-of-charge rules, cushioning/terminal protection, retail package design, documentation and written acceptance from every proposed carrier/service and route.
5. Final packed product dimensions and weight, including the lounger, two batteries, charger/cable, pump, manual and protective packaging.

The `2.6 A` maximum discharge stated for one `11.1 V` pack corresponds to about `28.86 W`. This makes the claimed `46 W` architecture ambiguous: Docked needs to know whether `46 W` is total system power, per motor, input or output, and how each pack is loaded, including motor start/stall current. Do not infer adequacy from nominal watt-hours.

Current primary guidance to apply during the specialist review includes the [IATA 2026 lithium-battery guidance document](https://www.iata.org/contentassets/05e6d8742b0047259bf3a700bc9d42b9/lithium-battery-guidance-document.pdf), Australia Post's [dangerous and prohibited items guidance](https://auspost.com.au/business/shipping/shipping-guidelines/dangerous-prohibited-items) and its [business dangerous-goods shipment requirements](https://auspost.com.au/business/parcel-send-help-and-support/shipments/sending-dangerous-goods). These sources do not constitute carrier acceptance for DC-02.

## Exact applicability boundary

| Evidence can support internal review of | Evidence does **not** establish |
| --- | --- |
| The existence and stated scope of the identified propeller reports for `XS-191A` and declared series model `XS-192A` | The identity, safety or compliance of the complete inflatable lounger or a Docked production SKU |
| The stated CE EMC, FCC Part 15B and RoHS outcomes for the tested/referenced propeller samples/components | Australian EESS/RCM, ACMA, general product-safety, aquatic-product, electrical or radio compliance for the final sale configuration |
| The reported properties and transport-test history of a generic-model 3S `18650` pack | That either of the two delivered packs is the same design, current production type, safe in this product, correctly charged or accepted by a carrier |
| A 60-pack standalone-battery carton assessed under specified transport conditions | The final two-battery `UN3481` retail package, its classification, marks, labels, handling, sea/road/air eligibility or acceptance |
| Visual mood and merchandising exploration in four AI-generated images | Exact-SKU appearance, features, dimensions, controller layout, motor count, cup-holder count, load, performance, safety or included items |

The following complete-product areas remain outside every supplied report: inflatable body materials and seams; valves and pressure; buoyancy, stability and air-loss behaviour; boarding/exiting; occupancy and load; motor guards and hair/finger/clothing entanglement; stop/fail-safe behaviour; turning/stopping distance; whole-system current and thermal behaviour; battery enclosure and water ingress; charging interlocks; wet-environment use; complete-product EMC; final labels and warnings; instruction manual; production quality control; Australian recall traceability; complimentary pump; charger/power supply; Type-C cable and charging protocol; final retail packaging; and carrier acceptance.

## Claim reconciliation and publication controls

| Claim or supplied statement | Conflict / evidence gap | Decision |
| --- | --- | --- |
| `30 min` battery life | Separate supplied concept imagery states `90-minute runtime`; no complete-product runtime test, operating mode, user mass or acceptance criterion | Block both figures |
| `90-minute runtime` | Appears in AI concept artwork; two documented packs total 57.72 Wh nominal. At a hypothetical 46 W total draw the loss-free arithmetic is about 75 minutes, not a test; real losses and duty cycle are unknown | Block |
| `46 W` power | Separate concept artwork states `66 W Dual Motors`; unclear whether 46 W is total, per motor, input or output | Block both figures |
| `1.6 m/s` speed | Converts arithmetically to `5.76 km/h`, while supplied artwork states “up to 5 kph”; test method and whether the figure applies to the drive module or complete occupied chair are unknown | Block both figures |
| `160 kg` capacity | Supplier expressly has not supplied a 160 kg load/weight-bearing test; “strong and stable” and “safe” language compounds the unsupported safety implication | Block the number and related safety/strength claims |
| Two lithium batteries included | Component list separately says singular “battery”; reports identify a generic pack but not two serialized production packs or their installed/packed arrangement | Treat only as intended bill of materials; do not publish |
| Complimentary air pump | No pump make, model, ratings, manual, electrical dossier, RCM basis, images or included-item verification | Block; review as a separate supplied component |
| Type-C cable / Type-C charging port | Battery records state a 12.6 V charge voltage, while a propeller test arrangement mentions USB 5 V; no final USB-C protocol, charger, Australian power supply, cable rating or safe-charge chain is established | Block |
| `167 × 109 × 60 cm` | Described as lounger dimensions, while `157 × 195 × 460 mm` describes a control/propulsion body; neither is tied to a final measured production sample | Keep both internal and distinctly labelled; publish neither |
| `1.8 kg` | Object measured is unclear and is implausibly treated as complete packed weight without sample evidence | Block |
| One-person occupancy, dual joystick, cup holders, water jets, rotating control and included six-item kit | Supplied descriptions and AI renders are internally inconsistent in geometry, cup-holder count, drive language and included battery count | Block pending exact sample and signed bill-of-materials reconciliation |

No derived conversion or engineering calculation in this review is a product test or an approved marketing statement.

## AI concept-image review

All four received PNGs are `1254 × 1254`, RGB images without camera EXIF. Each contains a 24,910-byte `caBX`/C2PA manifest identifying `gpt-image v2.0`, the OpenAI Media Service API, `trainedAlgorithmicMedia`, and a creation date of 14 August 2026.

| Image | SHA-256 | Observed issue | Use decision |
| --- | --- | --- | --- |
| `ChatGPT Image Aug 14, 2026, 02_15_47 PM.png` | `486DBD184F386B1472AEE77B36CF11C4BB826B48FCB5647139A1DC1462F2EC3E` | AI concept render; product/control/cup-holder geometry is not verified | Internal moodboard only; do not publish |
| `ChatGPT Image Aug 14, 2026, 02_32_27 PM.png` | `C6B9CDC55D7A5921313EA4F28EF33A00E3FFB58F972ECEED698B5B0D04E73E86` | AI concept render containing unsupported feature, runtime, capacity and safety language | Internal moodboard only; do not publish |
| `Girl on Float.png` | `CAE11BD49147FE0DE4D49900B7CBBD55AD18CCD4F161EDDB9031F19C430E01AE` | Synthetic adult lifestyle scene; exact product, safe-use depiction and publication rights are not established | Internal moodboard only; do not publish |
| `Man on Float.png` | `DEAE3AEE4B7530E07BD47E9DB45B2C454EBB2E686E631722019F56BA28198CA9` | Synthetic adult lifestyle scene stating `46W`; conflicts with separate `66W` artwork and is not documentary evidence | Internal moodboard only; do not publish |

The images must not be presented as photographs of the product for sale, supplier photography, evidence of product features or proof of safe use. Exact-SKU production photography/video requires written permission or licence, a rights-holder record, final-model visual matching, an adult-only/safe-use review and approved alt text. The absence of children in these four images does not cure their product-accuracy or rights gaps.

## Facts accepted for internal handling only

The following may be recorded in the controlled evidence dossier, with their qualifications, but are **not** approved storefront claims:

- The listed archives and files were received with the hashes recorded above.
- Hunan Xinsheng Intelligent Technology Co., Ltd. is named as applicant/manufacturer in the propeller records.
- The propeller records principally identify model `XS-191A`, with `XS-192A` included as a declared series model.
- The component reports record the outcomes and dates shown in their own stated test scopes.
- Shenzhen Ju Peng Yuan Electronic Technology Co., Ltd. is named for the generic-model `18650` battery pack described in the battery records.
- The documented pack is stated as 3S, 11.1 V, 2600 mAh and 28.86 Wh, subject to exact-pack identity and production-continuity verification.
- Two such packs would total 57.72 Wh nominal by arithmetic only.
- Twenty units is an intended purchase quantity, not evidence of ordered, received, inspected or available stock.
- The supplier's statements about two batteries, accessories, a complimentary air pump and sample availability are leads for verification, not accepted product facts.

## Approved storefront claims

**None.** There are zero approved physical-product claims arising from this evidence pack.

The supplier documents may not be converted into badges or statements such as “CE certified,” “FCC certified,” “RoHS certified,” “Australian certified,” “compliant,” “safe,” “tested,” “airline approved,” “carrier approved” or “RCM approved” for DC-02. Do not show certification logos or payment-driving compliance claims without an exact lawful basis and final approval.

Australian work must start with an exact-product classification and evidence plan. Relevant primary references include the ACCC/Product Safety Australia [aquatic toys mandatory standard](https://www.productsafety.gov.au/business/search-mandatory-standards/aquatic-toys-mandatory-standard), EESS guidance on [selling electrical equipment in Australia](https://www.eess.gov.au/equipment/selling-electrical-equipment-in-australia/), the [steps for EESS compliance](https://www.eess.gov.au/equipment/selling-electrical-equipment-in-australia/steps-for-compliance-with-eess/), [RCM marking](https://www.eess.gov.au/rcm/marking-of-electrical-equipment/) and [lithium-ion battery equipment safety](https://www.eess.gov.au/wp-content/uploads/2026/06/General-Safety-tips-for-Lithium-ion-battery-powered-equipment-v1.0.pdf), plus ACMA's [product-labelling step](https://www.acma.gov.au/step-5-label-your-product). Applicability and the required conformity path must be decided for the exact final product by competent Australian reviewers.

## Evidence required before reconsidering Draft status

1. **Supplier and manufacturer identity:** legal names, addresses, registrations, authorised contacts, the dropship seller's relationship to both named manufacturers, commercial invoice/purchase agreement, warranty and recall escalation.
2. **Frozen exact configuration:** manufacturer model, Docked SKU, barcode, variant, engineering drawings, signed bill of materials, component part numbers, firmware, motor count, controller architecture, battery count, charger/cable, pump, packaging and change-control process.
3. **Production sample:** one complete sale-ready sample from the intended production batch, plus spare destructive-test samples, containing the exact lounger, both propulsion/control units, two batteries, charging chain, pump, manual, labels and retail packaging.
4. **Document-to-sample match:** issuer-verified originals, laboratory accreditation/scope, report-number verification, clear sample photographs and serial/batch mapping for every report; exact explanation of `XS-191A` versus `XS-192A` and the file/folder inconsistencies.
5. **Claim test plan:** signed manufacturer specification and competent independent testing for system power, runtime, charge time, speed, thrust, turning/stopping, occupancy and every intended feature. Methods, conditions, tolerances and worst-case user/load state must be recorded.
6. **Load and aquatic safety:** independent complete-product evidence before any `160 kg` claim, plus classification-led testing of buoyancy, stability, freeboard, seams, valves, inflation pressure, air loss, boarding/exiting, foreseeable misuse and permanent warnings.
7. **Propulsion hazards:** guards/intakes, finger/hair/clothing entanglement, obstruction response, emergency stop/fail-safe behaviour, start-up protection, control-direction indication and safe recovery testing.
8. **Water/electrical safety:** complete-system ingress and wet-use assessment; battery-compartment sealing; dry-charge interlock/instructions; insulation, temperatures, abnormal/stall conditions, connectors, fusing, BMS and safe charging/storage evidence.
9. **Australian regulatory determinations:** written aquatic-toy/flotation/PFD classification; EESS in-scope/risk-level and responsible-supplier decision for each item; lawful RCM compliance folder/registration/marking basis; ACMA EMC/radio decision if any transmitter/receiver exists; required general product-safety assessment.
10. **Battery dossier and transport approval:** the exact pack identity, current UN 38.3 test summary and continuity evidence, full electrical/safety dossier, final `UN3481` packaging classification/tests, marks/documents and written carrier acceptance for every service. Keep international and unaccepted express services disabled.
11. **Charger and Type-C chain:** exact charger/power-supply and cable models, Australian plug, input/output ratings, USB-C protocol, applicable registration/certification/RCM basis, instructions and proof that the final chain safely charges the exact pack.
12. **Complimentary pump:** exact make/model, ratings, power source, manual, warnings, Australian compliance/classification evidence, inclusion confirmation and product-liability review. A free gift remains a supplied consumer product.
13. **Manual, labels and packaging:** final English manual; adults-18+ positioning; pool/environment limits; no-PFD/no-life-saving warning where approved; capacity; battery/charging/fire/water/entanglement warnings; suffocation warning; disposal; importer/responsible-supplier identity; traceable batch coding; permanence and consistency review.
14. **Commercial and logistics proof:** approved landed cost and GST-inclusive price, physically counted stock, overselling disabled, packed measurements, dispatch location, handling time, Australian carrier/rates, regional and remote-area tests, returns/warranty terms and product-liability-insurance confirmation.
15. **Licensed exact-product media:** unedited production photos and video of the exact sale SKU and included items, source/rights-holder permission, licence scope/date/restrictions, safe-use review and a visual reconciliation against the sample.
16. **Final approvals:** compliance, legal, dangerous-goods/carrier, insurer and owner sign-off; reconciled claim register; Shopify preview QA; shipping/GST/payment test orders and refund test. Only then may the owner consider activating the SKU.

## Gate disposition

| Gate | Status after this review | Reason |
| --- | --- | --- |
| Approved products available | **Blocked** | No final SKU/sample, claim set, inventory or owner activation approval |
| Licensed product media available | **Blocked** | Supplied PNGs are AI concepts, not licensed exact-SKU documentary media |
| Product compliance approved | **Blocked** | Evidence is component-limited and exact complete-product/Australian requirements remain unresolved |
| Inventory approved | **Blocked** | Intended quantity of 20 is not stock evidence |
| Shipping approved | **Blocked** | Final `UN3481` configuration, retail packaging and carrier acceptance are missing |
| Product liability insurance reviewed | **Blocked** | No insurer confirmation for the exact product and included components |
| Final prices approved | **Blocked** | No complete landed-cost model or owner price approval |

Receiving documents is progress, not passage of a launch gate. Any future gate change requires actual evidence, named review, review date and an auditable decision for the final production SKU.
