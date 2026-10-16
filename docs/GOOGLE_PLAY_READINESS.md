# Google Play readiness — preparation, not approval

Current review: 16 October 2026. Docked is a fantasy sports, digital collectibles and social application: **Collect. Compete. Connect.** Earlier betting-research reports are historical, not the present submission description.

See [Android and payments pre-launch review](PRELAUNCH_ANDROID_PAYMENTS.md) for inspected implementation, fixes, official policy sources, payment options, store listing draft and activation checklist.

The repository targets API36 and has a separately gated closed-test AAB workflow. The private beta uses a sideload signing identity, not a Play release. The ordinary Gradle release gate remains intact. No Play upload or commercial payment activation occurred in this review.

Outstanding external acceptance:

- Confirm Console package, upload key, Play App Signing and account-specific testing requirements.
- Resolve commercial product/transferability/prize/redemption policy, licensed content rights and provider/store approvals.
- Implement and verify provider purchases, existing-ledger issuance, refunds and reconciliation before real purchases.
- Complete privacy/Data safety, account deletion, content rating, support, moderation and reviewer access declarations.
- Validate the signed bundle and physical Android behaviour.

Owner-reported Console verification/billing setup is context, not independently verified store acceptance. Free beta credits remain the current operating recommendation.

The [community rules review draft](COMMUNITY_RULES_REVIEW_DRAFT.md) remains a draft until approved and rolled out with versioned consent and staffed moderation. Documentation and local tests do not establish compliance.
