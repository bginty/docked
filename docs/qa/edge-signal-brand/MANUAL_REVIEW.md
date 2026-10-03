# Edge Signal visual review

Reviewed against the supplied `docked-approved-brand-board.png` and `README_FOR_CODEX.md`. Source artwork is fingerprinted in `approved-source-assets.json`; the application uses the supplied raster artwork, not a reconstructed mark.

Readable viewport images inspected:

- `browser/homepage-320-viewport.png`: header logo, sign-in/join controls and wrapped navigation fit the narrow screen; hero copy and controls remain readable without horizontal overflow.
- `browser/homepage-1440-light-viewport.png`: wordmark has clear space, the navigation fits, blue primary controls and navy/white hero typography are distinct, and the stadium remains supporting imagery.
- `browser/DEMO-home-390-light-viewport.png`: standalone mark, utility controls and bottom navigation remain legible; the fixture label remains visible above the app shell.
- `browser/DEMO-profile-1440-light-viewport.png`: approved on-dark wordmark is legible on the navy sidebar; blue selection and primary action remain distinct. The losing arithmetic fixture is retained and visibly labelled fictional.
- `browser/results-390-footer-viewport.png`: the footer was scrolled into view and its image explicitly decoded. The supplied on-dark wordmark renders correctly at its original 1600×380 aspect ratio. The earlier blank-looking full-page capture was a screenshot/decode artifact, not an application defect; screenshot readiness now explicitly waits for decoding.

No distortion, decorative filters, shadow added to the mark, clipping or material visual defect was observed in these samples. Automated coverage separately checks the complete route/width/preference matrix, accessibility and loaded artwork identity. The app retains deliberate light controls under a dark OS preference; this is not a new dark-theme feature.

The member-style screenshots are isolated React fixtures with no authenticated session, database operation or real sporting performance. This review does not claim new live account acceptance, historical validation, strategy profitability or production deployment.
