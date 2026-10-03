# Exact changed-file inventory

Compared with the initial clean `0b1de08` state. `A` means added; `M` means modified. The complete machine-readable list, including every screenshot, is [changed-files.json](changed-files.json). No database migration or production API handler changed. APK binaries remain Git-ignored durable deliverables.

## Application source

- `M` `src/app/brand-theme.css`
- `M` `src/app/dashboard/page.tsx`
- `A` `src/app/feed/loading.tsx`
- `A` `src/app/feed/page.tsx`
- `A` `src/app/following/loading.tsx`
- `A` `src/app/following/page.tsx`
- `M` `src/app/home/page.tsx`
- `M` `src/app/layout.tsx`
- `M` `src/app/manifest.ts`
- `A` `src/app/mobile-app.css`
- `A` `src/app/my-edge/loading.tsx`
- `A` `src/app/my-edge/page.tsx`
- `M` `src/app/native.css`
- `A` `src/app/points/loading.tsx`
- `A` `src/app/points/page.tsx`
- `M` `src/components/app-edge-board.tsx`
- `M` `src/components/app-icon.tsx`
- `A` `src/components/app-member-screens.tsx`
- `A` `src/components/app-member-ui.tsx`
- `A` `src/components/app-screen-loading.tsx`
- `M` `src/components/app-shell.tsx`
- `M` `src/components/community-feed.tsx`
- `M` `src/components/community-performance.tsx`
- `A` `src/components/edge-board-header.tsx`
- `M` `src/components/edge-card.tsx`
- `M` `src/components/native-bridge.tsx`
- `A` `src/components/pinned-docked-empty.tsx`
- `M` `src/components/pinned-docked.tsx`
- `M` `src/components/social-interactions.tsx`
- `A` `src/components/social-timeline.tsx`
- `M` `src/core/native-navigation.ts`
- `M` `src/proxy.ts`

## Native packaging, manifests and acceptance tools

- `M` `android/app/build.gradle`
- `A` `artifacts/android/manifest-v3.json`
- `M` `artifacts/android/manifest.json`
- `M` `artifacts/android/README.md`
- `M` `capacitor.config.ts`
- `M` `config/android-preview.json`
- `M` `scripts/android-debug.mjs`
- `M` `scripts/configure-hosted-preview.mjs`
- `A` `scripts/hosted-preview/mobile-ux-acceptance.ts`
- `A` `scripts/hosted-preview/mobile-ux-browser.ts`

## Tests and isolated fixtures

- `M` `tests/browser/brand-native.test.ts`
- `M` `tests/browser/brand-rollout.test.ts`
- `A` `tests/browser/mobile-app.test.ts`
- `M` `tests/browser/phase3.test.ts`
- `A` `tests/fixtures/bundle-community.ts`
- `M` `tests/fixtures/community-demo.tsx`
- `M` `tests/fixtures/render-experience.ts`
- `A` `tests/hosted/mobile-ux/guard.ts`
- `A` `tests/platform/mobile-card-presentation.test.ts`
- `A` `tests/platform/mobile-ux-acceptance-guard.test.ts`
- `M` `tests/platform/native-navigation.test.ts`

## Documentation and evidence

- `M` `docs/BUILD_STATUS.md`
- `A` `docs/qa/mobile-app-ux/android/apk-audit.json`
- `A` `docs/qa/mobile-app-ux/android/apk-build.json`
- `A` `docs/qa/mobile-app-ux/android/apk-details-v3-comparison.json`
- `A` `docs/qa/mobile-app-ux/android/apk-extraction.json`
- `A` `docs/qa/mobile-app-ux/android/apk-strong-secret-scan.json`
- `A` `docs/qa/mobile-app-ux/android/assets-secret-scan.json`
- `A` `docs/qa/mobile-app-ux/android/BUILD_COMMANDS.md`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/apk-audit.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/apk-build.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/apk-details-v3-comparison.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/apk-extraction.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/apk-strong-secret-scan.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/artifact-manifest.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/assets-secret-scan.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/native-config-and-preservation.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/preflight.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/preservation.json`
- `A` `docs/qa/mobile-app-ux/android/initial-candidate/README.md`
- `A` `docs/qa/mobile-app-ux/android/native-config-and-preservation.json`
- `A` `docs/qa/mobile-app-ux/android/preflight.json`
- `A` `docs/qa/mobile-app-ux/android/README.md`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-1440-dark.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-1440-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-320-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-390-dark.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-390-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/DEMO-768-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-1440-dark.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-1440-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-320-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-390-dark.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-390-light.json`
- `A` `docs/qa/mobile-app-ux/brand-browser/public-768-light.json`
- `A` `docs/qa/mobile-app-ux/brand320-rerun.json`
- `A` `docs/qa/mobile-app-ux/browser-final-results.json`
- `A` `docs/qa/mobile-app-ux/browser-results.json`
- `A` `docs/qa/mobile-app-ux/CHANGED_FILES.md`
- `A` `docs/qa/mobile-app-ux/changed-files.json`
- `A` `docs/qa/mobile-app-ux/deployment-source-audit.json`
- `A` `docs/qa/mobile-app-ux/deployment-source-final-audit.json`
- `A` `docs/qa/mobile-app-ux/evidence-secret-scan.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T10-58-24-688Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T10-59-58-178Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T11-01-00-174Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T11-03-16-169Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T11-05-36-501Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosted/2026-10-03T11-13-47-878Z/results.json`
- `A` `docs/qa/mobile-app-ux/hosting-audit.json`
- `A` `docs/qa/mobile-app-ux/hosting-initial-audit.json`
- `A` `docs/qa/mobile-app-ux/local-validation-exits.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-1366.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-360.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-390.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-412.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-following-suggestions-1366.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-following-suggestions-360.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-following-suggestions-390.json`
- `A` `docs/qa/mobile-app-ux/mobile-app/DEMO-following-suggestions-412.json`
- `A` `docs/qa/mobile-app-ux/OPERATOR_ACCEPTANCE.md`
- `A` `docs/qa/mobile-app-ux/operator/cleanup.json`
- `A` `docs/qa/mobile-app-ux/operator/plan.json`
- `A` `docs/qa/mobile-app-ux/operator/provision.json`
- `A` `docs/qa/mobile-app-ux/README.md`
- `A` `docs/qa/mobile-app-ux/validation-initial.json`
- `A` `docs/qa/mobile-app-ux/validation.json`
- `A` `docs/qa/mobile-app-ux/web-regression/public-1366.json`
- `A` `docs/qa/mobile-app-ux/web-regression/public-1920.json`
- `A` `docs/qa/mobile-app-ux/web-regression/public-390.json`
- `A` `docs/qa/mobile-app-ux/web-regression/public-430.json`
- `A` `docs/qa/mobile-app-ux/web-regression/public-768.json`
- `A` `docs/qa/mobile-app-ux/web-regression/sports-regression/browser-1366.json`
- `A` `docs/qa/mobile-app-ux/web-regression/sports-regression/browser-1920.json`
- `A` `docs/qa/mobile-app-ux/web-regression/sports-regression/browser-390.json`
- `A` `docs/qa/mobile-app-ux/web-regression/sports-regression/browser-430.json`
- `A` `docs/qa/mobile-app-ux/web-regression/sports-regression/browser-768.json`

## Screenshots and binary delivery

394 new PNG evidence files are individually listed in the JSON inventory, including labelled isolated fixtures and genuine disposable-account acceptance. Earlier milestone evidence remains intact.

Final APK: `artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk`. Actual v3 and the initial undelivered v4 candidate are preserved as documented in the artifact manifest and Android report.
