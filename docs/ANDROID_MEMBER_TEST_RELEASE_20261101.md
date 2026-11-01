# Internal Android member TEST build — 1 November 2026

Google Play shows **28 / 1.27-member-test available to internal testers**, release 6 on existing track 4701080901813472104. No public-track submission. Existing tester membership was not changed.

- Package: `docked.fantasy`; target SDK36; minimum24; non-debuggable.
- AAB: `artifacts/android/Docked-member-test.aab`.
- SHA-256: `89d8475aa14e88b4a201a9f836d34367287900bfd1a5f8c62bd8e98fc6108be2`.
- Upload certificate SHA-256: `be729f2e2cdbe7b582841b1e385e1b3fa9072036dc9dff984eae50fde9bd0173`; Play App Signing remains unchanged.
- Backend: `https://docked.com.au/app`; normal confirmed member session. No custom CA, QA launcher, synthetic account, mixed content or WebView debugging.
- Native product IDs come from `config/store-credit-package-drafts.json` only in `storeMemberTest`. Other variants default to an empty list. Receipt verification, member admission and actual crediting remain server-authoritative.
- v27 public-candidate AAB unchanged: `3e76cd5e0f0c15f7bcdc02b339d088ac3998a07f05233fa4b0188efe6f0d594e`. Do not promote v28 TEST-only build publicly; the final approved public build must use a newer version code and its separately reviewed configuration.
- Both Google products inactive; member purchase flag false; zero purchase admissions. Building/releasing this variant did not enable checkout or real settlement.
- Native build and lint passed: 0 errors, 34 warnings (existing resource/icon/manifest recommendations). Google accepted the bundle with two advisory warnings: absent obfuscation mapping (minification disabled) and native debug symbols. No supported-device loss versus v27; Google reports 7.83MB new install, 484KB update.
- Archive inspection found no configured server secrets or lab CA. Android signing verification passed.
- `adb devices -l`: no device attached. No v28 installation, session, checkout, refund or performance acceptance is claimed.

Evidence: `qa/customer-billing-20261101/android-member-test-artifact.json`, `android-member-test-build.txt`, `google-play-v28-internal.png`.

Next supervised test: use the authorised Play licence account and normal Docked member; activate only bounded isolated TEST admission and temporary approved test products for the session. Verify Google's explicit no-charge test method. Complete ordinary wallet/pack/refund/delayed approval/replay acceptance, then close admission/deactivate temporary products. Do not use a real payment method, reviewer/owner wallet as a disposable fixture, or bypass normal authentication. This requires an actual Play-enabled test device/environment; the native bridge cannot be proven by a synthetic browser provider.
