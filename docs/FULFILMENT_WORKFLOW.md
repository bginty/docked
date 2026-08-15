# Docked fulfilment workflow

Status: **PRE-LAUNCH RUNBOOK — LOCATION, PACKAGING, CARRIER AND STOCK NOT APPROVED**  
Last updated: 13 August 2026

Fulfil only a released Shopify order through an approved location and carrier/service. Shopify inventory is the operational source of truth. The physical SKU, variant, batch/lot, components and packaging must match the approved product record; no substitute is permitted without a new customer/compliance decision.

## 1. Release gate

The order operator must confirm:

- payment is in the approved fulfilment state and fraud review has cleared;
- delivery address and selected service are accepted;
- inventory is allocated at the correct location and overselling/preorder is not involved;
- product/SKU/revision is Active and not subject to compliance, quality, recall or stop-sale hold;
- exact battery configuration is accepted by the contracted carrier/service; and
- Shopify line/variant, actual pick location and packing instructions agree.

If any condition fails, place/retain a fulfilment hold and escalate. Never solve a mismatch by selecting a “similar” unit.

## 2. Pick

1. Scan or verify order, SKU, variant/options, quantity and storage location.
2. Record manufacturer batch/lot/serial for every traceable unit against the Shopify order or approved linked system. The record must support order-to-batch and batch-to-order lookup.
3. Check seals, retail packaging, labels, permanent warnings, approved English manual and included components against the controlled packing specification.
4. Check product/battery/charger/repair-kit/storage condition without unsafe activation or destructive opening. Quarantine any wet, swollen, hot, leaking, odorous, punctured, crushed, opened, unlabelled, superseded or otherwise abnormal item.
5. Move picked inventory through the approved Shopify/location workflow; do not create negative or fictional stock.

## 3. Quality-control hold points

| Hold point | Pass condition |
| --- | --- |
| Identity | Product, SKU, variant, revision and barcode match order and approval record |
| Traceability | Batch/lot/serial captured and legible |
| Product condition | No visible defect/damage/leak; all chambers/components/attachments appear intact under the approved non-destructive check |
| Labels/manual | Required labels/warnings and correct manual revision present and unobscured |
| Contents | Approved included-items checklist passes; charger/battery/pump model matches exact SKU |
| Battery/electrical | No abnormal state; terminals/protection and accidental-activation controls match approved pack |
| Media/marketing inserts | Only approved current copy; no unsupported claim or expired promotion |

An operator initials each hold point in the approved fulfilment record. A failed point triggers quarantine, inventory adjustment after investigation, and defect escalation; do not quietly pick another unit without recording the defect.

## 4. Pack

- Use the validated package/carton, cushioning, moisture/impact protection, closure and orientation for the exact SKU.
- Protect valves, controls, guards, connectors and included items from compression/movement.
- For batteries, use only the packaging, terminal protection, accidental-activation prevention, marks/labels and documents accepted for the exact carrier/service. Do not infer permission from another battery or route.
- Never ship a recalled, damaged, wet, swollen, defective or non-conforming battery through an ordinary label workflow. Isolate safely and obtain specialist/carrier instruction.
- Include the approved packing slip and automatic Tax Invoice access/instructions; avoid exposing price on outer packaging unless required.
- Apply the carrier label to the correct carton without covering product/dangerous-goods/handling labels. Verify name/address/postcode, service and carton count.
- Photograph or retain other packing evidence only under an approved privacy/retention policy; keep customer addresses out of this repository.

## 5. Handoff and Shopify fulfilment

1. Manifest/scan the parcel with the contracted carrier and retain acceptance evidence.
2. In Shopify, fulfil the exact lines and quantities, enter the real carrier/tracking number and send the approved notification. Shopify's [fulfilment guidance](https://help.shopify.com/en/manual/fulfillment/fulfilling-orders) supports individual, bulk and batch workflows; configure the method to preserve Docked's hold points.
3. Do not mark an item fulfilled on label creation alone if it has not passed QC and entered the carrier handoff workflow.
4. For split fulfilments, identify the exact lines/cartons and tell the customer what remains outstanding without promising an unverified date.
5. Reconcile manifest parcel count, Shopify fulfilled lines, tracking, inventory deduction and carrier charges at shift end.

## 6. Exceptions

- **Wrong/damaged pick:** quarantine and record; re-pick only after defect/inventory entry.
- **Inventory discrepancy:** stop, recount and alert order operator; do not fulfil or oversell.
- **Label/address mismatch:** void/recreate before handoff; never alter a label manually.
- **Carrier refusal:** retain parcel safely, record reason, disable affected service/SKU if systemic and contact the customer through order operations.
- **Missed handoff:** keep unshipped status truthful; update customer if approved dispatch expectation is affected.
- **Return to sender:** receive as a return, inspect before any restock, verify address/contact and agree reship/refund under [Returns workflow](RETURNS_WORKFLOW.md).
- **Safety/recall notice after pick:** stop parcel before handoff where possible; identify all affected staged/in-transit orders and invoke [Product recall plan](PRODUCT_RECALL_PLAN.md).

## 7. Inventory and batch control

- Receive stock only against an approved purchase/SKU/revision and supplier lot record.
- Quarantine pending-QC, returned, damaged, suspect and recalled units in distinct non-sellable states/locations.
- Complete cycle counts and investigate variance; Shopify quantity must reflect saleable physical units, not ordered or quarantined units.
- Restock a return only after inspection confirms it is lawful, safe, complete, hygienic and saleable under the approved decision. Aquatic/inflatable/electrical items may require a no-restock rule depending on condition and final policy.
- Retain order-to-batch records for the approved legal/product-life period and test both lookup directions in the recall tabletop.

## Validation record

| Test | Status | Evidence / reviewer / date |
| --- | --- | --- |
| Location and staff access configured | Not verified |  |
| Final pick/pack/QC specification approved per SKU | Blocked | No final SKU/supplier package |
| Packaging trial and carrier acceptance | Blocked |  |
| Batch/serial capture and reverse lookup | Not tested |  |
| Standard, split and mixed-profile test orders | Not tested |  |
| Battery hold/refusal scenario | Not tested |  |
| Inventory discrepancy/quarantine flow | Not tested |  |
| Tracking notification and reconciliation | Not tested |  |

