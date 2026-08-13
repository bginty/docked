# Docked Shopify storefront

Docked is an Australian, adult-focused pool leisure storefront built as a native Shopify Online Store 2.0 theme. It supports powered pool floats, adult loungers, pool games, floating bars and coolers, pumps/care products and future genuine bundles.

The repository is deliberately **prelaunch by default**. Products are concepts/Draft records, purchasing controls are locked, and no live-payment or product-availability claim is made until supplier, compliance, imagery, commercial, operational and merchant gates pass.

## Foundation and provenance

- Base theme: Shopify Dawn `v16.0.0`
- Pinned upstream commit: `bc39a7d2024f1e5c14c42f855bd3552b4913e204`
- Docked theme version: `1.0.0`
- Architecture: Shopify Liquid, JSON templates, CSS and small vanilla-JavaScript web components
- Licence: Shopify's source-available terms in [LICENSE.md](LICENSE.md) remain intact

Dawn `main` is not used because it can include unreleased code. Future updates must be reviewed from stable tag to stable tag. Dawn v16 requires Shopify's **new customer accounts**; confirm the store's customer-account mode and app compatibility before publishing.

## What is included

- Original Docked wordmark, mark, wake and product-feature SVG system
- Responsive, editable multi-section homepage
- Native Dawn cart drawer/page, product forms, predictive search and storefront filtering
- Draft/prelaunch locks on product forms, quick-add, dynamic checkout and cart checkout controls
- Verified-metafield-only specifications and powered-float comparison
- Adult-only merchandising badges and optional age confirmation (off by default)
- Visible universal, powered and category-specific safety components
- Branded product, collection, cart, search, contact, FAQ, safety, how-it-works, tracking, password and 404 templates
- A 15-concept Draft catalogue, Australian competitor research and guarded pricing calculator
- Supplier, compliance, operations, GST, payments, SEO, analytics, rollback and launch runbooks

No competitor photography, copied listing copy, fabricated review, aggregate rating, artificial scarcity or invented product specification is included.

## Local validation

Prerequisites: a current Node.js LTS release and Shopify CLI 3.x for Theme Check/preview work.

```powershell
npm.cmd test
npm.cmd run validate
shopify theme check
```

For a real Shopify preview, authenticate to the correct non-production store and use a development or unpublished theme only:

```powershell
shopify theme dev --store your-store.myshopify.com
shopify theme push --unpublished --store your-store.myshopify.com
```

Never use `--allow-live` or publish from an unreviewed working tree. Preview browser tests use `SHOPIFY_PREVIEW_URL` when explicitly configured; they skip safely without it.

## Shopify Admin setup

Theme code cannot create or verify merchant records, products, menus, policies, payments, taxes, shipping or DNS. Follow [SHOPIFY_ADMIN_SETUP.md](docs/SHOPIFY_ADMIN_SETUP.md) and [OWNER_ACTIONS.md](OWNER_ACTIONS.md). In particular:

1. Create all catalogue records as **Draft** and leave unknown fields blank.
2. Define/populate only evidence-approved `custom.*` metafields.
3. Create the seven collections and configure the `main-menu` and `footer` navigation resources.
4. Assign the supplied alternate templates to the matching Shopify pages.
5. Keep `prelaunch_mode` enabled and the theme unpublished/password-protected.
6. Complete customer-account, GST/tax invoice, shipping, support, payment/refund and safety/compliance QA.
7. Obtain explicit owner go-live approval before product activation, theme publication, DNS cutover or live capture.

All consumer prices are intended to be AUD and GST-inclusive. Actual store tax configuration and compliant automatic Tax Invoices still require Admin setup and transaction testing.

## Important files

- [Owner actions](OWNER_ACTIONS.md)
- [Launch blockers](docs/LAUNCH_BLOCKERS.md)
- [Draft catalogue](data/draft-product-catalogue.csv)
- [Pricing research](docs/PRICING_RESEARCH.md)
- [Product evidence checklist](docs/PRODUCT_EVIDENCE_CHECKLIST.md)
- [Compliance register](docs/COMPLIANCE_REGISTER.md)
- [Safety copy register](docs/SAFETY_COPY_REGISTER.md)
- [Rollback plan](docs/ROLLBACK_PLAN.md)

## Legacy recovery

The previous finance site remains recoverable from remote branch `archive/docked-finance-site-2026-08` and annotated tag `docked-finance-site-before-pool-rebuild`. The public legacy deployment and DNS are not changed by this branch. See [LEGACY_SITE_INVENTORY.md](docs/LEGACY_SITE_INVENTORY.md) and [DNS_BEFORE_CHANGE.md](docs/DNS_BEFORE_CHANGE.md).

## Release state

The expected handoff state is **Code Complete - Owner Action Required**, not Production Live. A source-complete theme does not prove that products, Shopify Admin, provider accounts, shipping, support, policies, DNS or real checkout are launch-ready.
