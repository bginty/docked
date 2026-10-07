# Fantasy Cards Preview branding

Source: `C:/Users/61412/Desktop/DOCKED-Website-Mobile-Kit`. Read START-HERE.md, ASSET-MAP.md, asset-manifest.json and PREVIEW.html; inspected selected artwork directly. Originals remain untouched.

Runtime assets live in `public/brand/docked`; `src/brand/fantasy-assets.ts` maps them centrally. The horizontal logo serves desktop, compact wordmarks serve mobile, and the supplied stadium exports serve responsive heroes. Supplied splash, social image, favicon, Apple icon, PWA and maskable icons retain their original bytes. Thirteen required exports are included; the full source kit is not shipped.

Preview copy is “DOCKED — COLLECT. BUILD. COMPETE.” Fictional player cards use generic shirt shapes and invented teams. No official kits, player likenesses or sports-club marks were introduced.

`FANTASY_CARDS_PREVIEW=true` selects the updated native launcher and offline-shell branding. Native platform sizes contain/resize the supplied raster artwork, without tracing or redrawing it. The existing Edge artwork and default build path remain available.

Responsive browser screenshots and verified dimensions are recorded under `docs/qa/fantasy`. Browser emulation is distinct from actual Android verification; final delivery records the checks that actually ran.
