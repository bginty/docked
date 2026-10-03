# Canonical Docked master D

Phase 4.5 supersedes the supplied pack's suggested header/standalone-mark variants. The owner selected the exact D already installed on their Samsung S24.

The immutable source is `public/brand/icons/docked-app-icon-1024.png` (1024 × 1024), SHA-256 `aa8f37eec82cef4974f5d1e5561591c2f620404c0218a1f0ffaf3cd9aefa180f`. It contains the approved blue D, navy rounded-square field and original edge pixels. No crop, tracing, recolouring or white-wedge substitution is allowed.

Web `BrandLogo` applies a 22% rounded image-container mask to the original square export's outer white corners. This does not crop the interior D, change its gradient or alter any source bytes. Android launcher artwork stays byte-identical to the installed v4 master.

`src/brand/canonical-logo.json` identifies that source and the public exact-byte copy `/brand/canonical/docked-master.png`. `BrandLogo` always uses that copy. A wordmark places ordinary DOCKED text beside it, without recreating the D. Supplied historical assets remain archived unchanged, but are not active logo choices.

`scripts/build-app-icons.mjs` generates platform containment/size derivatives, SVG containers embedding the exact PNG, favicon, splash and social composition. Existing Android launcher master bytes and supplied PWA size exports are preserved. Adaptive/splash raster bounds retain the guaranteed circular safe area. The social composition adds text around the unaltered icon.

The standalone offline shell embeds the exact master and validates its bytes before allowing it through the no-network CSP checks. Service-worker version `docked-public-offline-master-d-v3` updates only the public offline shell; private pages/data remain uncached. Share-card and OpenGraph server tracing explicitly include their canonical source files.

Regression coverage: canonical-copy and embedded SVG byte equality, no replacement SVG paths, launcher byte equality, safe-circle bounds and offline embedded bytes/CSP hashes.
