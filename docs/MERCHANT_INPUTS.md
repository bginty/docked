# Merchant inputs register

Status: **PARTIALLY SUPPLIED — MATERIAL LAUNCH INPUTS REMAIN MISSING**  
Last updated: 13 August 2026

This register distinguishes facts supplied by the owner from values that are missing, unverified or awaiting approval. A draft concept, price band, theme default or repository placeholder is not a merchant-approved production value.

## Confirmed owner-supplied inputs

| Input | Confirmed value |
| --- | --- |
| Public brand | Docked |
| Domain | docked.com.au |
| Legal seller | **GINTY UNITED INVESTMENTS PTY LTD** |
| ABN | **78 606 187 106** |
| ACN | **606 187 106** |
| GST status | **Registered for GST** |
| Correspondence and authorised-returns address | **135 Bamfield Road, Heidelberg Heights VIC 3081, Australia** |
| Address restriction | **Correspondence and authorised returns only. No public showroom or walk-in service.** |
| Currency | AUD |
| Primary market | Australia |
| Store time zone | Australia/Melbourne |
| Consumer pricing basis | GST inclusive |
| Audience | Aquatic products marketed for adults aged 18 years and over |
| Payment architecture | Shopify hosted checkout and Shopify-native payment integrations only |

The legal/entity values are implementation instructions supplied by the owner, not an independent registry or tax verification. See [Legal entity details](LEGAL_ENTITY_DETAILS.md).

## Supplied value with verification still required

| Input | Supplied value | Required verification |
| --- | --- | --- |
| Support email | support@docked.com.au | Mailbox existence; inbound/outbound/reply-path tests; sender authentication; SPF, DKIM and DMARC; spam placement |
| Docked name | Public brand value supplied | ASIC business-name status, holder/registration, IP Australia search, conflict review and filing decision |
| Address as authorised-return destination | Address and qualification supplied | Operational return-authorisation process; no walk-in/local-pickup representation |

Do not call support@docked.com.au verified or working, and do not claim the Docked business name or trademark has been checked.

## Missing product and supplier inputs

Required for each final SKU/variant:

- final product name, supplier legal identity, manufacturer, model, SKU, barcode and vendor/brand;
- executed supplier terms/purchase evidence and final packaging/manual;
- variants, exact included items, product/packed weight and dimensions, inventory quantity and traceability method;
- verified material, occupancy/load, use environment, instructions, warnings, warranty and all claim evidence;
- applicable aquatic-product classification/testing, electrical/charger/RCM evidence, battery and transport evidence, and radio evidence;
- supplier warranty, spare-parts, defect-escalation and recall contacts; and
- licensed exact-product photos/videos showing adults only.

No final product, supplier, specification, media or compliance input has been confirmed merely because a draft catalogue row or theme metafield exists.

## Missing commercial and operating inputs

- final landed cost and owner-approved GST-inclusive retail price for every SKU;
- genuine compare-at price history, if any;
- launch stock quantity and inventory location;
- Australian shipping rates, remote-area treatment, eligible carriers, battery acceptance and dispatch timeframe;
- free-shipping threshold, express option or local-pickup decision, if any;
- approved change-of-mind policy, customer-facing warranty promise and bundle structure;
- product-liability insurance evidence for the exact range/territory;
- support phone number only if the owner chooses to publish/use one;
- final fulfilment, returns, warranty, incident and recall operators; and
- approved final policies and transactional copy.

## Missing account, payment and technical-owner inputs

- Shopify store identity/URL and authorised Admin access, where not already available to the deployment owner;
- owner identity and Australian business verification required by Shopify Payments;
- genuine business bank/payout account entered by the owner in Shopify Admin — never in Git or this file;
- genuine PayPal Business account and owner authorisation;
- Shopify Payments and PayPal verification results;
- approval, fee review and merchant status for any later payment method such as Afterpay;
- analytics/advertising account IDs and consent configuration decisions;
- domain/DNS access and explicit cutover authority; and
- final approval to publish the theme, activate products and enable live capture.

## Approval rule

Record missing values only in the appropriate secure/Admin or evidence system. Do not commit credentials, bank details, identity documents, customer data or private supplier documents. A product remains Draft and live capture remains disabled until its evidence and approvals are complete.

The owner-level checklist is deliberately consolidated in [Owner actions](../OWNER_ACTIONS.md); technical detail belongs in [Shopify Admin setup](SHOPIFY_ADMIN_SETUP.md), [Payments setup](PAYMENTS_SETUP.md) and the compliance registers.
