/** Account-specific free testing; never a public US eligibility policy. */
export const namedTesterNoticeVersion = "2026-11-15-private-tester-v1";
export const namedTesterNotice = [
  "This invitation makes a personal exception to the Australian residency requirement in Docked's free beta rules. Your location is recorded as California, United States. It does not open US registration or give anyone else access.",
  "You may test Standard and Premium packs using credits supplied free by the founder. These credits cannot be bought, redeemed, withdrawn or transferred. Trading, cash purchases and prizes are unavailable.",
  "Pack openings can create permanent card records and consume the player's lifetime rarity supply. The test credits and cards have no cash value or promised resale value. Existing card records remain protected if test access ends.",
  "The remaining beta rules, Terms and Privacy notice still apply. This invitation does not enable commercial participation, live scored competitions or phone verification. Test access can be withdrawn, and it ends before a public or commercial launch unless separately reviewed.",
] as const;
export type NamedTesterSetup = {
  country: "US";
  state: "CA";
  version: typeof namedTesterNoticeVersion;
};
export function namedTesterConsentMatches(
  setup: NamedTesterSetup | null,
  input: {
    country: string;
    state: string;
    namedTesterRules?: boolean;
    namedTesterVersion?: string;
  },
) {
  return (
    !!setup &&
    input.country === setup.country &&
    input.state === setup.state &&
    input.namedTesterRules === true &&
    input.namedTesterVersion === setup.version
  );
}
