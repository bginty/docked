/** Explicit preview discussion copy for an operator-reviewed seeding run only.
 * Never imported by feed queries, recommendation/ranking code or app routes. */
export const previewSocialSeed = [
  {
    key: "price-basics",
    kind: "question",
    sport: "football",
    body: "[PREVIEW TEST POST] What would you check before comparing two prices? Discuss event identity, regulation or overtime rules, and source age. This is a beta discussion prompt, not a current fixture, tip or result.",
  },
  {
    key: "take-threshold",
    kind: "discussion",
    sport: "basketball",
    body: "[PREVIEW TEST POST] Try reading a DEMO Edge card: what is the difference between TAKE, the captured reference and the current observation? All example prices in fixture mode are fictional and excluded from real records.",
  },
  {
    key: "transparent-records",
    kind: "discussion",
    body: "[PREVIEW TEST POST] Why should a permanent record keep its losses? Use this thread to test replies and saves. No sporting outcome or performance claim is being made, and no account in this seed set is a genuine public member.",
  },
  {
    key: "beta-feedback",
    kind: "question",
    body: "[PREVIEW TEST POST] Friends-and-family usability check: can you follow this clearly marked test profile, save this post and find it again? Please keep personal or account details out of replies. These are preview test interactions.",
  },
] as const;
