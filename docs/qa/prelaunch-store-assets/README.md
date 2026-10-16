# Store asset review package — not for upload

Four dimension-checked screenshots are prepared in `index.html` with source hashes and exact crop rectangles in `index.json`. They are **synthetic local browser fixtures**, not screenshots of an accepted Android build or live member accounts. Existing fixture labels and synthetic names are retained; no UI features, results or engagement were painted into screenshots.

Phone files are 412×824, tablet files are 1024×1703 and 1024×900. The images meet the checked basic PNG/no-alpha, dimension and maximum 2:1 aspect-ratio constraints. This is not Google Play content acceptance. They are below some recommended high-resolution promotional formats and include QA navigation; capture actual approved-build routes before submission. [Google preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)

The original 512×512 Docked icon was copied unchanged. Its existing rounded/glowing tile treatment and 24-bit PNG require store icon design/format review. No replacement logo was generated.

The 1024×500 feature graphic is now **prepared for owner review**, rendered from editable `feature-graphic-review.html` using the existing compact Docked wordmark at its original aspect ratio, the approved “Collect. Compete. Connect.” tagline and original CSS geometry. `feature-graphic-provenance.json` records the unchanged source-logo hash and output hash. The PNG was inspected after browser rendering. It contains no fabricated app UI, scores, financial claims or official team marks. It is not published or store-approved.

The owner comparison uses the original `OwnerDashboard` component and CSS from `c588d793`, rendered in the current isolated shell with synthetic data. It is not a recovered screenshot of the old live site. See [before provenance](../prelaunch-owner/before-c588d793/provenance.json) and [new dashboard acceptance](../prelaunch-owner/browser-1792154014484/acceptance.json). Owner operations screenshots are internal review evidence and excluded from the customer store screenshot set.

Inspected: original icon, phone collection/post-preview crops, tablet collection/detail, and desktop/mobile owner before/after. First baseline render failed because sandboxed Edge could not start; the same loopback-only harness succeeded outside that sandbox at 1440, 1024, 412 and 360 widths. No hosted request, store upload, member login or physical-device test occurred.

Reproduce with `node scripts/prelaunch-owner-before.mjs`, `node scripts/render-store-feature-graphic.mjs`, then `node scripts/prepare-store-review-assets.mjs`. These preserve originals and only write local evidence/temp files.
