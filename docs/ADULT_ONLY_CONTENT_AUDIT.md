# Adult-only content audit

Status: **SOURCE PASSES — SHOPIFY CONTENT, PRODUCT DATA AND MEDIA STILL PENDING**  
Audit date: 14 August 2026

## Scope and evidence boundary

This audit covers the checked-in theme source and configured JSON content in `assets/`, `config/`, `layout/`, `sections/`, `snippets/` and `templates/`. It does **not** establish the contents of Shopify Admin, product/collection records, navigation, pages, blogs, search synonyms, app blocks, customer reviews, uploaded files, product feeds, advertising accounts or supplier packaging. Those surfaces have not been loaded or observed in this repository and remain pending.

The source scan excluded code-only uses of terms such as JavaScript `children`, `childNodes` and Liquid child-menu variables because they are not customer-facing age references.

## Findings matrix

| Control | Source finding | Status | Required follow-up |
| --- | --- | --- | --- |
| Homepage adult positioning | Configured homepage includes “Adult pool leisure”, “Adults only”, adult-focused collection labels and controlled-pool safety copy | **PASS — source** | Verify rendered Shopify preview |
| Prohibited child-focused marketing copy | No prohibited audience phrase was found in the configured storefront source; only technical code uses of “children/child” were found | **PASS — source** | Repeat against rendered pages and Admin content |
| Product-card 18+ badge | Product cards render the badge when `custom.adult_only` is true | **PASS — mechanism** | Define/populate the metafield for every applicable Draft product and preview-test |
| Product-page 18+ badge and safety summary | Product template renders adult badge, pool-use message and safety notice conditionally from product metafields | **PASS — mechanism** | Populate verified metafields and preview-test each SKU |
| Safety and Care page badge/content | The dedicated source template contains the Adults 18+ / Pool use only safety notice and the complete Draft powered-product safety section; no Shopify page resource or template assignment was observed | **PASS — source mechanism; PENDING — Admin** | Create the page, assign `page.safety-and-care`, complete adviser review and verify the rendered warning set |
| Powered comparison 18+ badge | The comparison header renders clear Adults 18+ and Pool use only badges. The section requires at least two distinct selected products whose `custom.powered_float` value is true, rejects duplicate selections, and otherwise appears only as an instructional state in the Theme Editor | **PASS — source mechanism** | Populate only approved motorised-float products and verify the rendered comparison in preview |
| Optional age confirmation | Theme setting exists and is disabled by default; copy says 18+ and does not purport to waive rights | **PASS — source** | Keep disabled unless adviser and owner approve; test if enabled |
| Child/teen imagery | No Docked product, lifestyle, review or human-model imagery is assigned in checked-in theme configuration | **PASS — source inventory only** | Audit every Admin/uploaded/feed asset before publication |
| Placeholder imagery | Docked preview presentation uses CSS abstraction and original-labelled Docked SVG/vector artwork; hero copy explicitly says approved product photography is required | **PASS — preview source** | Do not treat preview art as product evidence or sales photography |
| Product photography and licence | No approved product photography or per-SKU licence was observed | **PENDING — launch blocker** | Obtain exact-SKU adult-only media and record permission/licence |
| Shopify products and collections | Theme handles and conditional components exist, but live/Draft Admin records were not observed | **PENDING — Admin** | Keep every product Draft; audit titles, descriptions, media, tags, SEO and status |
| Navigation, Search & Discovery and SEO synonyms | Source contains intended handles, but final Admin menus, filters and synonyms were not observed | **PENDING — Admin** | Configure, crawl and search-test all terms |
| Supplier packaging/manuals | No final supplier packaging or manual was available in the audited source | **PENDING — evidence** | Reconcile age presentation and all mandatory warnings without altering them |
| Reviews and user-generated content | No live review/UGC corpus was observed | **PENDING — operations** | Moderate age, imagery, claim and safety compliance before display |

## Imagery inventory conclusion

The configured Docked preview has no assigned product or lifestyle photography. Its visible fallback is abstract CSS plus Docked-authored/labelled SVG vector artwork. The repository also contains generic upstream Dawn assets, including `sparkle.gif`; no Docked configured template reference to that bitmap was found in this audit. This is a source inventory finding, not an intellectual-property clearance opinion.

No child or teenager imagery was found because no human/product imagery is presently assigned. That finding cannot be carried forward to Shopify-hosted media without a separate Admin and rendered-site audit.

## Required search terms

Search case-insensitively, including punctuation, plural and possessive variants:

`kid`, `kids`, `child`, `children`, `teen`, `teens`, `teenager`, `youth`, `baby`, `infant`, `toddler`, `boy`, `girl`, `family`, `family fun`, `whole family`, `all ages`, `ride-on`, `pool toy`, `aquatic toy`, `learn to swim`, `learn-to-swim`, `swim aid`, `flotation aid`, `life jacket`, `personal flotation device`, `baby float`, `armband`, `mermaid tail`, `paddling pool`, `pool noodle`, `water slide`

Review context rather than deleting legitimate safety, classification or policy discussion. Also positively verify `Adults 18+`, `adult pool leisure`, `pool use only`, `not a life-saving device` and the applicable product-specific warnings.

## Release audit surfaces

Run the search and visual review across:

- rendered home, collection, product, search, cart, password, 404, Safety and Care, FAQ and policy pages;
- Shopify product titles, bodies, variants, vendors, tags, metafields, SEO titles/descriptions and media alt text;
- collections, navigation, predictive search, Search & Discovery filters/synonyms and redirects;
- files, videos, manuals, supplier packaging, notification templates and social-sharing media;
- reviews, questions, user-generated content, product feeds, social channels and paid-ad creative/audiences; and
- desktop/mobile breakpoints, empty states, sold-out states and app-injected content.

The audit can pass for launch only when all pending Shopify/Admin, product-data and media surfaces are inspected, every applicable aquatic SKU is approved, and no child-focused copy or imagery appears. Follow the standing [adult-only merchandising policy](ADULT_ONLY_MERCHANDISING_POLICY.md).
