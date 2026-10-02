# Retained storefront archive — not public application assets

These original files are preserved for rollback and historical customer support. Next.js serves only `public/` plus application routes; this directory is never deployed as a static site or served by the application.

Do not publish the repository root with GitHub Pages for the replacement. The original production Pages deployment remains unchanged until an explicitly approved cutover. Historical orders and accounting data were not accessed, moved or deleted.

Retired URL handling is an explicit allowlist in next.config.ts. The previous homepage product fragments resolve to the new home because URL fragments never reach the server; no product URL is redirected into an actionable betting page.
