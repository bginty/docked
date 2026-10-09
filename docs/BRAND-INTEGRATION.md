> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Fantasy Cards Preview branding

Source: `C:/Users/61412/Desktop/DOCKED-Website-Mobile-Kit`. Read START-HERE.md, ASSET-MAP.md, asset-manifest.json and PREVIEW.html; inspected selected artwork directly. Originals remain untouched.

Runtime assets live in `public/brand/docked`; `src/brand/fantasy-assets.ts` maps them centrally. The horizontal logo serves desktop, compact wordmarks serve mobile, and the supplied stadium exports serve responsive heroes. Supplied splash, social image, favicon, Apple icon, PWA and maskable icons retain their original bytes. Thirteen required exports are included; the full source kit is not shipped.

Preview copy is “DOCKED — COLLECT. BUILD. COMPETE.” Fictional player cards use generic shirt shapes and invented teams. No official kits, player likenesses or sports-club marks were introduced.

`FANTASY_CARDS_PREVIEW=true` selects the updated native launcher and offline-shell branding. Native platform sizes contain/resize the supplied raster artwork, without tracing or redrawing it. The existing Edge artwork and default build path remain available.

Responsive browser screenshots and verified dimensions are recorded under `docs/qa/fantasy`. Browser emulation is distinct from actual Android verification; final delivery records the checks that actually ran.

## Mapping and checks

| Supplied exports | Screen/use |
|---|---|
| horizontal logo; compact 400w/800w wordmarks | Desktop sidebar/public header and mobile header |
| stadium desktop 1600w, tablet 1024w, mobile 750x750 | Homepage and desktop Play hero |
| splash logo 768w | Route loading state |
| open graph 1200x630 | Social metadata and image route |
| favicon; Apple 180; icon 192/512; maskable 512 | Browser, PWA installation and native source sizing |

The generated `public/brand/docked/offline.html` is an additional public fallback, not a supplied artwork export. The service worker stores only this unauthenticated document in Fantasy mode. Member pages/API responses remain network-only. The original `/offline.html`, canonical Edge PNG, embedded-raster SVG and legacy exports are retained for the existing default mode.

All five tabs were checked at 360, 390, 412, 430, 768 and 1440 CSS pixels: no overflow or broken images. Automated WCAG tests at 390 pixels passed after Social contrast fixes; no browser JavaScript errors remained. Desktop homepage, collection and mobile Play/Social screenshots were visually inspected. See `docs/qa/fantasy/visual.json` and the screenshot links in FANTASY-CARDS-DELIVERY.md.

Native APK build and security/embedded-branding audit passed. Pixel 5 emulator installation and activity launch succeeded, but Android Launcher/System UI ANRs blocked reliable interaction checks. Samsung S24 was approximated with a 412 CSS-pixel browser viewport; no physical-device verification is claimed. Supplied originals were not modified, and no bitmap was represented as a newly traced vector logo.
