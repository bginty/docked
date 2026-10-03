# Production presentation checks

These checks cover source changes and isolated components, not a production deployment or an account/email acceptance run.

- Four focused platform tests passed: current tip eligibility and cutoff, unknown anonymous jurisdiction versus authenticated restrictions, explicit operator facts, and production robots/canonical origin with stable PWA identity.
- Three isolated browser cases passed at 320, 412 and 1366 pixels in 15.502 seconds. Production signup/recovery are disabled when unavailable, Preview and invitation controls are absent in production, required consents remain separate and unchecked, marketing remains unchecked, and ready production/approved-preview variants retain their respective controls. No API request was made.
- Automated accessibility, overflow and console checks passed. Mobile and desktop screenshots were visually inspected.
- Type checking and scoped ESLint passed. Full integrated build/browser acceptance is coordinated separately.

The initial isolated browser run reached its UI assertions but failed its console check because its fake localhost page triggered a real service-worker script fetch. The fixture now uses an intercepted non-secure `.invalid` origin; every network request is fulfilled locally, and PWA lifecycle remains covered by the existing dedicated suite. The initial receipt is retained as `presentation-browser-initial-harness.json`; final results are `presentation-browser.json`. No production assertion was removed.

Production operator details are read only from `DOCKED_LEGAL_NAME`, `DOCKED_ABN`, `DOCKED_SUPPORT_EMAIL` and/or an HTTPS `DOCKED_SUPPORT_URL`. Missing facts remain explicitly unconfirmed. Terms and Privacy version identifiers use the backend's shared consent helper; this work does not approve legal documents or enable registration, email, publication or providers.

Existing integrated expectations now reflect the intentional anonymous research-pending state rather than claiming an unknown visitor is in a restricted region. PWA startup uses `/app` for the account/onboarding gate while its installed identity remains `/home`.
