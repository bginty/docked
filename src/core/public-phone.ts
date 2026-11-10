/** Phone control is independent of launch switches and never replaces staff MFA. */
export const verifiedPhoneRequired = "Verified phone required";
export function normalizedPhone(value: string) {
  const phone = value.trim().replace(/[ ()-]/g, "");
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone))
    throw Error("Enter a phone number with its country code, for example +61.");
  return phone;
}
export function verifiedPhone(
  user: { phone?: string; phone_confirmed_at?: string },
  now = Date.now(),
) {
  const timestamp = Date.parse(user.phone_confirmed_at ?? "");
  return (
    /^\+?[1-9][0-9]{7,14}$/.test(user.phone ?? "") &&
    Number.isFinite(timestamp) &&
    timestamp <= now
  );
}
export function phoneDeliveryReady(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.DOCKED_PUBLIC_CUSTOMERS === "true" &&
    env.DOCKED_BETA_STAGING !== "true" &&
    env.DOCKED_PUBLIC_PHONE_OTP === "true" &&
    (env.DOCKED_PUBLIC_PHONE_POLICY_REFERENCE?.trim().length ?? 0) >= 16
  );
}
