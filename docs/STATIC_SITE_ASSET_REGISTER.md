# Static site asset register

Last reviewed: 16 August 2026 (AEST)

This register covers only assets intended for the public static site. It does not convert a supplied reference into documentary product evidence or establish intellectual-property rights that have not been provided. The supplier feature board and the two `Website Ideas.eml` lifestyle sources contain C2PA provenance identifying `gpt-image v2.0` and `trainedAlgorithmicMedia`. Their public derivatives must therefore be presented as supplier-provided illustrations, not documentary photographs. Deterministic cropping, resizing, redaction or re-encoding does not change that source provenance.

## Publication decisions

| Asset | Purpose | Source and status | Public decision |
| --- | --- | --- | --- |
| `assets/images/brand-mark.svg` | Header and footer identity | Original code-native site asset created for this release from the owner-supplied navy, pool-blue and warm-accent direction. It does not trace a supplied logo or depict the product. | Approved for this static release. |
| `assets/images/favicon.svg` | Favicon/manifest mark | Original code-native companion mark created for this release. | Approved for this static release. |
| `assets/images/og-card.svg` | Open Graph/social preview | Original non-product brand composition. It is not exact-product photography. | Approved for this static release. |
| `assets/images/gallery-water.svg` | Abstract gallery panel | Original code-native pool-water/summer illustration. It is explicitly labelled as brand illustration, not product photography. | Approved for this static release. |
| `assets/images/gallery-control.svg` | Abstract gallery panel | Original code-native directional/control illustration. It does not depict or specify product hardware. | Approved for this static release. |
| `assets/images/gallery-safety.svg` | Abstract gallery panel | Original code-native adult/pool safety illustration. | Approved for this static release. |
| `assets/images/product/cruise-d2-pool-{600,1200}.webp` | Homepage hero and gallery | Deterministic crops of supplier `3-Photo-3.jpg`; exact source pixels retained and surrounding specification graphics removed. | Approved by the owner on 15 August 2026 as the Docked product. |
| `assets/images/product/cruise-d2-overview-{600,1200}.webp` | Product overview and gallery | Deterministic crops of supplier `2-Photo-2.jpg`; exact source pixels retained and surrounding numerical claims removed. | Approved by the owner on 15 August 2026 as the Docked product. |
| `assets/images/product/cruise-d2-controls-{600,1200}.webp` | Controls gallery | Deterministic crops of supplier `1-Photo-1.jpg`; exact source pixels retained and the supplier headline/text callouts removed. | Approved by the owner on 15 August 2026 as the Docked product. |
| `assets/images/product/cruise-d2-social-1200.jpg` | 1200 × 630 Open Graph image | Deterministic social crop of supplier `3-Photo-3.jpg`; no generative alteration. | Approved for this release under the same owner confirmation. |
| `assets/images/product/cruise-d2-features.jpg` | Prominent homepage feature board | Deterministic text-redacted derivative of the exact feature-board attachment in `Website Ideas.eml`. The source carries C2PA `gpt-image v2.0` / `trainedAlgorithmicMedia` provenance; exact public hash and derivative treatment are recorded below. | Approved for the 16 August 2026 site revision only as a visibly labelled “Supplier product illustration”. The derivative processing is non-generative; the source generation is AI-credentialed. |
| `assets/images/product/cruise-d2-lifestyle-man-{600,1200}.webp` | “More than a float” editorial panel | Fixed 3:2 crop of `Man on Float.png` from the supplied `Website Ideas.eml`; all baked-in copy, the 360-degree graphic and the 46W panel are excluded. The source carries C2PA `gpt-image v2.0` / `trainedAlgorithmicMedia` provenance. | Approved by the owner on 16 August 2026 only as a visibly labelled “Supplier lifestyle illustration”. Cropping and encoding are deterministic, but the source is AI-credentialed. |
| `assets/images/product/cruise-d2-lifestyle-woman-{600,1200}.webp` | “Control from your seat” editorial panel | Fixed 3:2 crop of `Girl on Float.png` from the supplied `Website Ideas.eml`; all baked-in copy and labelled feature insets are excluded. The source carries C2PA `gpt-image v2.0` / `trainedAlgorithmicMedia` provenance. | Approved by the owner on 16 August 2026 only as a visibly labelled “Supplier lifestyle illustration”. Cropping and encoding are deterministic, but the source is AI-credentialed. |

These registered files are the complete intended visual set for the current candidate. An asset marked prepared is not treated as live until the deployment record identifies its production commit and verification evidence. No undocumented visual may be published.

## Current supplier feature-board revision

The owner supplied `Website Ideas.eml`, approved implementing its unambiguous visual changes in the active project session on 16 August 2026, and had previously confirmed that the product imagery came from the supplier, depicts the Docked product and is authorised for Docked's website use. The six retained product facts remain motorised electric propulsion, up to 5 km/h, dual joystick control, 160 kg capacity, built-in cup holder and supportive headrest.

| Evidence item | Recorded value |
| --- | --- |
| Owner-supplied source | `ChatGPT Image Aug 14, 2026, 02_32_27 PM.png`, extracted byte-for-byte from `Website Ideas.eml` into the ignored `source-assets/website-ideas-email-2026-08-16/` working directory |
| Source size | 2,122,122 bytes; 1254 × 1254 pixels |
| Source SHA-256 | `C6B9CDC55D7A5921313EA4F28EF33A00E3FFB58F972ECEED698B5B0D04E73E86`; matches the decoded email attachment exactly |
| Actual source encoding | RGB PNG. C2PA inspection identified `gpt-image v2.0` and the digital-source type `trainedAlgorithmicMedia`; a basic decoder not exposing that manifest is not evidence that provenance is absent. |
| Intended public asset | `assets/images/product/cruise-d2-features.jpg` |
| Public derivative | 597,205 bytes; 1536 × 1536 JPEG/JFIF; SHA-256 `CBF4A3F9508F01A17732FC24853ECEDD1B99CFE3CD3A5BEB104023DDE8FE01A7` |
| File treatment | The product, layout, headings and approved callouts are retained. Only the unsupported paragraph “Strong and stable design for a safe and comfortable ride.” is removed. No replacement box or wording is added. |
| Deterministic water patch | The fixed target `(930, 728, 1235, 850)` is covered from the source's clean water region `(610, 25, 915, 147)`. Its channel means are matched to the adjacent clean-water strip `(1235, 728, 1254, 850)`, then a fixed smoothstep feather of 24 px horizontally and 12 px vertically blends the edges. The result is uniformly resized to 1536 × 1536 and encoded as metadata-free JPEG at quality 94. |
| Product-pixel preservation | The patch does not intersect the product or any retained heading, icon, underline or approved callout. Outside the fixed patch mask, the supplied board is unchanged before the uniform whole-image resize and JPEG encoding. No inpainting, reconstruction or generative editing is used during derivative processing; the source itself remains AI-credentialed. |
| Revision status | Prepared for the approved 16 August 2026 site revision. It supersedes the prior boxed-text derivative (SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`); live publication evidence belongs in the deployment record. |

The public board is visibly labelled “Supplier product illustration”. It states motorised power with built-in electric propulsion up to 5 kph, dual joystick control, a built-in cup holder, 160 kg capacity, a supportive headrest and summer-oriented use. The qualitative safety/comfort paragraph is not carried forward. The owner's confirmation is the evidence currently recorded for the six retained product facts. No independent speed/performance test or 160 kg load-bearing test was supplied or reviewed in this revision, so the board is not described as independently tested or laboratory-verified.

## Supplied friend-logo references — not published

The user supplied three JPG logo references and asked that they guide the design. They are preserved outside the tracked production output under `.codex-remote-attachments/`, which is ignored by Git.

| Reference | SHA-256 | Decision |
| --- | --- | --- |
| `1-Photo-1.jpg` (logo set) | `8346EAD35CE640D9A2B2938EBA726777DC638A5B030A6E830D27B38397CBFD70` | Unpublished. Raster artboard; no embedded creator/licence data; playful mascot does not match the adult-oriented release. |
| `2-Photo-2.jpg` (logo set) | `371DA0B4383D9A1FCAA5A324ADFA1ED7A37F47445277DE6A320D01F2F449DBF2` | Unpublished for the same reasons. |
| `3-Photo-3.jpg` (logo set) | `1A866FBF409D19FF814A1C4FD090BCF8B566E01E4EFA9E71EFE2ECC950FC006A` | Strongest reference, but unpublished pending the rights holder's commercial-use and derivative permission plus an original vector or transparent master. |

No background-removal, trace or generated derivative of these references is published. The original files remain untouched.

## Supplier product images — approved source and controlled derivatives

On 15 August 2026, the owner confirmed in the active project session that these supplier-provided images depict the product Docked will sell and approved their use for the Docked site. That owner confirmation is the recorded source authority for this release; no separate supplier licence document was furnished. The originals are retained unchanged in the local ignored `source-assets/supplier/docked-cruise-d2/` working directory and in the supplied attachment location; they are intentionally excluded from Git and the public Pages output.

| Original source | SHA-256 | Publication treatment |
| --- | --- | --- |
| `1-Photo-1.jpg` | `F4C500929324FCC589A328BA24DB5B459D61502E219F88DC4AB3B6734A3D9FE7` | Product/control crop only. The original headline and explanatory text callouts are not published; a non-text visual pointer near the control remains. |
| `2-Photo-2.jpg` | `AFE310554ECD1EF4E85DFEED8381EF2F217056DFB442DC578CCB90F3DF44B70E` | Product crop only. The original speed, load, runtime and qualitative safety graphics are not published or adopted as claims. |
| `3-Photo-3.jpg` | `72DDED0B06D1F916FCFF5A273258D441C3E7712602C0DDF8C931C276D3BB08CC` | Pool-use crop only. The original wattage and 360-degree movement graphics are not published or adopted as claims. |

The conversion script is `scripts/process-supplier-images.py`. It uses fixed crop boxes and deterministic resize/composition operations. It does not synthesize, reconstruct or generatively edit the depicted product.

The public repository intentionally contains the registered derivatives and their enforced hashes, not the three full supplier originals. A fresh clone therefore cannot regenerate the derivatives until the same three original files are restored to the ignored source directory; the script verifies their exact source hashes before processing. This is a deliberate public-repository boundary, not a claim of fully self-contained media reproducibility.

| Published derivative | SHA-256 |
| --- | --- |
| `cruise-d2-pool-1200.webp` | `20DF5BEB0C943D520B8046C0AECB17D91327C8B40D32E70B6CC86A3E53D62345` |
| `cruise-d2-pool-600.webp` | `CDE094AB9E31F36DFC94C97FF23C8B7BDAC0B0004C0592E5159BA636894E5ACA` |
| `cruise-d2-overview-1200.webp` | `997C319C86592B570726D22B3B5B5AFFACD2EB4F0EBBB898FE2B13C21A914214` |
| `cruise-d2-overview-600.webp` | `2657B7F06D570D7C2F60D8B345D095ECA10E728562CC563F3082F76F5EDF8BB2` |
| `cruise-d2-controls-1200.webp` | `70A780E4E1F8BF0A13FB98F5B14B6D56EB8883125F6D241373B34C15D76F5340` |
| `cruise-d2-controls-600.webp` | `E5E6DA93DA8256346D8B5A86AF56490DA5472827BD2B33E0DC9EF92CB8986DD8` |
| `cruise-d2-social-1200.jpg` | `852B87ACA39C0599C23EA7414892FE1B38362AADF262957A885CFF4AF601FAFF` |

## Website Ideas email lifestyle derivatives — approved 16 August 2026

The owner supplied `Website Ideas.eml` and, in the active project session on 16 August 2026, expressly approved implementing its unambiguous visual changes. The sender's suggestions are treated as design reference input; the owner's active-session confirmation is the publication decision. The two lifestyle sources were extracted byte-for-byte from the email into the ignored `source-assets/website-ideas-email-2026-08-16/` working directory. No separate supplier licence document was furnished in this step.

| Evidence item | Recorded value |
| --- | --- |
| Supplied email | `Website Ideas.eml`; 16,492,874 bytes; SHA-256 `E36E4DDB3AF0F525DFA1B37A2A1A70667301190A2CF7D6DFB6E119D18B63743D` |
| Email provenance | From Barry Dearing; subject `Website Ideas`; email date 15 August 2026 21:55:22 +0000 |
| Man source | `Man on Float.png`; 2,451,171 bytes; 1254 × 1254 RGB PNG; SHA-256 `DEAE3AEE4B7530E07BD47E9DB45B2C454EBB2E686E631722019F56BA28198CA9` |
| Woman source | `Girl on Float.png`; 2,238,899 bytes; 1254 × 1254 RGB PNG; SHA-256 `CAE11BD49147FE0DE4D49900B7CBBD55AD18CCD4F161EDDB9031F19C430E01AE` |
| Source integrity | Both extracted files exactly match the decoded email-attachment byte counts and SHA-256 hashes. C2PA inspection identifies `gpt-image v2.0` and `trainedAlgorithmicMedia` in both sources; the fact that Pillow did not expose the manifest during ordinary image decoding does not invalidate that provenance. |
| Man crop | Source box `(0, 200, 960, 840)`, a native 960 × 640 3:2 region. It excludes the headline/tagline, the 360-degree callout and the complete lower 46W/dual-motor panel. |
| Woman crop | Source box `(500, 180, 1124, 596)`, a native 624 × 416 3:2 region. It excludes the headline and “absolute comfort” sentence plus every textual feature label and inset. |
| Processing | Direct fixed crop, uniform Lanczos resize to 1200 × 800, downscale to 600 × 400, and WebP encoding at quality 88/method 6. No inpainting, reconstruction, product alteration or generative processing is performed in the derivative pipeline. This deterministic processing does not make the AI-credentialed sources documentary photographs. |

| Public derivative | Bytes | SHA-256 |
| --- | ---: | --- |
| `cruise-d2-lifestyle-man-1200.webp` | 182,812 | `F4000655664C9C191FA490741D69ED626B5DEA58AFCA31E6153A37FE5BAE5532` |
| `cruise-d2-lifestyle-man-600.webp` | 71,960 | `3F6DCFE50254F91A1C17172DB90969C92C26DFC6E136DC2893E9D395687B0221` |
| `cruise-d2-lifestyle-woman-1200.webp` | 101,998 | `FFC9A0077793CE2AEE2FA310FCCC175581089695900B5F6EC4B111381F76E89B` |
| `cruise-d2-lifestyle-woman-600.webp` | 47,006 | `1BD22C4389CE63B689AE22F6F1D7D579714D8669D9D32ED7BB30F50E921FF0FC` |

These derivatives preserve only source pixels from the supplied image regions, but the underlying source images are C2PA-declared trained-algorithmic media. They are published only with adjacent “Supplier lifestyle illustration” disclosures and alt text that identifies them as illustrations. Deterministic processing does not establish documentary authenticity or independently verify any product performance claim; no text from either source is carried into the derivatives.

The four extracted `Pics.zip` PNGs also carry C2PA metadata identifying `gpt-image v2.0` / `trainedAlgorithmicMedia`. They remain internal moodboard material because their product geometry conflicts across views. Their exclusion is not a suggestion that they alone are AI-originated: the feature-board, `Man on Float.png` and `Girl on Float.png` sources are also AI-credentialed, and their limited public use depends on explicit illustration labelling.

## Future documentary media

Before publishing any additional documentary product photograph, obtain and record:

- the exact supplied SKU/model shown from multiple angles;
- photographer or supplier identity and written commercial-use permission;
- permitted channels, territory, term, editing rights and restrictions;
- adult-only and safety review, with no contradictory operating context;
- confirmation that every visible component and accessory matches the delivered product.

The current public derivatives are owner-approved supplier depictions of the Docked product. AI-credentialed derivatives are presented as illustrations rather than documentary photography. Their surrounding supplier marketing graphics were deliberately excluded because source approval does not verify embedded numerical or performance claims.
