/** Owner launch scope. Admission/rights/commerce gates remain additional checks.
 * Keeping a sport here does not approve public registration or real payments.
 * Hidden sports retain their database configuration for a separately reviewed activation. */
export const customerSports = ["nfl", "afl", "nrl"] as const;
export type CustomerSport = (typeof customerSports)[number];
export const hiddenCustomerSports = ["basketball"] as const;
export function isCustomerSport(value: unknown): value is CustomerSport {
  return customerSports.some((sport) => sport === value);
}
export function isHiddenCustomerSport(value: unknown) {
  return hiddenCustomerSports.some((sport) => sport === value);
}
export function assertCustomerSport(
  value: unknown,
): asserts value is CustomerSport {
  if (!isCustomerSport(value))
    throw Error("This sport is currently unavailable.");
}
