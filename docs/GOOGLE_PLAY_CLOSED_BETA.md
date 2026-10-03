# Docked Preview — closed testing preparation

Draft, 3 October 2026. This document is a review pack, not a claim that Play Console has been configured. Read [the policy review](GOOGLE_PLAY_POLICY_REVIEW.md) before submitting.

## Listing copy

**Name:** Docked Preview

**Short description:** Sports analysis, community discussion and transparent records. Closed beta.

**Full description draft:**

Docked is a sports analysis and community platform where members discuss sporting markets, follow transparent records and explore sports insights.

Explore five dedicated spaces: Edges, Feed, Following, Points and My Edge. Read educational explanations of market prices and uncertainty, share sports discussion, follow other members, and keep track of your own activity.

This invited Preview is for testing the app experience. Live official Docked Edges and outbound alerts are off while research validation and data setup remain pending. Any synthetic price or demonstration record is clearly labelled DEMO / PREVIEW PRICE and excluded from genuine performance and rankings. Points and other unconfigured metrics are shown as unavailable, never invented.

Docked does not accept wagers, hold funds or place bets. Analysis is informational and does not guarantee profit. You can use Docked without betting. Intended for adults meeting their local legal-age requirements. Gambling can cause harm; never chase losses.

BUILT FOR AN EDGE

**Release notes draft:** New app-first entry, compact login and onboarding, consistent master D identity, controlled invited Preview community access, labelled fixture submissions, useful learning content and mobile refinements. Please test login, posting, navigation, keyboard, background/resume and offline recovery. Providers and live publication remain off.

## URLs and declarations — owner must confirm

| Field                 | Prepared value / remaining decision                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy               | Candidate Preview resource: https://docked-preview-s24-briant-ginty.vercel.app/privacy — legal entity, retention, contact and stable public URL need owner verification before submission.                                                         |
| Support email         | OWNER TO SUPPLY a monitored address; do not invent one.                                                                                                                                                                                            |
| Website               | Owner to select a verified support/product URL. Existing docked.com.au is untouched.                                                                                                                                                               |
| External deletion URL | Prepared: https://docked-preview-s24-briant-ginty.vercel.app/account-deletion — web instructions link to the existing authenticated deletion flow. Owner must verify the public URL, retention schedule and inaccessible-account support workflow. |
| App access            | Dedicated least-privilege reviewer account, current instructions and access expiry owned by operator. Supply privately in Console.                                                                                                                 |
| Ads                   | Disabled in this build. Recheck every SDK and UGC promotion policy before declaring.                                                                                                                                                               |
| Audience              | Intended adult audience; owner completes questionnaire and receives actual rating.                                                                                                                                                                 |
| Countries             | No countries selected. Only legally reviewed closed-test territories after policy assessment.                                                                                                                                                      |
| Pricing               | No purchase or paid activation. Billing/prizes/affiliates disabled.                                                                                                                                                                                |

## Data Safety draft inventory

This is an engineering inventory, not pre-filled Console answers. Collection means off-device handling, including the hosted web app and backend, not only native SDK storage. Owner must review processor contracts and Google's definitions of sharing and service providers.

| Data                                                         | Current purpose / controls                                                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Email, account/user identifiers                              | Authentication and account management; unique private invite may confirm test access without asserting email ownership.       |
| Username, optional profile information                       | Member identity, visible only through authorised community views.                                                             |
| Country/state, age attestation, consent versions             | Access control and consent audit; no precise GPS permission.                                                                  |
| Sports, interests, timezone, notification preferences        | Personalisation and user-selected settings. Optional marketing unticked.                                                      |
| Posts, comments, optional photos, saved items, relationships | Social functionality, moderation and private account export/deletion. User-initiated media upload.                            |
| Immutable submitted Edge evidence                            | Transparency/audit; synthetic Preview records isolated. Retention/pseudonymisation needs legal confirmation.                  |
| App interactions                                             | Existing consent-controlled first-party analytics. No sportsbook passwords, wagers or customer losses tracked.                |
| Security/rate-limit and hosting logs                         | Abuse prevention and diagnosis; audit actual host defaults and retention before declarations.                                 |
| Push/device identifiers                                      | Android push registration not configured; no permission request or token collection added in this beta. Re-review if enabled. |

Authentication uses HTTPS and server cookies. Do not declare no data collection. Verify all bundled SDKs, any optionality, encryption, deletion, processors and retention against the exact AAB and hosted version. [Official Data Safety guide](https://support.google.com/googleplay/android-developer/answer/10787469)

## Artwork and screenshot specification

Use the canonical app-icon D recorded in the brand documentation; never redraw it. Keep PREVIEW visible. Include no profits, invented real users, live-tip claims or implied winning history.

- Store icon: 512×512, 32-bit PNG, up to 1024 KB; use exact master-derived supplied asset.
- Feature graphic: 1024×500, JPEG or 24-bit PNG with no alpha. Use the Docked palette, concise sports/community positioning and modest master mark. No fake product statistics.
- Phone screenshots: capture actual UI, JPEG or 24-bit PNG without alpha, 320–3840 px, longest dimension at most twice shortest. Capture at least two; planned set: Edges, Feed, Following, Points, My Edge, community post, member profile. A 1080×2160 viewport fits the constraint; do not stretch S24 screenshots to change the interface.
- Keep account details private and label preview seed users. Provide useful alt descriptions. Review 7-inch/tablet/other form factors only if distributed there.

Source: [Google asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en). Final screenshots and actual files are indexed in the Phase 4.5 QA report; this specification is not a claim of an uploaded listing.

## Owner’s Console workflow

1. Create/select the authorised Play Developer account, complete identity/developer profile and any device verification, and personally handle Google’s registration fee if applicable. No purchase has been made.
2. Confirm package ownership and Preview-only closed track; review the release signing guide. Keep upload keys/passwords outside Git and retain a secure backup. Configure Play App Signing personally or with explicit scoped authority.
3. Confirm the policy assessment, privacy/deletion/support URLs, Data Safety answers, content-rating and target audience. Review countries explicitly. Do not infer legal approval from tester access.
4. Upload the properly upload-key-signed AAB only after preflight. Add listing artwork/screenshots and release notes. No public production rollout.
5. Create a closed test email list or Google Group using the real consenting testers’ Google accounts; provide the opt-in link. App invitations and Google opt-in are separate gates.
6. Collect real device feedback and run Play’s pre-launch report. Certain personal accounts created after 13 November 2023 need at least 12 continuously opted-in testers for 14 days before applying for **production** access; it is not a reason to fabricate participants or claim production readiness here. [Official testing workflow](https://support.google.com/googleplay/android-developer/answer/14151465)

Signing, upload and submission are owner actions until their missing credentials/decisions are supplied. Independent code, direct-install Preview packaging and documentation can be completed now.
