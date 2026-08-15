# Docked returns, refunds and warranty workflow

Status: **DRAFT OPERATING PROCESS — POLICY TERMS AND RETURNS SERVICE NOT APPROVED**  
Last updated: 13 August 2026

Customers must contact `support@docked.com.au` before sending an item. That mailbox is owner-supplied but not yet operationally verified. The Heidelberg Heights address is for **correspondence and authorised returns only. No public showroom or walk-in service.** Do not instruct a customer to return there until Docked has issued exact written authorisation and a safe accepted transport method.

> Our goods come with guarantees that cannot be excluded under the Australian Consumer Law.

This workflow does not set an unapproved change-of-mind window, fee or express warranty period, and it does not limit Australian Consumer Law (ACL) rights. The ACCC states that a seller must provide an applicable remedy rather than directing the consumer only to the manufacturer; the remedy depends on whether a problem is major or minor. See [ACCC repair, replace, refund](https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought/repair-replace-refund-cancel).

## Intake and triage

1. Verify the customer and Shopify order using proportionate information: order number, purchaser/contact, affected item/variant, date received and concise issue description.
2. Create/record the case on the Shopify order or approved support system. Do not put customer data in Git.
3. Ask only for useful, safe evidence: photos/video of packaging/product/labels, batch/serial, observed symptoms, use/setup/charging circumstances and requested outcome. Do not require original packaging as a condition of an ACL claim.
4. Classify the case without prejudging it:
   - change of mind;
   - transit damage;
   - incorrect/missing item;
   - possible minor defect;
   - possible major defect;
   - warranty/express-warranty claim;
   - misuse/accidental damage or normal wear question;
   - battery, charger, motor, PVC puncture/leak or other component issue;
   - safety complaint/near miss/injury; or
   - lost/returned-to-sender delivery.
5. Ask the safety questions first: Is anyone injured? Is the product/battery hot, swollen, wet, leaking, smoking, odorous, damaged or behaving abnormally? Has it been isolated from use/charging?
6. For any safety signal, instruct the customer to stop use/charging and follow emergency services/manufacturer-approved isolation guidance appropriate to the actual situation. Immediately alert the safety lead; do not issue a routine postal label for a damaged or suspect battery.

## Decision paths

### Change of mind

Apply only the final published owner/adviser-approved policy. Record request date, product condition, opened/used status and included items. Do not promise eligibility, return postage, restocking fee or deadline until those terms are approved. Change-of-mind rules must not be applied to deny a valid ACL problem claim.

### Incorrect item or transit damage

Verify the shipment/pick record and safely gather evidence. Offer the approved correction/remedy promptly. Run any carrier/supplier claim separately; do not make the customer wait for Docked's commercial recovery where Docked must act. Escalate a pattern or safety-relevant damage to inventory quarantine.

### Possible product problem

Docked may reasonably assess the product, but must keep the customer informed of method and timing. For a major problem, the ACCC describes the consumer's choice of refund or replacement; for a minor problem, the business must provide a free fix within a reasonable time, with further remedies if it cannot. Seek legal guidance for uncertain facts rather than using a broad exclusion.

### Misuse, accidental damage and wear

Assess evidence fairly against the approved instructions and product condition. Customer conduct may be relevant, but a label such as “misuse” is not a reason to bypass ACL analysis or ignore an underlying safety/quality defect.

### Express warranty

Apply the final published promise without reducing ACL rights. Keep `custom.warranty_period` blank until owner/adviser approval. Do not require the customer to deal only with a manufacturer.

## Return authorisation

Before issuing an authorisation, record:

- return/case number and Shopify order/line;
- reason category and provisional remedy path;
- exact item/SKU/batch/serial/components expected;
- whether the product contains a battery or dangerous/restricted material and its current condition;
- approved return carrier/service, packaging, labels, payer and destination;
- customer instructions, dispatch deadline if lawfully applicable and tracking requirement; and
- named owner/reviewer.

Never ask a customer to mail a recalled, damaged, swollen, wet, leaking, hot or otherwise suspect battery through ordinary post. Obtain exact carrier/specialist instructions and consider collection or local hazardous-waste/safety handling as legally and operationally appropriate. Australia Post prohibits some damaged/non-conforming batteries and applies special conditions to permitted lithium batteries; verify the current contracted service rather than assuming acceptance.

## Receiving and inspection

1. Match the return authorisation, parcel and batch/serial; photograph external damage under the approved privacy policy.
2. Isolate battery/electrical/safety complaints and recalled/suspect items in the designated quarantine area before opening/handling.
3. Inspect using a product-specific safe procedure: identity, completeness, labels/manual, packaging, visible damage, contamination/moisture, valve/seam/chamber, motor/guard/control, battery/charger and reported symptom as applicable.
4. Do not power, charge, inflate, pressure-test or immerse a returned item unless a trained operator and approved procedure permit it.
5. Record findings factually. Preserve the unit/evidence where insurer, regulator, supplier, lab or legal review may be required.
6. Decide disposition: return to sale (only if expressly approved safe/hygienic/complete), refurbish/repair under approved control, supplier/lab assessment, quarantine, recycle/dispose through an approved route, or recall evidence hold.

## Shopify return and money flow

Use Shopify's native return/exchange and refund records so order, inventory and customer communication reconcile. Shopify documents return states including requested, in progress, returned and inspection complete; available steps depend on store configuration. See [Shopify returns](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/creating-returns).

- Create the correct return against exact lines/quantities and record reason.
- Restock only to the correct location after the inspection decision; never restock automatically on label creation.
- Issue the approved refund to the original payment method unless an approved lawful alternative applies; confirm items, shipping, discount, tax and notification.
- For an exchange/replacement, preserve links to the original order/case and both batch/serial records.
- Reconcile full/partial refund and shipping refund to GST and Tax Invoice/adjustment outputs.
- Record settlement status; do not state a bank settlement time as guaranteed.

The ACCC notes that if a product is confirmed to have a problem, reasonable return costs already paid may need reimbursement, and large/heavy items can place collection/shipping responsibility on the business. Do not impose inappropriate inspection, restocking or return fees on a valid ACL claim.

## Safety and trend escalation

Immediately notify the safety lead for injury/illness, drowning/entrapment/entanglement, overheating/fire/smoke, electric shock, battery swelling/leak/water ingress, motor/guard failure, loss of stability/buoyancy, label/manual mismatch, repeat seam/valve failure or any foreseeable serious hazard.

- Stop sale/fulfilment and quarantine affected stock when warranted.
- Identify exact SKU/revision/batch and all related orders.
- Preserve evidence and notify insurer, supplier and advisers through [Product recall plan](PRODUCT_RECALL_PLAN.md).
- Assess the ACCC two-day mandatory reporting and recall-notification duties immediately; do not wait for a complete investigation when a fixed deadline applies.

## Case close-out

- [ ] Customer received a clear written outcome and remedy/status.
- [ ] Shopify payment, refund/exchange, inventory and Tax Invoice records reconcile.
- [ ] Return freight/carrier claim and supplier recovery are tracked separately.
- [ ] Batch/SKU defect and reason codes feed monthly trend review.
- [ ] Safety, insurer, regulator or recall actions are complete or have named open owners.
- [ ] Personal data/evidence follows approved retention/access/deletion rules.
- [ ] Case closure does not destroy evidence needed for a complaint, chargeback, safety investigation or recall.

## Pre-launch tests

Run change-of-mind request, incorrect item, transit damage, minor defect, major defect, warranty claim, accidental damage, normal wear, PVC puncture, motor failure, battery abnormality, safety complaint, return-to-sender, large-item collection, full refund, partial refund and exchange/replacement. Verify return rules/self-serve settings do not publish an unapproved window/fee or weaken ACL rights. No test has yet been run.

