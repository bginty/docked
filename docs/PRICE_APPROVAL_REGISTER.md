# Docked price approval register

**Prepared:** 13 August 2026  
**Currency:** AUD  
**Tax basis:** Draft consumer RRPs include 10% GST  
**Register status:** **No price approved; all concepts blocked**

Landed cost, gross margin and contribution are deliberately blank/unresolved because the required inputs have not been supplied. Blank never means zero.

## Approval register

| Named concept | Category | Draft RRP inc GST | Reproducible research finding | Landed cost ex GST | Gross margin | Contribution | Owner approval | Launch status |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Docked Cruise S1 | Powered single motor | $499 | 82.1% above $274 median; 5 entirely cross-border observations |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Cruise D2 | Powered dual motor | $649 | 12.9% above $575 median; only 3 cross-border observations |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Shade D2 | Powered dual motor with canopy | $749 | 39.6% above $536.50 median; only 2 cross-border observations |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Drift Mesh Lounge | Mesh hammock lounge | $59 | 122.7% above $26.50 median; adult fit/material value must support premium |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Recline Pool Chair | Supportive pool chair | $79 | 31.9% above $59.90 median; not cost-tested |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Stretch Full-Length Lounge | Full-length pool lounge | $99 | 4.3% above $94.95 median in a highly dispersed market |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Social Two-Person Island | Two-person float | $229 | 186.2% above $80 median; largest draft premium in the range |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Party Deck | Consumer multi-person island | $329 | 3.5% above $317.90 median; capacity/construction still unverified |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Rally Pool Volleyball Set | Pool volleyball set | $59 | 81.8% above $32.45 median; offer and cost structure need review |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Chill Floating Cooler | Floating cooler | $49 | 25.6% above $39 median; capacity/freight/margin unresolved |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Drinks Dock | Floating drink tray | $29 | 14.6% below $33.97 median; contribution headroom may be constrained |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Inflate Rechargeable Air Pump | Rechargeable air pump | $39 | 22.2% below $50.16 median; electrical/battery/warranty costs unresolved |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Double-Action Manual Pump | Double-action manual pump | $29 | 16.3% above $24.93 median; close to mainstream points |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Restore PVC Repair Kit | PVC repair kit | $19 | 2.8% above $18.48 median; compatibility/chemical evidence required |  | Unresolved | Unresolved | Pending | Blocked |
| Docked Dry Storage Pouch | Storage pouch - ingress claim pending | $29 | 65.8% above $17.49 median; exact ingress evidence required before any claim |  | Unresolved | Unresolved | Pending | Blocked |

## Calculator formulas

All costs used with ex-GST revenue must be entered ex GST. Rates are decimals (for example, 2.0% is `0.02`).

| Measure | Formula | Required inputs |
| --- | --- | --- |
| Retail price ex GST | `Retail price inc GST / 1.10` | Retail price inc GST |
| GST component | `Retail price inc GST - retail price ex GST` | Retail price inc GST |
| Gross profit | `Retail price ex GST - landed product cost ex GST` | Price and landed cost |
| Gross margin | `Gross profit / retail price ex GST` | Gross profit and ex-GST price |
| Payment fee | `(Retail price inc GST x fee rate) + fixed fee` | Transaction value and actual provider fees |
| Freight subsidy | Direct ex-GST seller-funded outbound freight | Carrier quote and customer charge |
| Warranty allowance | `Retail price ex GST x warranty allowance rate` | Evidence-based rate |
| Contribution | `Gross profit - payment fee - freight subsidy - warranty allowance - returns/replacement - advertising - packaging` | Every variable-cost input |

The formulas are implemented in [`pricing-calculator.csv`](../data/pricing-calculator.csv) with row-local references and blank guards.

## Approval controls

A concept remains **Blocked** until all of the following are recorded and reviewed:

1. Final supplier/model/SKU, quote, freight, duty, brokerage and landed cost.
2. Applicable product, electrical, battery, chemical and safety/compliance evidence.
3. Approved outbound freight and remote-area/dangerous-goods assumptions.
4. Payment, warranty, returns/replacement, advertising and packaging inputs.
5. Gross margin and contribution under base, promotional and adverse-cost scenarios.
6. A defensible market position supported by verified product differences.
7. Owner approval with approver name, date, final GST-inclusive price and conditions.

If viable contribution requires a price above the defensible offer, record **DO NOT LAUNCH - COST OR PRICING REVIEW REQUIRED**. A formula result is never owner approval.

## Owner decision log

No decisions have been entered.

| Named concept | Decision | Approved RRP inc GST | Approver | Approval date | Conditions/evidence reference |
| --- | --- | ---: | --- | --- | --- |
|  |  |  |  |  |  |
