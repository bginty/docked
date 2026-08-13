# Docked product metafield definitions

Status: **DEFINITION SPECIFICATION — ADMIN CREATION AND VALUES NOT VERIFIED**  
Last updated: 13 August 2026

Create these definitions in Shopify Admin under **Settings > Metafields and metaobjects > Products**. Shopify describes metafield definitions as the validation template for values and recommends standard definitions where suitable; Docked's product-safety fields are specialised custom definitions. See Shopify's official guidance on [adding metafield definitions](https://help.shopify.com/en/manual/custom-data/metafields/metafield-definitions) and [adding values](https://help.shopify.com/en/manual/custom-data/metafields/adding-values-to-metafields).

All definitions use namespace `custom`. Do not populate a value from concept copy, a marketplace listing, a competitor, an unreviewed supplier claim or a similar model. An empty field is the correct state until exact-SKU evidence has been accepted. The theme intentionally hides empty values.

## Merchandising and classification

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `adult_only` | Adult only | True or false | Set only after the merchandising/classification decision; all proposed aquatic products are intended for ages 18+, but intention is not product classification | Shows 18+ treatment and aquatic safety component when true |
| `powered` | Powered product | True or false | True only for an electrically powered exact SKU, including a powered accessory where applicable; false is a deliberate reviewed value, not a blank substitute | Powered/non-powered product badge only; it does not authorise motorised-float warnings or comparison inclusion |
| `powered_float` | Motorised pool float | True or false | True only after classification and exact-SKU evidence confirm that the product is a pool float with an in-water propulsion system. Do not set this for rechargeable pumps, chargers or another powered accessory | Precise gate for the motorised-float comparison and the propeller, propulsion, battery and charging warning; false or blank keeps those surfaces off |
| `seating_style` | Seating style | Single line text | Evidence-backed neutral description; no comfort/performance superlative | Powered comparison |
| `verified_occupancy` | Verified occupancy | Integer | Minimum 1; enter only the tested/approved occupancy for the exact SKU | Product badge and comparison |
| `canopy` | Canopy included | True or false | Set only after final configuration is known; false is a meaningful verified value | Powered comparison; does not support a sun-protection claim |
| `minimum_user_age` | Minimum user age | Integer | Minimum 18 for the current adult-only range; must also match labels/manual/classification outcome | Specification table |
| `approved_use_environment` | Approved use environment | Single line text | Copy exact approved scope; do not expand beyond evidence (for example, from pool to open water) | Product notice and specification table |

## Motor, battery and charging

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `motor_configuration` | Motor configuration | Single line text | Exact final model/manual terminology | Specification table |
| `motor_count` | Motor count | Integer | Minimum 1; exact production configuration only | Specification table and comparison |
| `control_type` | Control type | Single line text | Exact verified control architecture; do not infer joystick or wireless control | Specification table |
| `rated_power_w` | Rated power (W) | Decimal | Greater than 0; numeric watts only, with evidence identifying the rated component/conditions | Theme appends `W` |
| `battery_type` | Battery type | Single line text | Chemistry and construction from manufacturer evidence | Specification table |
| `battery_capacity_mah` | Battery capacity (mAh) | Integer | Greater than 0; manufacturer/test evidence required | Theme appends `mAh` |
| `battery_voltage_v` | Battery voltage (V) | Decimal | Greater than 0; state nominal/rated basis consistently in the accepted source | Theme appends `V` |
| `battery_watt_hours` | Battery energy (Wh) | Decimal | Greater than 0; verify against source/calculation and transport dossier | Theme appends `Wh`; shipping gate input |
| `verified_runtime_minutes` | Verified runtime (minutes) | Integer | Greater than 0; approved test conditions and limitations must be retained | Specification table and comparison |
| `verified_charge_time_hours` | Verified charge time (hours) | Decimal | Greater than 0; approved charger, starting state and test conditions retained | Specification table and comparison |
| `charger_model` | Approved charger model | Single line text | Exact supplied/approved charger identifier | Governance/future display; not currently rendered |
| `charger_rcm_status` | Charger RCM status | Single line text | Enter only the approved compliance outcome and controlled evidence reference; never use as a broad “Australian certified” claim | Governance/future approved disclosure; not currently rendered |
| `charging_instructions` | Charging instructions | Rich text | Approved exact-SKU instructions only; preserve critical dry-charging and abnormal-battery actions | Product Charging card |

## Dimensions, material and performance

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `maximum_user_weight_kg` | Verified maximum user weight (kg) | Decimal | Greater than 0; load/occupancy evidence and conditions required | Theme appends `kg`; specification and comparison |
| `inflated_length_cm` | Inflated length (cm) | Decimal | Greater than 0; define measuring method in evidence | Theme appends `cm` |
| `inflated_width_cm` | Inflated width (cm) | Decimal | Greater than 0; define measuring method in evidence | Theme appends `cm` |
| `packed_dimensions` | Packed dimensions | Single line text | Use a controlled `L × W × H cm` convention after packed configuration is verified | Specification and comparison; shipping input |
| `product_weight_kg` | Product weight (kg) | Decimal | Greater than 0; state net/gross basis in evidence; shipping weight remains a variant shipping field | Theme appends `kg`; specification and comparison |
| `material` | Material | Single line text | Verified factual composition only | Specification table |
| `pvc_grade_or_thickness` | Verified PVC detail | Single line text | Exact supported grade/thickness and scope; no unsupported health/environmental claim | Specification table |
| `verified_water_ingress_rating` | Verified ingress rating | Single line text | Identify the exact component, test/rating and limitations; never describe the whole product as waterproof unless exact evidence supports that scope | Specification table |

## Contents, instructions, safety and service

| Key | Admin name | Shopify type | Validation / entry rule | Storefront use |
| --- | --- | --- | --- | --- |
| `included_items` | Included items | Rich text | Exact packed contents; approved final SKU only | What is included card |
| `included_pump` | Included pump | Single line text | Exact factual included-pump status/model; use a reviewed explicit value for comparison | Powered comparison |
| `how_it_works` | How it works | Rich text | Approved explanation consistent with the manual; no unverified control/performance claim | Product How it works card |
| `setup_instructions` | Setup instructions | Rich text | Approved, ordered exact-SKU steps; not a substitute for the manual | Product Setup card |
| `usage_instructions` | Usage instructions | Rich text | Approved adult/pool-use instructions | Product Use card |
| `care_instructions` | Cleaning and storage instructions | Rich text | Approved material/battery-specific instructions | Product Cleaning and storage card |
| `safety_warnings` | Product-specific safety warnings | Rich text | Final exact-SKU wording approved by supplier, product-safety reviewer and legal reviewer; add required permanent/manual warnings, never weaken them | Product safety component |
| `compliance_reports` | Approved public compliance references | Rich text | Public-safe references only; do not upload confidential reports or imply certification beyond evidence | Manual and compliance card |
| `warranty_period` | Express warranty period | Single line text | Owner/adviser-approved express promise only; leave blank while unapproved; never limit ACL rights | Product warranty card and comparison |
| `manual_url` | Approved manual URL | URL | Final, accessible, public-safe manual for the exact SKU/revision; HTTPS; replace or withdraw when superseded | Download button |

## Definition configuration rules

- Pin the fields used by catalogue operators; group names/descriptions consistently so a blank is not mistaken for zero or false.
- Grant storefront access only to fields the theme or approved sales channel must read. A definition's storefront access does not make an unapproved value safe to publish.
- Use numeric types because the current theme appends the displayed units. Do not enter units inside numeric values.
- Do not set default values. In particular, do not default `adult_only`, `powered`, `powered_float`, `canopy`, occupancy, warranty or safety copy across products.
- Keep required validation conservative. Never add an arbitrary maximum that could be mistaken for a safety limit; the accepted evidence controls the value.
- Treat a populated boolean `false` as reviewed data. Leave the metafield unset when the product fact has not been determined.
- Preserve rich-text headings/lists and accessibility; do not paste scripts, tracking markup or hidden claims.

## Evidence-to-publication workflow

1. Receive and register the exact-SKU source under [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md).
2. Validate issuer, model, revision, test conditions, units, date and expiry/retest trigger.
3. Record the claim/classification outcome in [Compliance register](COMPLIANCE_REGISTER.md), [Approved product claims](APPROVED_PRODUCT_CLAIMS.md) and [Safety copy register](SAFETY_COPY_REGISTER.md) as applicable.
4. Obtain required supplier, specialist and owner approvals.
5. Enter the approved value on the Draft Shopify product; have a second operator compare it with the source.
6. Inspect product details, badges, warning placement and the motorised-float comparison. Confirm `powered` controls only the merchandising badge, while `powered_float` alone enables the motorised warning/comparison gate. A comparison row appears only when every selected motorised-float product has that field.
7. Record reviewer/date and screenshots or redacted evidence. Keep the product Draft until the full [SKU approval workflow](SKU_APPROVAL_WORKFLOW.md) passes.

## Admin QA record

| Check | Result | Evidence / reviewer / date |
| --- | --- | --- |
| Definitions created with exact namespace/key/type | Not run | Shopify Admin access not verified |
| Storefront access matches theme needs | Not run |  |
| Blank values remain hidden | Not run |  |
| `powered` and `powered_float` gates remain distinct; false/blank states render correctly | Not run |  |
| Numeric units are not duplicated | Not run |  |
| Rich text is accessible and matches approved copy | Not run |  |
| Manual URLs open the correct revision | Not run |  |
| No confidential compliance file is public | Not run |  |
