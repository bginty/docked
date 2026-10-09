# Current Android acceptance

Docked is a fantasy sports card platform. See docs/PRODUCT_DIRECTION.md.

Docked-v10-Fantasy-Bundled-QA.apk is a local debug-signed bundled QA shell, versionCode 10 / 1.9-preview, using the supplied fantasy icon. It has NO remote application origin and does not establish connected gameplay acceptance. Do not distribute it as a finished friends-and-family app.

Protected Preview retains Vercel authentication and separate admission/gameplay gates. Physical S24 sign-in, keyboard, resume, sharing and connected gameplay remain unverified. See docs/qa/fantasy-cleanup/apk-audit.json for the credential scan.

Previous APKs were preserved by content hash in ignored private-data/android/apk-archive. Older manifests are historical receipts. Their prior delivery README is in legacy/retired-product/artifacts/android. No Play upload or production release was performed.
