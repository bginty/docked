# Docked asset provenance and licence register

Status: **REPOSITORY ASSETS RECORDED — EXACT-SKU PRODUCT MEDIA BLOCKED**
Last updated: 15 August 2026

This register covers assets shipped with the theme source. It does not grant permission to use a supplier's, marketplace seller's or competitor's media. No Desertcart, Amazon or other retailer product photography, copy, reviews, branding or page design has been imported.

## Theme foundation

| Asset group | Files / source | Provenance | Permitted use and conditions | Status |
| --- | --- | --- | --- | --- |
| Shopify Dawn theme code and bundled UI assets | Theme files inherited from [Shopify Dawn](https://github.com/Shopify/dawn), including the original icon set and `assets/sparkle.gif` | Official Dawn v16.0.0 source at upstream commit `bc39a7d2024f1e5c14c42f855bd3552b4913e204` | Shopify's licence permits use to develop themes that integrate or interoperate with Shopify, subject to the conditions in [`LICENSE.md`](../LICENSE.md). Preserve the copyright and licence notice in copies or substantial portions. | Recorded |
| Shopify-hosted runtime resources | Merchant-selected fonts served from `fonts.shopifycdn.com`; Shopify standard-events module and model-viewer stylesheet served from `cdn.shopify.com` when the applicable theme features run | Loaded by the Shopify theme/platform; no font, standard-events or model-viewer binary is stored in this repository | Use only through the supported Shopify theme/platform integration. Merchant font choices must remain within Shopify's font picker; do not upload an unlicensed font file. | Recorded; final merchant selections pending |
| Optional YouTube/Vimeo embeds | Dawn video-capable sections | No third-party video is included in the repository. A merchant-supplied URL causes the relevant provider embed to load. | Before use, record the video's owner, URL, permission/licence, model release, product/SKU match, safety review, caption status and publication approval below. | Empty / disabled until approved media exists |

## Original Docked design assets

The following SVGs were created specifically for this repository from original vector geometry. They are path-only assets using theme-controlled `currentColor` for the main ink plus fixed Docked cyan/coral accents; the standalone favicon and social template carry their own approved preview palette. They are decorative (`aria-hidden="true"`, `focusable="false"`) and rely on adjacent interface text for the accessible brand name. They were not traced from competitor, supplier or reference media and are not depictions of a physical product:

Creation record: implemented in the Docked repository by Codex at the owner's direction on 14 August 2026. This records source provenance only; it does not clear the public brand name or establish rights in the supplied moodboard artwork.

- `assets/docked-wordmark.svg`
- `assets/docked-mark.svg`
- `assets/docked-wake.svg`
- `assets/docked-icon-adult-18.svg`
- `assets/docked-icon-canopy.svg`
- `assets/docked-icon-capacity.svg`
- `assets/docked-icon-pool-use.svg`
- `assets/docked-icon-powered.svg`
- `assets/docked-icon-safety.svg`
- `assets/docked-icon-seated.svg`
- `assets/docked-icon-storage.svg`
- `assets/favicon.svg`
- `assets/docked-social-template.svg`

Status: **approved for unpublished theme preview only**. The wordmark and mark remain subject to the Docked business-name and trademark gate in [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md). The social template is a layout asset, not approved finished campaign creative.

## User-supplied logo moodboard references

Three JPG logo references supplied on 14 August 2026 were reviewed only for broad moodboard attributes: a bold geometric wordmark, forward visual energy, strong navy/aqua contrast and a restrained warm accent. Their creator, rights holder and licence are not established.

- The JPG files remain under `.codex-remote-attachments/`, which is excluded from both Git and Shopify theme uploads.
- They are not shipped assets, product media or approved public brand artwork.
- No duck mascot, propeller-in-D construction, glossy highlight treatment, lettering silhouette or splash composition was traced or reproduced.
- The production-candidate SVG layer uses independently constructed path geometry, a calm wake and no universal powered-product or speed claim.

If the reference artwork is ever proposed for public use, record its creator, rights holder, written licence, permitted channels, territory and term before importing it into the controlled asset workflow.

## Supplier product-image package reviewed 15 August 2026

Four PNGs supplied in `Pics.zip` were inspected as potential DC-02 media. Each is `1254 × 1254`, has no camera EXIF, and contains a C2PA/`caBX` manifest identifying OpenAI Media Service API / `gpt-image` v2.0 and `trainedAlgorithmicMedia`, with a creation date of 14 August 2026. Visual details and numeric callouts also conflict between files and with the unresolved supplier statements.

| Internal asset ID | Supplied filename/description | SHA-256 | Review result | Permitted use |
| --- | --- | --- | --- | --- |
| DC02-AI-01 | `ChatGPT Image ...02_15.png` | `486DBD184F386B1472AEE77B36CF11C4BB826B48FCB5647139A1DC1462F2EC3E` | AI concept render; exact product geometry and included features not verified | Internal moodboard/evidence review only; not public |
| DC02-AI-02 | `ChatGPT Image ...02_32.png` | `C6B9CDC55D7A5921313EA4F28EF33A00E3FFB58F972ECEED698B5B0D04E73E86` | AI concept render; includes unsupported feature/performance callouts | Internal moodboard/evidence review only; not public |
| DC02-AI-03 | `Girl.png` / adult-woman concept scene | `CAE11BD49147FE0DE4D49900B7CBBD55AD18CCD4F161EDDB9031F19C430E01AE` | Synthetic adult lifestyle concept; no documentary product match or model-release basis | Internal moodboard/evidence review only; not public |
| DC02-AI-04 | `Man.png` / adult-man concept scene | `DEAE3AEE4B7530E07BD47E9DB45B2C454EBB2E686E631722019F56BA28198CA9` | Synthetic adult lifestyle concept; no documentary product match or model-release basis | Internal moodboard/evidence review only; not public |

These assets are **rejected as storefront product or lifestyle media**. They may not be presented as documentary photographs of the sold product, used to prove design or included features, uploaded to Shopify product media, placed in SEO/social feeds or used in ads. AI provenance does not itself resolve copyright, likeness, model-release, brand or product-accuracy rights. No child is depicted in the reviewed files, but that does not make them approved adult-only creative.

The files conflict on cup-holder/controller/motor/product geometry and show or state unapproved `160 kg`, `90-minute`, `46/66 W`, speed/movement and water-jet/propeller claims. The claims remain blocked in [Approved product claims](APPROVED_PRODUCT_CLAIMS.md).

## Product and lifestyle media

No licensed documentary photography or video of the exact final production DC-02 SKU has been supplied. Consequently:

- DC-02 remains Draft;
- any abstract placeholder is preview-only and must not be represented as the product;
- no supplier or marketplace image may be uploaded until written permission covers Docked's intended channels, territories, edits and duration; and
- aquatic-product media must show adults only, controlled pool use and behaviour consistent with the approved manual and warning set.

Authenticated Shopify Admin inspection on 14 August 2026 recorded 15 imported concept products as Draft with **no product images** and channels 0. On 15 August 2026, DC-02 remained the sole Draft product and the other 14 product shells were archived, not deleted. The import created no product-media licence claim. Inventory was not tracked; this is not evidence of zero or available stock.

The QA image files under `docs/qa/production-preview/` are dated captures of the unpublished theme interface. They are test evidence only, are not exact-SKU product media, and must not be reused as product photography or public campaign creative.

For every incoming product image, video, illustration, audio track, testimonial capture or model image, add one row before upload:

| Asset ID | File / Shopify media ID | Exact product and revision | Creator / rights owner | Source URL or delivery record | Licence or permission | Territory / channels / term | Model/property release | Safety and adult-only review | Approver / date | Expiry / withdrawal action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _Pending_ |  |  |  |  |  |  |  |  |  |  |

Store signed licences and releases in the approved controlled evidence repository, not in a public theme repository if they contain personal, confidential or commercial information. Reference the controlled record here without exposing private data.

## Pre-publication audit

- [ ] Every storefront image/video is present in this register and matches the exact production SKU.
- [ ] Written permission is retained and has not expired or been withdrawn.
- [ ] Adults-only and product-safety review is complete; no child-focused model, styling or copy remains.
- [ ] Alt text describes the actual image without unsupported product claims.
- [ ] No competitor branding, listing copy, reviews, trade dress or hotlinked media appears.
- [ ] No unlicensed font, stock asset, music or social icon has been added.
- [ ] Placeholder artwork is absent from Active product media and live sales creative.
- [ ] The final wordmark/mark is cleared under the business-name and trademark gate.
