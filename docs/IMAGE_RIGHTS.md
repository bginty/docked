> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Image rights and provenance

Reviewed and acquired: **3 October 2026**. Scope: the 12 images in `public/images/sports/` and the original sport pictograms. These are decorative sports-category assets. They do not depict Docked selections, prove data coverage, report results or imply a relationship with a bookmaker, athlete, competition or venue.

## Licence basis

Eight photographs were downloaded from the image URLs linked by their original Unsplash photo pages. Each page explicitly identified the image as free under the **Unsplash License**, rather than Unsplash+. The [official licence](https://unsplash.com/license), checked on the review date, permits commercial website use and modification without mandatory credit; unchanged resale and compiling a competing photo library are excluded. The [official website-use FAQ](https://help.unsplash.com/en/articles/2612317-can-i-use-unsplash-images-as-part-of-a-product-to-sell) confirms use on a website selling a service.

The photograph copyright licence does not itself grant rights over recognizable people, trademarks or other protected works in a photograph. [Unsplash terms, section 5](https://unsplash.com/terms). Photos were screened for those features. Close athlete portraits, readable betting advertisements and prominent team/sponsor branding were rejected. Selected venue photographs may retain small incidental banners or distant signage; Docked must not make those marks an endorsement or branding feature. This file records the source licence and visual review, not a model/property release or a blanket guarantee about third-party rights.

## Licensed photographs

All eight below use the [Unsplash License](https://unsplash.com/license). The linked name opens the exact source photo, rather than a search page. The publication date is supplied by the source. Acquisition and licence verification date for every row: **2026-10-03**.

| Local file | Photographer / source photo | Published (UTC) | Unsplash ID |
| --- | --- | --- | --- |
| `basketball.webp` | [Christian Rebero Twahirwa](https://unsplash.com/photos/beige-and-blue-basketball-court-ggtFONGaWTo) | 2019-11-28 | ggtFONGaWTo |
| `tennis.webp` | [Yucel M](https://unsplash.com/photos/aerial-view-of-tennis-field-yNFOHf-1Ays) | 2019-04-28 | yNFOHf-1Ays |
| `nfl.webp` | [Willian Justen de Vasconcellos](https://unsplash.com/photos/an-aerial-view-of-an-empty-football-field-S-Usi4bsTe4) | 2024-12-03 | S-Usi4bsTe4 |
| `cricket.webp` | [Swapnil Bhagwat](https://unsplash.com/photos/a-cricket-stadium-with-empty-stands-and-a-clear-sky-zXhuzlcri7s) | 2025-03-12 | zXhuzlcri7s |
| `baseball.webp` | [Francisco Gonzalez](https://unsplash.com/photos/aerial-photography-of-brown-baseball-field-surrounded-green-field-mytsAgMbMGI) | 2018-03-24 | mytsAgMbMGI |
| `ice-hockey.webp` | [Chris DeSort](https://unsplash.com/photos/an-indoor-ice-rink-with-a-hockey-goal--ofOCf-jen4) | 2022-02-11 | -ofOCf-jen4 |
| `motorsport.webp` | [Anton Shuvalov](https://unsplash.com/photos/race-track-starting-line-9EUwYOG3MVQ) | 2019-03-14 | 9EUwYOG3MVQ |
| `afl.webp` | [Dean Bennett](https://unsplash.com/photos/an-aerial-view-of-a-soccer-stadium-in-a-city-nlTtcVkNPgQ) | 2020-05-06 | nlTtcVkNPgQ |

The full CDN source URL, SHA-256 of each delivered WebP, dimensions, bytes, suggested focal position, useful alt text and 20px blurred preview are stored in [the asset manifest](../public/images/sports/manifest.json). CDN downloads requested `auto=format&fit=max&w=1600&q=85`. The originals were visually inspected before resizing and encoding with the existing Sharp dependency. No third-party photo was supplied as an image-generation input. Source frames and colours were preserved; UI crops use CSS positioning.

Specific review notes:

- Basketball: empty Kigali Arena, no identifiable people or prominent commercial mark.
- Tennis: overhead courts and tiny unidentifiable figures; no player/competition claim.
- NFL category: a generic Chicago multi-use American-football field with numbered yard lines. It is not represented as an NFL stadium or fixture. Original portrait framing is retained for centre cropping.
- Cricket: the source identifies Sydney Cricket Ground. Small distant venue signage remains incidental.
- Baseball: an empty recreational diamond in Anaheim; no MLB or professional-event claim.
- Ice hockey: an empty local rink; distant championship banners remain incidental.
- Motorsport: an unidentifiable helmeted rider from directly overhead at a start line; no series or rider identity claim.
- AFL category: the MCG viewed from the air, with no depicted AFL fixture or league endorsement. Distant city signage remains incidental.

Suggested credit wording, when a credits page is displayed: “Photo by [photographer] on Unsplash”, with the name linked to the corresponding source above. Credit is appreciated under this licence; it does not replace any other rights requirement.

## Generated decorative artwork

Three original scenes were generated using the **built-in OpenAI image generation tool**, following the local `imagegen` skill. No fallback CLI, user API credential, stock reference image or paid stock purchase was used.

| File | Origin | Delivered dimensions | Purpose |
| --- | --- | --- | --- |
| `hero-football.webp` | Original generated fictional night stadium | 1643 × 957 | Homepage hero; native resolution retained without upscaling |
| `football.webp` | Smaller derivative of the same generated hero | 1280 × 746 | Football category and related article cards |
| `horse-racing.webp` | Original generated fictional turf race | 1280 × 853 | Horse-racing category |
| `atmosphere-football.webp` | Distinct original generated empty stadium | 1280 × 853 | Quiet no-edge and educational context |

These are AI-generated illustrations with a photographic appearance, not photographs of a real game, race, person, venue or result. Do not caption them as documentary evidence. They contain no intended logos, sponsor names, recognizable athletes or real-person likenesses. The manifest identifies their generated origin and preserves the exact prompts. Generated-project provenance is recorded here without claiming a third-party stock licence or exclusivity.

The original PNGs remain in Codex's generated-images directory, while every final application asset is inside this repository. Optimisation only resized and encoded the inspected output to WebP.

## Original pictograms

`src/components/sport-icon.tsx` contains ten original monochrome geometric SVG compositions created for Docked: football, basketball, tennis, American football, horse racing, cricket, baseball, ice hockey, motorsport and AFL. They use generic equipment/field motifs, not team crests or league marks. No external icon package, copied logo, third-party SVG or stock licence is involved.

## Asset verification and maintenance

All 12 final WebPs were decoded and visually inspected after optimisation. They are locally served, with no runtime dependency on the stock-photo provider. Eleven are below 180 KiB; the portrait American-football source is 205 KiB to retain field detail. The hero is 141 KiB. The native hero is smaller than the initial 2400px aspiration; it was intentionally not upscaled. Frontend responsive image delivery can generate smaller variants.

The manifest contains `blurDataURL` for every image. Use the supplied focal position as a starting point and verify both desktop and mobile crops. Decorative duplicates beside an existing sport label may use empty alt text; use the descriptive manifest alt when an image conveys context independently.

### Static responsive derivatives

`node scripts/build-sport-images.mjs` (also `npm run images:build`) creates 49 smaller WebPs in `public/images/sports/responsive/` using the Sharp already supplied by the pinned Next dependency. It encodes at quality 75 and effort 6, preserving aspect ratio with ordinary one-pixel integer rounding. Registered widths are 320, 480, 640, 960 and 1280 only when strictly smaller than the master. Native-width requests use the unchanged original file, and no image is enlarged. There is no crop, recolouring, compositing or content change.

Every derivative inherits its corresponding master's Unsplash licence and photographer credit or its explicitly recorded AI-generated origin. The original 12 master files and original provenance manifest are preserved byte-for-byte. [The responsive manifest](../public/images/sports/responsive-manifest.json) records each derivative's master, master hash, width, height, bytes, quality and SHA-256, plus encoder versions and a canonical JSON hash of the original provenance manifest. Object keys are recursively sorted, array order is retained and whitespace is omitted before hashing its UTF-8 text; Git's LF/CRLF checkout conversion therefore does not change this provenance hash. Binary image hashes remain byte-exact. `src/content/sport-image-sizes.json` is the application registry; every entry includes its native width and sorted available smaller widths.

`node scripts/build-sport-images.mjs --check` checks all recorded hashes, registry paths and strict decoding without writing. JSON files are compared as parsed objects to tolerate checkout newline differences. Generation uses exact validated file paths, performs no deletion and verifies the master hashes before and after writing. These locally served files avoid the preview server's recurring runtime image-optimizer stalls; they add no external image service or data claim.

When replacing an asset, record a new source/licence review date, photographer, exact source photo, visual review, hash and dimensions. Do not infer rights from search thumbnails, Google Images, news pages, team websites or filename tags. Never turn these images into fake event/result records. Preserve the distinction between licensed photography and generated artwork.

## Exact generated prompts

### Hero / football

Use case: photorealistic-natural. Asset type: Docked sports website hero background. Generate an original cinematic generic professional association-football stadium at night, packed crowds rendered as distant anonymous specks, tiny unidentifiable players on the pitch, brilliant realistic floodlights, deep blue-hour sky, natural green grass and navy shadows. Panoramic landscape composition approximately 2400 by 1400 pixels, midfield view from the upper stands showing clear accurate football pitch geometry. Main illuminated pitch and sweeping stands concentrated toward the right; darker natural stadium shadow on the left provides quiet negative space for web copy added separately. Editorial sports photograph realism, authentic atmosphere, restrained contrast, no artificial neon. Absolutely no logos, brands, words, text, league marks, score graphics, identifiable people, club crests, watermarks, sponsor boards or betting advertisements. No overlaid text. This is decorative fictional sports atmosphere, not a real match record.

### Horse racing

Use case: photorealistic-natural. Asset type: decorative sports-category photograph for Docked website. Create an original cinematic wide photograph of a small pack of thoroughbred racehorses and riders galloping around a green turf racetrack, viewed from far away and slightly above through the quiet early-morning golden mist. Athletic movement, subtle flying turf, white curve of the rail, textured green grass. Landscape 3:2 composition, subject pack central with generous surrounding track so the photo crops cleanly to wide sports cards. All riders are tiny anonymous helmeted figures with faces entirely unresolvable, wearing plain unbranded silks; no numbers or lettering on horses or riders. Restrained natural editorial photography, realistic anatomy. No identifiable real people, no sponsors, logos, brands, words, signage, betting advertisements or watermarks. Fictional decorative sports atmosphere, not evidence of a real race or result.

### Quiet football atmosphere

Use case: photorealistic-natural. Asset type: quiet decorative football photograph for a sports-research website no-edge state. Original cinematic wide landscape photo of an empty generic professional association-football stadium immediately before dusk, freshly striped green grass, white goal at far end, neat rows of dark navy seats, floodlights beginning to glow in the cool blue evening. View from low in the stand looking diagonally across the pitch. Peaceful expectant atmosphere, restrained documentary photography, authentic pitch markings and architecture. Framing 3:2 landscape, pitch in lower half and seats in upper half, useful central composition for wide image crops. Absolutely no people, no logos, brands, club crests, stadium names, advertisements, text, words, scoreboard numbers or watermarks. This is fictional decorative stadium atmosphere, not a real match or result.
