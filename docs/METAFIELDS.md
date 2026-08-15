# Docked product metafield definitions

Status: **DEFINITION SPECIFICATION — DC-02 VALUES UNAPPROVED AND BLANK**
Last updated: 15 August 2026

Create definitions in Shopify Admin under **Settings > Metafields and metaobjects > Products**. Use Shopify standard definitions where suitable and `custom` for Docked-specific safety fields. See Shopify guidance on [adding metafield definitions](https://help.shopify.com/en/manual/custom-data/metafields/metafield-definitions) and [adding values](https://help.shopify.com/en/manual/custom-data/metafields/adding-values-to-metafields).

`DC-02 / Docked Cruise D2` is the sole current planned product and remains Draft. Do not populate a value from concept copy, AI imagery, a marketplace listing, a competitor, an unreviewed supplier claim, a component report or a similar model. Empty is the correct state until exact-SKU evidence is accepted; the theme hides empty values.

The former multi-product range and comparison surfaces are dormant. Do not populate fields merely to make a comparison, range card or specification table render. The other 14 Shopify product shells were archived, not deleted, on 15 August 2026 and must not receive new values.

## DC-02 current value state

No numeric product/performance metafield is approved. Keep these blank: `verified_occupancy`, `minimum_user_age`, `motor_count`, `rated_power_w`, `battery_capacity_mah`, `battery_voltage_v`, `battery_watt_hours`, `verified_runtime_minutes`, `verified_charge_time_hours`, `maximum_user_weight_kg`, `inflated_length_cm`, `inflated_width_cm` and `product_weight_kg`.

Do not enter `160 kg`, `30` or `90` minutes, `46` or `66 W`, `1.6 m/s`, `5 km/h`, `2.8 kg` thrust, `157 × 195 × 460 mm`, `167 × 109 × 60 cm`, `1.8 kg`, `11.1 V`, `2600 mAh` or a calculated watt-hour value. The figures conflict, have unclear component/whole-product scope or have not been accepted against the exact final SKU. A received component report is not publication authority.

The adult-only merchandising decision may eventually support `adult_only = true` after Admin verification; it is not proof of legal classification, performance or safety. Leave `powered`, `powered_float` and every physical/configuration field unset until the exact product architecture and classification are accepted.

## Merchandising and classification

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `adult_only` | Adult only | True or false | Set only after the DC-02 merchandising decision is confirmed in Admin; intended 18+ audience is not product classification | Shows 18+ treatment and aquatic-safety component when true |
| `powered` | Powered product | True or false | Set only after exact product architecture is accepted; false is a reviewed value, not a substitute for unknown | Merchandising badge only; not compliance authority |
| `powered_float` | Motorised pool float | True or false | True only after classification and exact-SKU evidence; never apply to the pump, charger or other accessory | Gates motorised warnings; former comparison use is dormant |
| `seating_style` | Seating style | Single line text | Evidence-backed neutral wording; no comfort/performance superlative | Future specification use; comparison dormant |
| `verified_occupancy` | Verified occupancy | Integer | Minimum 1; exact-SKU tested/approved occupancy only; currently blank | Product badge; comparison dormant |
| `canopy` | Canopy included | True or false | Set only when the final configuration is known; false is meaningful reviewed data | Future specification use; comparison dormant |
| `minimum_user_age` | Minimum user age | Integer | Leave blank until final labels/manual/classification support an exact value; adult merchandising is separate | Specification table |
| `approved_use_environment` | Approved use environment | Single line text | Copy the exact approved scope; do not expand from pool to open water | Product notice and specification table |

## Motor, battery and charging

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `motor_configuration` | Motor configuration | Single line text | Exact final model/manual terminology | Specification table |
| `motor_count` | Motor count | Integer | Minimum 1; exact production configuration only; currently blank | Specification table; comparison dormant |
| `control_type` | Control type | Single line text | Exact verified architecture; do not infer joystick or wireless control | Specification table |
| `rated_power_w` | Rated power (W) | Decimal | Greater than 0; identify component, conditions and method; currently blank because `46/66 W` conflict | Theme appends `W` |
| `battery_type` | Battery type | Single line text | Exact accepted pack chemistry/construction for both included packs | Specification table |
| `battery_capacity_mah` | Battery capacity (mAh) | Integer | Greater than 0; accepted exact-pack evidence required; currently blank | Theme appends `mAh` |
| `battery_voltage_v` | Battery voltage (V) | Decimal | Greater than 0; state nominal/rated basis from accepted source; currently blank | Theme appends `V` |
| `battery_watt_hours` | Battery energy (Wh) | Decimal | Greater than 0; verify each pack and transport configuration; currently blank | Theme appends `Wh`; shipping input |
| `verified_runtime_minutes` | Verified runtime (minutes) | Integer | Greater than 0 with retained conditions; `30/90` conflict unresolved, so blank | Specification table; comparison dormant |
| `verified_charge_time_hours` | Verified charge time (hours) | Decimal | Greater than 0 with approved charger/conditions; currently blank | Specification table; comparison dormant |
| `charger_model` | Approved charger model | Single line text | Exact supplied/approved charger identifier; currently blank | Governance/future display |
| `charger_rcm_status` | Charger RCM status | Single line text | Approved Australian outcome/evidence reference only; never broad “Australian certified” wording | Governance/future disclosure |
| `charging_instructions` | Charging instructions | Rich text | Approved exact-SKU and charger instructions only | Product charging card |

## Dimensions, material and performance

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `maximum_user_weight_kg` | Verified maximum user weight (kg) | Decimal | Greater than 0; exact load/occupancy evidence required; no `160 kg` test supplied, so blank | Theme appends `kg`; comparison dormant |
| `inflated_length_cm` | Inflated length (cm) | Decimal | Greater than 0 with defined exact-SKU measuring method; currently blank | Theme appends `cm` |
| `inflated_width_cm` | Inflated width (cm) | Decimal | Greater than 0 with defined exact-SKU measuring method; currently blank | Theme appends `cm` |
| `packed_dimensions` | Packed dimensions | Single line text | Controlled `L × W × H cm` after final package verification; currently blank | Shipping/specification input |
| `product_weight_kg` | Product weight (kg) | Decimal | Greater than 0 with net/gross basis; currently blank | Theme appends `kg`; shipping input |
| `material` | Material | Single line text | Verified factual composition only | Specification table |
| `pvc_grade_or_thickness` | Verified PVC detail | Single line text | Supported exact detail/scope; no unsupported health/environmental claim | Specification table |
| `verified_water_ingress_rating` | Verified ingress rating | Single line text | Exact component, test/rating and limitations; never infer whole-product waterproofing | Specification table |

No thrust/speed field is currently defined. Do not add one or place those values in free text until the exact-SKU claim is approved.

## Contents, instructions, safety and service

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `included_items` | Included items | Rich text | Final packed contents after exact-model inspection; two batteries and pump are not yet approved inclusions | What-is-included card |
| `included_pump` | Included pump | Single line text | Exact pump model/status after its own evidence and package inspection; currently blank | Included-items content; comparison dormant |
| `how_it_works` | How it works | Rich text | Approved explanation matching final manual; no unverified performance | Product card |
| `setup_instructions` | Setup instructions | Rich text | Approved ordered exact-SKU steps; not a manual substitute | Product card |
| `usage_instructions` | Usage instructions | Rich text | Approved adult/pool-use instructions | Product card |
| `care_instructions` | Cleaning and storage instructions | Rich text | Approved material/battery-specific instructions | Product card |
| `safety_warnings` | Product-specific safety warnings | Rich text | Final exact-SKU wording approved by supplier, product-safety reviewer and legal reviewer | Product safety component |
| `compliance_reports` | Approved public compliance references | Rich text | Public-safe accepted references only; never expose confidential reports or overstate scope | Manual/compliance card |
| `warranty_period` | Express warranty period | Single line text | Owner/adviser-approved promise only; blank while unapproved; never limit ACL rights | Product warranty card; comparison dormant |
| `manual_url` | Approved manual URL | URL | Final public-safe exact-SKU manual/revision over HTTPS | Download button |

## Definition configuration rules

- Pin fields operators need and describe them so blank cannot be mistaken for zero or false.
- Grant storefront access only where required. Access does not make an unapproved value safe to publish.
- Use numeric types because the theme appends units; never enter units in numeric values.
- Do not set defaults for `adult_only`, `powered`, `powered_float`, `canopy`, occupancy, warranty or safety copy.
- Treat boolean `false` as reviewed data. Leave unknown facts unset.
- Keep the former comparison/range fields dormant during the one-product plan.
- Preserve accessible rich text; do not paste scripts, tracking markup or hidden claims.

## Evidence-to-publication workflow

1. Receive and register the exact-SKU source under [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md).
2. Validate issuer, model/revision, test conditions, units, date, scope and expiry/retest trigger.
3. Record the outcome in [Compliance register](COMPLIANCE_REGISTER.md), [Approved product claims](APPROVED_PRODUCT_CLAIMS.md) and [Safety copy register](SAFETY_COPY_REGISTER.md).
4. Obtain supplier, specialist and owner approvals.
5. Enter only the exact approved value on the Draft DC-02 product; have a second operator compare it with the source.
6. Inspect product details, badges and warning placement. Keep comparison/range surfaces dormant. Confirm boolean gates are merchandising mechanisms, not compliance proof.
7. Record reviewer/date and screenshots or redacted evidence. Keep DC-02 Draft until the full [SKU approval workflow](SKU_APPROVAL_WORKFLOW.md) passes.

## Admin QA record

| Check | Result | Evidence / reviewer / date |
| --- | --- | --- |
| Definitions created with exact namespace/key/type | Not run | Shopify Admin verification pending |
| DC-02 numeric values are blank | Not run |  |
| Blank values remain hidden | Not run |  |
| `powered` and `powered_float` remain distinct; comparison remains dormant | Not run |  |
| Numeric units are not duplicated | Not run |  |
| Rich text is accessible and approved | Not run |  |
| Manual URL opens the correct revision | Not run |  |
| No confidential compliance file or AI concept image is public | Not run |  |
