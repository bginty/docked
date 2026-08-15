# Adult-only content audit

Status: **ONE-PRODUCT SOURCE REVIEWED — SHOPIFY/RENDERED/MEDIA APPROVAL PENDING**
Audit date: 15 August 2026

## Scope and evidence boundary

This audit covers the checked-in theme source and configured JSON content in `assets/`, `config/`, `layout/`, `sections/`, `snippets/` and `templates`, plus the four supplier PNGs received for review on 15 August 2026. It does not approve the final product, classify it, waive legal duties or establish that Shopify Admin matches source.

`DC-02 / Docked Cruise D2` is the sole current planned product and remains Draft. The other 14 Shopify product shells were archived, not deleted, on 15 August 2026. The complimentary pump and two proposed batteries are included components, not separate current products.

The source scan excludes code-only terms such as JavaScript `children`, `childNodes` and Liquid child-menu variables because they are not customer-facing audience references.

## Findings matrix

| Control | Finding | Status | Required follow-up |
| --- | --- | --- | --- |
| Homepage adult positioning | One-product configuration uses adult-focused, controlled-pool and evidence-gated preview wording | **PASS — source only** | Verify permanent Shopify preview at all required breakpoints |
| Former range/comparison surfaces | Multi-product collection grid/comparison/finder is removed or dormant in current homepage/product configuration | **PASS — source configuration** | Confirm no app/Admin block restores withdrawn products or comparison content |
| Prohibited child-focused marketing copy | No prohibited child/teen audience phrase is intentionally configured; technical code uses are excluded | **PASS — source only** | Repeat against rendered pages, Admin records, feeds and notifications |
| Product-card 18+ treatment | Product cards support an Adults 18+ badge via `custom.adult_only` | **PASS — mechanism** | Verify the deliberate Admin value; do not infer legal classification |
| Product-page adult/safety treatment | Product template supports adult badge, pool-use notice and product safety content from gated metafields | **PASS — mechanism** | Keep unapproved physical fields blank; preview-test final approved content |
| Safety and Care page | Dedicated source includes Adults 18+ / Pool use only framing and motorised-product safety structure | **PASS — source mechanism** | Adviser review, Admin page/template assignment and rendered QA remain pending |
| Optional age confirmation | Theme setting is disabled by default and does not purport to waive rights | **PASS — source** | Enable only after adviser/owner approval and test if used |
| Supplier PNGs | Four square AI concept images depict synthetic adults/no visible children, but contain product/claim inconsistencies | **REJECTED — public use** | Keep internal only; obtain exact-SKU documentary media with rights/release/safety evidence |
| Licensed exact-SKU media | None accepted | **BLOCKED** | Photograph/video the exact final production sample; record creator/rights, adult releases and permitted uses |
| Unsupported numeric claims | `160 kg`, `30/90 min`, `46/66 W`, `1.6 m/s/5 km/h`, thrust and dimensions conflict or lack accepted evidence | **BLOCKED** | Keep out of copy, metadata, alt text and metafields until reconciled and approved |
| Shopify products | Historical 14 August inspection recorded 15 Draft shells, no images and channels 0; authenticated Admin verification on 15 August recorded 14 Archived shells and one remaining DC-02 Draft with channels 0 | **PASS — catalogue scope reconciled; product approval still blocked** | Keep the archived shells non-public and DC-02 Draft/unavailable to sales channels |
| Navigation/search/SEO | Current source is narrowed, but Admin menus, Search & Discovery, SEO records, feeds and app content are not covered by this file | **PENDING — Admin/rendered** | Crawl and search-test after Admin reconciliation |
| Supplier packaging/manual | Final accepted exact-SKU packaging/manual not available | **BLOCKED — evidence** | Reconcile age presentation and mandatory warnings without weakening them |
| Reviews/UGC | No live review or UGC corpus observed | **PENDING — operations** | Moderate age, imagery, claims and safety before display; never fabricate reviews |

## AI supplier-image review

The four PNGs extracted from `Pics.zip` are `1254 × 1254` and carry C2PA/`caBX` metadata identifying OpenAI Media Service API / `gpt-image` v2.0 and `trainedAlgorithmicMedia`, created 14 August 2026. They have no camera EXIF and are not documentary exact-SKU photographs.

| Internal ID | SHA-256 | Adult-only observation | Publication decision |
| --- | --- | --- | --- |
| DC02-AI-01 | `486DBD184F386B1472AEE77B36CF11C4BB826B48FCB5647139A1DC1462F2EC3E` | Product-only/feature concept; no child shown | Internal moodboard only; not public |
| DC02-AI-02 | `C6B9CDC55D7A5921313EA4F28EF33A00E3FFB58F972ECEED698B5B0D04E73E86` | Product-only/feature concept; no child shown | Internal moodboard only; not public |
| DC02-AI-03 | `CAE11BD49147FE0DE4D49900B7CBBD55AD18CCD4F161EDDB9031F19C430E01AE` | Synthetic adult woman; no verified model-release/likeness basis | Internal moodboard only; not public |
| DC02-AI-04 | `DEAE3AEE4B7530E07BD47E9DB45B2C454EBB2E686E631722019F56BA28198CA9` | Synthetic adult man; no verified model-release/likeness basis | Internal moodboard only; not public |

No child appears in the reviewed PNGs, but that is only one content control. Product geometry, controls, cup holders, motors and callouts drift between images. The images cannot prove the sold model, safety, capacity, runtime, power, speed or included items. AI provenance also does not itself settle copyright, likeness, model-release or commercial-use authority. See [Asset licences](ASSET_LICENCES.md).

## Required search terms

Search case-insensitively, including punctuation, plural and possessive variants:

`kid`, `kids`, `child`, `children`, `teen`, `teens`, `teenager`, `youth`, `baby`, `infant`, `toddler`, `boy`, `girl`, `family`, `family fun`, `whole family`, `all ages`, `ride-on`, `pool toy`, `aquatic toy`, `learn to swim`, `learn-to-swim`, `swim aid`, `flotation aid`, `life jacket`, `personal flotation device`, `baby float`, `armband`, `mermaid tail`, `paddling pool`, `pool noodle`, `water slide`

Review context rather than deleting legitimate safety, classification or policy discussion. Positively verify `Adults 18+`, `adult pool leisure`, `pool use only`, `not a life-saving device` and the final product-specific warnings.

## Release audit surfaces

Run text and visual review across:

- rendered home, current collection, DC-02 product, search, cart, password, 404, Safety and Care, FAQ and policy pages;
- Shopify title, body, variants, vendor, tags, metafields, SEO listing, media and alt text;
- menus, predictive search, Search & Discovery filters/synonyms, redirects and app blocks;
- files, video, final manual, supplier packaging, notifications and social-sharing media;
- reviews, questions, UGC, feeds, social channels and paid creative/audiences; and
- desktop/mobile breakpoints, empty/sold-out states and app-injected content.

The audit can pass for launch only when all Shopify/Admin, product-data and media surfaces are inspected, DC-02 and every included component pass applicable evidence gates, licensed exact-SKU adult media exists, and no child-focused copy or imagery appears. Follow the standing [adult-only merchandising policy](ADULT_ONLY_MERCHANDISING_POLICY.md).
