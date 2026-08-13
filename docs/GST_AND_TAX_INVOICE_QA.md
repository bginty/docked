# GST and tax-invoice QA

Status: **ADMIN ACTION REQUIRED — UNCONFIGURED/UNTESTED**  
Last updated: 13 August 2026

This runbook records the owner-supplied GST basis and the required evidence before launch. It does not establish that Shopify Admin, checkout, notifications or invoice output have been configured, and it is not tax or legal advice.

## Configuration basis

- Legal seller: **GINTY UNITED INVESTMENTS PTY LTD**
- ABN: **78 606 187 106**
- GST status: **Registered for GST**
- Market: **Australia only at launch**
- Currency: **AUD**
- Consumer pricing: **GST inclusive**
- Approved customer wording: **All prices are in Australian dollars and include GST.**

Do not show a GST-exclusive headline price to ordinary Australian retail customers. The complete business record is in [Legal entity details](LEGAL_ENTITY_DETAILS.md).

## Non-negotiable automatic-invoice requirement

**Every completed order must automatically receive a compliant Tax Invoice. The customer must not have to request one.**

This requirement is **not yet implemented or tested in Shopify Admin**. Before launch, configure a supported Shopify order-document/notification workflow that automatically generates and delivers the required output. Confirm the actual trigger, recipient, attachment/link availability, regeneration process and accessibility on desktop and mobile. If the selected Shopify capability cannot satisfy the requirement, stop and obtain owner/accountant approval for a suitable solution before accepting orders.

## Required invoice content

The generated document must be checked for:

- the words **Tax Invoice**;
- **GINTY UNITED INVESTMENTS PTY LTD**;
- **ABN 78 606 187 106**;
- invoice date;
- order or invoice number;
- customer details where required;
- product description and quantity;
- GST-inclusive amount and the GST component;
- shipping, discounts and total;
- [support@docked.com.au](mailto:support@docked.com.au); and
- **135 Bamfield Road, Heidelberg Heights VIC 3081, Australia**.

The support email value is owner-supplied but the mailbox is not yet verified. The invoice address is a correspondence and authorised-returns address only; customer returns still require prior authorisation.

## Shopify Admin actions

- [ ] Enter the exact legal seller, ABN and Australian business address in the appropriate legal/billing/tax fields.
- [ ] Confirm Australia, AUD and Australia/Melbourne settings.
- [ ] Configure the store for GST-inclusive Australian consumer prices based on the confirmed GST registration.
- [ ] Confirm that product, cart, checkout and order-confirmation wording consistently shows GST-inclusive AUD pricing.
- [ ] Configure the automatic Tax Invoice workflow and approved template.
- [ ] Verify the template uses the exact legal details and required transaction fields above.
- [ ] Confirm how discounts, shipping, rounding, cancellations, refunds and partial refunds appear in the invoice/order-document workflow.
- [ ] Have an accountant or appropriately qualified reviewer approve the configuration and sample outputs.

## Required test matrix

All scenarios are **Pending — untested/Admin action**. Use test mode or an approved Shopify test gateway; do not charge a real card.

| Scenario | Required checks | Status/evidence |
| --- | --- | --- |
| Full-price order | GST-inclusive product display; correct GST component and total; automatic Tax Invoice delivery | **Pending — untested** |
| Discounted order | Genuine discount allocation, GST component, subtotal and total remain internally consistent | **Pending — untested** |
| Shipping charge | Approved shipping amount and its GST treatment appear correctly in checkout and invoice | **Pending — untested** |
| Full refund | Refund output, refunded GST and order balance reconcile to the original order | **Pending — untested** |
| Partial refund | Refunded line/amount, associated GST and remaining order balance reconcile | **Pending — untested** |
| Multiple items | Quantities, descriptions, line totals, rounding, GST and order total reconcile | **Pending — untested** |
| Bundle | Approved bundle structure, discount allocation, component/line description and GST reconcile | **Pending — untested** |
| Gift card, if later enabled | Accountant-approved gift-card treatment, redemption, remaining payable amount and invoice output | **Pending — feature not approved/enabled** |

For every test, retain the redacted order number, configuration snapshot, checkout/order screenshots, delivered Tax Invoice, calculation reconciliation, notification timestamp and reviewer/date. Do not commit customer personal data, payment data or credentials.

## Pass criteria

GST and invoice QA passes only when every applicable scenario above has evidence, the automatic delivery trigger works, all required identity and transaction fields are present, storefront/checkout/invoice totals reconcile, and the qualified reviewer has recorded approval. Until then, keep products Draft, payments in test mode or unconfigured, and live capture disabled. See [Payments setup](PAYMENTS_SETUP.md) and [Shopify Admin setup](SHOPIFY_ADMIN_SETUP.md).
