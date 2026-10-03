# Google Play readiness — blocked

The [proposed community rules and moderation operating plan](COMMUNITY_RULES_REVIEW_DRAFT.md)
is an unpublished owner-review draft. It has not been rolled into member terms,
accepted by users or staffed. Approval, a versioned terms/consent rollout and a
verified moderation/appeals operation remain submission prerequisites.

Checked against official sources on 3 October 2026. Docked has no approved Play listing, signing identity, verified production App Links, Firebase configuration or completed native Auth acceptance. No purchase, account registration, production upload or policy submission was made.

The separately authorised HTTPS preview APK is a sideloaded testing artifact using the existing preview package and debug signing identity. It is not a Google Play release or approval of the eventual production architecture. The Gradle release gate remains in place.

| Gate                    | Required before a release                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture            | Review the fixed, isolated HTTPS beta attachment for the intended distribution; complete native Auth, offline, lifecycle and security acceptance. It is separate from local development attachment. |
| Product/legal           | Written jurisdiction and age review of sports-price research, community tips, TAKE-price wording, promotions, affiliate links and competitions                                                      |
| Google Play eligibility | Explicit review of gambling and gambling-adjacent policy; do not infer eligibility because the app does not accept wagers                                                                           |
| Identity/signing        | Authorised developer account, organisation verification as applicable, retained signing/upload keys, Play App Signing and package ownership                                                         |
| API/device              | Target API 36, supported phones/tablets, orientation/keyboard/insets/back, real low-memory/network/restart testing                                                                                  |
| Testing                 | Internal test distribution and required closed testing; applicable new personal accounts require at least 12 continuously opted-in testers for 14 days before production access can be requested    |
| Privacy                 | Public privacy policy, truthful Data safety disclosure, retention/pseudonymisation explanation, in-app deletion and accessible external deletion route                                              |
| Safety/UGC              | Community reporting/blocking/moderation, objectionable content handling, terms acceptance, restricted access and appropriately rated content                                                        |
| Store content           | Genuine screenshots, support contact, accurate description, responsible-gambling resources and applicable IARC/age declaration; no guaranteed profit or manufactured record                         |
| Notifications           | Push remains disabled and does not require Firebase for this beta. Only if push is approved later: dedicated Firebase setup, token deletion, consent/quiet-hours/caps and explicit acceptance.      |

Google's gambling policy addresses apps that facilitate wagering and restrictions involving odds/performance companion functionality with gambling advertising. The price-analysis and community product needs a concrete policy assessment, including future bookmaker promotions. Technical compilation is not a policy approval. [Real-money gambling policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)

New mobile apps/updates currently require Android 16/API 36; the project targets 36. Recheck at actual submission. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

Account-specific testing and verification remain external dependencies. The closed-test rule applies to the accounts described by Google, rather than every existing organisation account. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [device verification](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en)

Data inventory for the future form includes account identifiers/email, optional profile details, selected jurisdiction/preferences, social text/photos, app interactions and permitted diagnostics; actual collection/sharing purposes and optionality must match the eventual release and every SDK. Do not declare "no data collected" merely because FCM is absent. [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

Deletion must be available both through the app and an external web resource meeting Google's requirements; the current member deletion flow alone is not a completed store declaration. Preserve necessary pseudonymous ledger/audit evidence with an explained retention basis. [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

Exact next prerequisites: authorised release origin and hosting decision; legal/policy sign-off; actual signing credentials kept out of Git; account verification/testing plan; real-device native acceptance; privacy/store declarations; dedicated FCM configuration only if push is approved. Gradle release builds remain blocked until these are resolved and a reviewed change removes the gate.
