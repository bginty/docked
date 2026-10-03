# Edge Signal brand verification

Scope: visual identity only. The approved source is Desktop `docked_production_brand_pack/README_FOR_CODEX.md`. The supplied marks must not be redrawn, recoloured, distorted, rotated or decorated with shadows. `approved-source-assets.json` records the original supplied bytes independently of repository copies.

No Supabase, account, jurisdiction, strategy or provider mutations are part of this task. The durable preview tester is not used. Existing authenticated-looking community fixtures are rendered only inside an isolated local browser page, labelled **DEMO · ISOLATED FICTIONAL UI · NO AUTHENTICATED SESSION · NO REAL DATA**. Their API calls are intercepted locally and never accepted as genuine operations or performance.

## Inventory handed to owners

- Web layout header/footer: textual wordmark and CSS D.
- Member AppShell sidebar/topbar: textual wordmark; official member/social avatars use initials.
- Browser/PWA: old `app/icon.svg`, `public/icons/docked.svg`, icon-generation script, manifest icon URLs and theme/background colors.
- OpenGraph, static social card and community share-image endpoint: old colors/text logo.
- Public offline page; Android source/generated offline shell, browser toolbar color and launcher/splash assets.
- Inline performance-chart strokes outside CSS; CSS palette values in all six stylesheet families.
- Current Resend adapter sends plain text only. There is no active HTML email-logo template to replace; all sending remains closed.

## Browser matrix

Public/no-account route states: `/`, `/home`, `/login`, `/join`, `/dashboard`, `/edges`, `/results`, `/community`, `/compose`, `/profile`, `/notifications`, `/learn/value-versus-winners`.

Check every route at 320, 390, 768 and 1440 px with the light OS preference, and at 390/1440 px with the dark OS preference. The application deliberately retains light control styling; dark OS preference is compatibility coverage, not a claim that a dark-theme toggle exists. Dark branded header/footer/hero surfaces are checked under both preferences.

Isolated member-style fixtures: home, composer, profile and notifications at the same widths in light preference plus 390/1440 in dark preference. No data is inserted. The fixture covers the authenticated shell and controls; public routes separately cover actual server routing and closed-access states.

Each page records decoded supplied-logo identity and aspect ratio, no logo filters/shadows/rotation, overflow, Axe WCAG A/AA findings, browser/runtime errors and failed local asset requests. Representative public buttons/text and dark surfaces receive computed contrast checks. Browser assets are checked against source-pack hashes. Screenshots and JSON receipts go only under `docs/qa/edge-signal-brand/`.

Additional browser checks inspect real favicon/PWA icon responses and offline-page branding, and verify no runtime Google font request. `/favicon.ico` and the 192/512 ordinary PWA icons are exact supplied-file aliases. The maskable 512 icon is a documented platform derivative: the complete approved 1024 master is proportionally contained in a centred 280-pixel square on navy, inside the safe circle. Its decoded centre pixels and canvas dimensions are checked against that source, not against an unrelated raw 512 export. The offline page embeds the exact approved on-dark PNG in a data URL; its decoded bytes and aspect ratio are checked directly. Sora must be loaded before width measurements; it is self-hosted. Genuine app API/auth/ledger rules are unchanged and existing regression tests remain separate.

Do not start the server or tests until the implementation owner marks the build ready. Existing regression evidence must use `DOCKED_QA_ROOT=docs/qa/edge-signal-brand/regression` to preserve prior milestone screenshots. This plan is not a passing test result.
