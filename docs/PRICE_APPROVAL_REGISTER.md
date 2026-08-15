# Docked price approval register

**Prepared:** 15 August 2026
**Currency:** AUD  
**Tax basis:** Provisional consumer price includes 10% GST
**Register status:** **DC-02 PRICE PENDING — NO SELLING PRICE APPROVED**

`DC-02 / Docked Cruise D2` is the sole current planned product. Its `$649` value is a planning hypothesis, not activation authority. Landed cost, gross margin and contribution remain deliberately blank/unresolved because the required inputs have not been supplied. Blank never means zero.

The other 14 concept prices are withdrawn from the current plan. Their historical research remains recoverable at baseline commit `306e5dd`; the corresponding Shopify product shells were archived, not deleted, on 15 August 2026.

## Current approval register

| Concept ID | Named product | Category | Provisional RRP inc GST | Research orientation | Landed cost ex GST | Gross margin | Contribution | Owner approval | Launch status |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| DC-02 | Docked Cruise D2 | Motorised pool lounger; final configuration unapproved | $649 | 12.9% above the historical `$575` median for three cross-border “powered dual motor” observations; comparability remains weak |  | Unresolved | Unresolved | Pending | Blocked / Draft |

The price must not be imported as an approved Active-product price, advertised as final, paired with a compare-at price, discounted or used to imply inventory. It may remain in controlled Draft planning data only.

## Calculator formulas

All costs used with ex-GST revenue must be entered ex GST. Rates are decimals (for example, 2.0% is `0.02`).

| Measure | Formula | Required inputs |
| --- | --- | --- |
| Retail price ex GST | `Retail price inc GST / 1.10` | Retail price inc GST |
| GST component | `Retail price inc GST - retail price ex GST` | Retail price inc GST |
| Gross profit | `Retail price ex GST - landed product cost ex GST` | Price and landed cost |
| Gross margin | `Gross profit / retail price ex GST` | Gross profit and ex-GST price |
| Payment fee | `(Retail price inc GST × fee rate) + fixed fee` | Transaction value and actual provider fees |
| Freight subsidy | Direct ex-GST seller-funded outbound freight | Carrier quote and customer charge |
| Warranty allowance | `Retail price ex GST × warranty allowance rate` | Evidence-based rate |
| Contribution | `Gross profit - payment fee - freight subsidy - warranty allowance - returns/replacement - advertising - packaging` | Every variable-cost input |

The formulas are implemented in [`pricing-calculator.csv`](../data/pricing-calculator.csv) for the single DC-02 row with row-local references and blank guards.

## Missing approval inputs

- Final supplier, production model/revision, SKU, commercial invoice and accepted sample.
- Approved landed cost for the exact package, including the lounger, two batteries, complimentary pump and every charger/cable/accessory.
- Freight, duty, brokerage, dangerous-goods handling, warehousing and Australian outbound delivery.
- Payment fees, packaging, returns/replacement, warranty, product-liability insurance and advertising assumptions.
- Confirmed available inventory; the proposed quantity of 20 is an intended order quantity, not stock evidence.
- Base, promotional and adverse-cost contribution scenarios.
- Evidence-backed product differentiation. Unsupported `160 kg`, `30/90 min`, `46/66 W`, `1.6 m/s/5 km/h`, thrust and dimensional claims may not justify the price.
- Owner approval with approver identity, date, final GST-inclusive price and conditions.

If viable contribution requires a price above the defensible offer, record **DO NOT LAUNCH — COST OR PRICING REVIEW REQUIRED**. A formula result is never owner approval.

## Owner decision log

No decision has been entered.

| Concept ID | Decision | Approved RRP inc GST | Approver | Approval date | Conditions/evidence reference |
| --- | --- | ---: | --- | --- | --- |
| DC-02 | Pending | — | — | — | Landed cost and full approval inputs outstanding |
