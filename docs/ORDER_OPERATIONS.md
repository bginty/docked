# Docked order operations

Status: **PRE-LAUNCH RUNBOOK — NO LIVE ORDERS AUTHORISED**  
Last updated: 13 August 2026

Shopify is the source of truth for order, payment, fulfilment, refund and return status. This runbook must be tested with Shopify test orders before live capture. Customer/order data, identity documents, fraud evidence and payment details must not be copied into Git.

## Roles and access

Assign named people before launch; use least-privilege Shopify roles and individual accounts with strong authentication.

| Role | Responsibilities | Must not do without escalation |
| --- | --- | --- |
| Order operator | Queue review, address/service check, release to fulfilment, customer updates | Override payment/fraud/safety hold; expose customer data |
| Fulfilment operator | Pick, batch/lot capture, QC, pack, carrier handoff and tracking | Substitute model/component; ship restricted battery without approved service |
| Customer support | Order queries, cancellations, return intake, delivery exceptions | Promise unapproved remedy/timeframe; direct an unsafe battery into ordinary mail |
| Finance/owner | Capture/refund permissions, reconciliation, chargebacks, GST/tax-invoice oversight | Use real payment for testing without explicit authority |
| Safety lead | Incident triage, stop-sale/quarantine, regulatory/insurer/supplier escalation | Delay a statutory escalation while facts are being gathered |

## Daily order queue

1. Work from Shopify **Orders** and saved views; never from an emailed card/customer-data export.
2. Confirm the order number, timestamp, channel, customer/contact, delivery address, currency AUD, line/variant/SKU, quantity, discount, tax, shipping, total and notes.
3. Confirm payment state. Do not fulfil `Pending`, `Failed`, `Voided`, `Expired` or otherwise unpaid orders. If authorisation/manual capture is later approved, document the capture deadline and named capture owner; do not capture after cancellation.
4. Review Shopify fraud analysis and available verification signals. High-risk orders go on hold for an authorised decision; do not use discriminatory assumptions or ask for excessive identity data. Fraud tooling informs rather than guarantees a decision.
5. Check stock allocation at the correct location, product release status, batch/lot availability, shipping eligibility, address/service and any safety/recall hold.
6. Resolve discrepancies in the Shopify timeline using minimal factual notes. Never write full payment credentials or unnecessary sensitive personal information.
7. Release an eligible order to [Fulfilment workflow](FULFILMENT_WORKFLOW.md). Keep a hold reason visible for every blocked order.
8. Verify automatic **Tax Invoice** delivery and details under [GST and tax-invoice QA](GST_AND_TAX_INVOICE_QA.md).

Shopify's [order-management guidance](https://help.shopify.com/en/manual/fulfillment/managing-orders) covers payment, fraud, fulfilment, return and refund controls; the configured store, permissions and payment terms determine the exact available actions.

## Status rules

| Condition | Operational action |
| --- | --- |
| Paid/approved payment, low-risk/cleared, stock and shipping eligible | Release to fulfilment |
| Payment pending/failed or manual review required | Hold; send only an approved factual request/update |
| High-risk or inconsistent address/order | Hold for authorised fraud review; record outcome |
| Out of stock or inventory discrepancy | Hold, investigate, contact customer with truthful options; never substitute silently |
| Product safety/compliance/recall concern | Immediate stop-fulfilment and quarantine; alert safety lead; follow [Product recall plan](PRODUCT_RECALL_PLAN.md) |
| Battery/service not accepted | Do not ship; identify approved alternative or resolve order with customer |
| Customer cancellation before fulfilment | Verify identity/order, cancel in Shopify, void/refund as appropriate, restock only if stock was genuinely reserved and saleable |
| Address change request | Verify through an approved channel before fulfilment; assess fraud/carrier implications; record change in Shopify |

## Customer communications

- Use `support@docked.com.au` only after mailbox, reply path and sender authentication pass. Until then, live orders remain blocked.
- Use approved Shopify notifications for order confirmation, fulfilment/tracking, cancellation and refund; proofread every template with legal seller/support details.
- Never email payment credentials, identity documents, sensitive fraud rules or another customer's information.
- State facts: current status, action taken, next review point and customer choices. Do not guarantee carrier delivery, stock arrival, refund settlement or warranty outcome before confirmation.
- Record material customer contacts in the Shopify timeline or approved customer-service record.

## Exceptions

### Cancellation

Before fulfilment, confirm whether payment is authorised/captured and whether work/label/carrier handoff occurred. Cancel the correct lines/order in Shopify, void/refund through the original payment path as appropriate, decide notification/restock deliberately, and record reason. If already handed to carrier, treat as intercept/return and do not promise success.

### Refund

Use the Shopify order's refund action and original payment method unless an approved exception/law requires otherwise. Verify items, quantity, shipping, discount/tax allocation, reason, restock choice and notification before submission. A refund may be irreversible and settlement timing is provider-dependent. Reconcile full and partial refunds to the Tax Invoice/credit documentation process.

### Replacement

Create a traceable replacement/exchange against the original case/order using the approved Shopify workflow. Record the returned unit's batch/serial and replacement unit's batch/serial, shipping cost decision, inventory movement and customer notification. Do not hide repeat defects as goodwill replacements; trend them by SKU/batch.

### Damaged delivery / incorrect item

Open a case, collect proportionate photos/details when safe, preserve packaging/batch evidence, and assess customer remedy separately from the carrier claim. Do not make the customer wait for carrier reimbursement where Docked has a legal obligation. Quarantine returned/related stock if damage indicates a product-safety or packing issue.

### Lost or delayed parcel

Check tracking and address, open the contracted carrier investigation promptly, give the customer factual updates, and follow the approved replacement/refund decision. Never mark a parcel delivered solely because a carrier scan says so when credible contrary evidence exists; investigate.

### Warranty / product problem

Use [Returns workflow](RETURNS_WORKFLOW.md). Separate major/minor defect, transit damage, misuse/accidental damage, normal wear, battery, motor, PVC puncture and safety complaint. Docked must not direct the customer to deal only with the manufacturer.

### Safety incident

Stop routine handling and notify the safety lead immediately. Preserve the customer's account, exact product/SKU/batch, photos, symptoms/injury and timeline without pressuring or making admissions. The ACCC states suppliers must report certain product-associated deaths, serious injuries or illnesses within two days of becoming aware; doubt is a reason for prompt specialist assessment, not delay. See [Product Safety mandatory reporting](https://www.productsafety.gov.au/business/make-a-mandatory-report) and [Product recall plan](PRODUCT_RECALL_PLAN.md).

## End-of-day reconciliation

- [ ] Every paid eligible order is released or has a documented hold.
- [ ] No unfulfilled order is marked fulfilled merely because a label was created.
- [ ] Carrier handoffs, tracking and customer notifications reconcile to Shopify.
- [ ] Inventory movements, cancellations, returns, refunds and replacements reconcile by SKU/location.
- [ ] Payment captures/refunds and Shopify totals reconcile to the provider and accounting handoff.
- [ ] Tax Invoices/adjustments are generated and accessible.
- [ ] Aged orders, exceptions, chargebacks and safety complaints have named owners and next actions.
- [ ] Operational metrics exclude test orders and identify cancellations/refunds correctly.

## Pre-launch simulations

Run at minimum: successful test order, failed payment, abandoned checkout, flagged/high-risk hold, address correction, cancellation before fulfilment, split shipment, out-of-stock exception, full refund, partial refund, replacement, damaged delivery, lost parcel, return, warranty issue, battery shipping hold and product-safety incident/recall tabletop. No scenario has yet been verified.

