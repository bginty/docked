# Static site asset register

Last reviewed: 15 August 2026 (AEST)

This register covers only assets intended for the public static site. It does not convert a supplied reference into documentary product evidence or establish intellectual-property rights that have not been provided.

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

These registered files are the complete published visual set. No undocumented visual may be published.

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

The four extracted `Pics.zip` PNGs carry C2PA metadata identifying `gpt-image v2.0` / trained-algorithmic media. Their product geometry conflicts across views. They remain internal moodboard material and are not product photography, documentary evidence, social media or advertising assets.

## Future documentary media

Before publishing any additional documentary product photograph, obtain and record:

- the exact supplied SKU/model shown from multiple angles;
- photographer or supplier identity and written commercial-use permission;
- permitted channels, territory, term, editing rights and restrictions;
- adult-only and safety review, with no contradictory operating context;
- confirmation that every visible component and accessory matches the delivered product.

The current public derivatives are approved depictions of the Docked product under the owner's supplier-source confirmation. Their surrounding supplier marketing graphics were deliberately excluded because this approval does not verify the embedded numerical or performance claims.
