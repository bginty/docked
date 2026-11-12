/** Offline exact launch-copy proposal. Does not edit the published policy. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const source = "config/launch-policy-content.json";
const policy = JSON.parse(readFileSync(source, "utf8"));
const changes = [
  {
    document: "refund-policy",
    field: "status",
    text: "Australian commercial release. Google Play handles Android credit purchases. Consumer rights and the refund safeguards below apply.",
  },
  {
    document: "refund-policy",
    section: "Current availability",
    text: "Australian members aged 18 or over with an eligible, phone-verified account can purchase Docked Credits through Google Play and use them for Standard and Premium card packs. The checkout identifies the price and credit amount before confirmation. Docked Credits are not cash and cannot be withdrawn. Test credits, TEST orders and isolated test inventory remain separate from purchased credits and commercial packs. Paid competition entry, prizes and withdrawals are unavailable.",
  },
  {
    document: "refund-policy",
    section: "Approved paid-release products",
    title: "Credit packages and pack contents",
    text: "Google Play credit packages are A$49 for 4,900 Docked Credits and A$99 for 9,900, with no bonus credits. Google checkout displays the current price before confirmation. Credits can be used for NFL, AFL or NRL packs. Packs are priced in credits.\n\nStandard packs: 1 card for 100 credits; 3 for 300; 9 for 700. Premium packs: 1 card for 700 credits; 3 for 1,900; 9 for 5,000. A 9-card pack delivers nine permanent digital cards in one successful fulfilment. Review the sport, exact card count, price and available balance before confirming. A 4,900-credit package alone does not cover a 5,000-credit Premium 9-card pack.\n\nFor each Standard card slot, the rarity probabilities are Rare 85%, Elite 12%, Ultra Rare 2.5%, Legendary 0.49% and Icon 0.01%. For each Premium card slot, they are Ultra Rare 90%, Legendary 9.9% and Icon 0.1%. Core cards are excluded. These are probabilities for each card slot, not a guarantee of any rarity or player in a pack. A pack contains no duplicate player. If the required eligible supply cannot support the complete pack, the purchase fails without a partial debit or partial delivery; probabilities are not silently substituted. Repeating a completed request does not debit or deliver twice.\n\nSupply limits apply permanently per player and rarity across issuances: Core unlimited; Rare 5,000; Elite 2,500; Ultra Rare 400; Legendary 50; Icon 1. Existing legitimate issued copies consume these limits. Transfers, refunds and a player leaving a roster do not reset lifetime issuance. Cards are digital entitlements within Docked, not investments or ownership of a player, trademark or copyright. No particular player, resale value or financial return is guaranteed.",
  },
  {
    document: "refund-policy",
    section: "Release and consumer safeguards",
    title: "Consumer safeguards",
    text: "Unopened packs, completed openings and later card transfers are reviewed using the actual purchase evidence and applicable consumer law. There is no blanket forfeiture or no-refund rule. Opening a pack does not remove rights that cannot be excluded. Existing test balances do not convert into paid credits. Existing legitimate card ownership and lifetime supply records are preserved; inclusion in a historical collection does not automatically make a card eligible for new issuance or marketplace sale.",
  },
  {
    document: "commercial-policy",
    field: "status",
    text: "Australian adult commercial release with Google Play credit purchases, paid card packs and the separately enabled fixed-price marketplace. Scored competitions, prizes and withdrawals remain unavailable.",
  },
  {
    document: "commercial-policy",
    section: "Service scope",
    text: "Docked offers NFL, AFL and NRL digital collectible cards to Australian members aged 18 or over. Public accounts require verified email and an Australian mobile number, with one verified phone number linked to one Docked account. Phone verification establishes control of the number; it does not prove residency or that a person owns only one number. NBA is unavailable. Docked Credits have no cash withdrawal facility. Paid competition entry, prizes and withdrawals are unavailable.",
  },
  {
    document: "commercial-policy",
    section: "Gameplay and collections",
    text: "The six competition entries are labelled Practice and remain disabled. Real scored competitions and associated statistics are not enabled until their permissions and release checks are complete. Card ownership does not activate a competition or guarantee any game result. Existing legitimate cards and ownership history remain visible in the holder's collection after account verification. Historical test balances remain separate from purchased Docked Credits.",
  },
  {
    document: "commercial-policy",
    section: "Packs and marketplace",
    text: "Standard and Premium packs follow the prices, contents and rarity probabilities shown before purchase and in the Purchases and refunds notice. Successful fulfilment records all cards and their serials atomically. Opening the reveal displays cards already allocated to the account; a retry does not create extra copies.\n\nWhen the fixed-price marketplace is enabled, eligible opened commercial cards can be listed and purchased with Docked Credits. Existing preserved historical cards remain in their owners' collections and are not automatically eligible for sale. Offers and swaps are unavailable. A 5% selling fee is deducted when a card sells, capped at 2,000 whole credits per sale. There is no minimum fee. Buyers pay the displayed listing price. Fees round to the nearest whole credit; half a credit rounds up. A sale for 1,000 credits has a 50-credit fee and pays the seller 950 credits. Review shows the current price and fee before confirmation; a changed or expired review must be repeated.\n\nA successful sale transfers one card and settles the credit debit, seller proceeds and fee together. Pending or failed transactions do not confer ownership. Security, eligibility or refund-recovery holds can prevent a sale. There is no credit cash-out, peer-to-peer cash transfer or card export outside Docked. No resale market, financial return or continued buyer demand is guaranteed.",
  },
  {
    document: "commercial-policy",
    section: "Remaining release requirements",
    title: "Rights and service restrictions",
    text: "Docked uses verified player identities and original generic card artwork. No affiliation or endorsement by players, clubs or leagues is implied. Professional names do not confer rights to official photographs, logos, protected artwork or proprietary statistics. Required source acknowledgements are provided through the source notices. NBA, real scored competitions, paid entry, prizes, withdrawals, swaps and offers remain unavailable unless separately reviewed and released. Customer support is available at support@docked.com.au.",
  },
];
const replacements = changes.map((change) => {
  const doc = policy.documents.find((d: any) => d.id === change.document);
  const before = change.field
    ? doc[change.field]
    : doc.sections.find((s: any) => s.title === change.section);
  if (!before) throw Error("Policy source drift");
  return {
    ...change,
    expectedBeforeSha256: createHash("sha256")
      .update(JSON.stringify(before))
      .digest("hex"),
  };
});
const result = {
  approved: false,
  source,
  sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"),
  purpose:
    "Apply only during separately approved revenue activation, with a new terms version and recorded consent; no publication or feature activation is authorised.",
  phonePrivacyPackageUnchanged: true,
  requiresMarketplaceGateForMarketplaceStatus: true,
  requiresUpdatedGoogleReviewAssessment: true,
  replacements,
};
writeFileSync(
  "docs/qa/v31-revenue-launch-20261113/launch-wording.NOT-APPROVED.json",
  JSON.stringify(result, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  "Prepared exact launch wording; published config and consent versions unchanged.",
);
