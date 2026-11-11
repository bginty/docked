import { normalizedPhone, verifiedPhone } from "./public-phone";
type PhoneUser = { id: string; phone?: string; phone_confirmed_at?: string };
type Auth = {
  updateUser(value: { phone: string }): Promise<{ error: unknown }>;
  verifyOtp(value: {
    phone: string;
    token: string;
    type: "phone_change";
  }): Promise<{ error: unknown }>;
  getUser(): Promise<{ error: unknown; data: { user: PhoneUser | null } }>;
};
export type PhoneChallenge =
  | { action: "send"; phone: string }
  | { action: "verify"; phone: string; token: string };

const publicPhoneErrors = new Set([
  "Phone verification is not available yet.",
  "Phone verification is not available for this account.",
  "Phone verification is unavailable.",
  "Phone verification did not complete for this account.",
  "Phone verification is busy. Please try again later.",
  "Unable to send a code. Check your number or contact support.",
  "The code could not be verified. Check it or request a new code.",
  "Your phone is already verified. Contact support to change it.",
  "Please wait one minute before requesting another code.",
  "Too many attempts. Please try again later.",
  "Enter an Australian mobile number, starting with 04 or +614.",
]);
/** Only exact application messages cross the API; never provider diagnostics. */
export function publicPhoneErrorMessage(error: unknown) {
  return error instanceof Error && publicPhoneErrors.has(error.message)
    ? error.message
    : "Unable to verify your phone. Please sign in again or contact support.";
}
/** Normal user-session provider calls. No admin confirmation or stored OTP. */
export async function executePhoneChallenge(
  value: PhoneChallenge,
  userId: string,
  auth: Auth,
) {
  const phone = normalizedPhone(value.phone);
  try {
    const result =
      value.action === "send"
        ? await auth.updateUser({ phone })
        : await auth.verifyOtp({
            phone,
            token: value.token,
            type: "phone_change",
          });
    if (result.error) throw Error("Provider rejected challenge");
  } catch {
    throw Error(
      value.action === "send"
        ? "Unable to send a code. Check your number or contact support."
        : "The code could not be verified. Check it or request a new code.",
    );
  }
  if (value.action === "verify") {
    let result: Awaited<ReturnType<Auth["getUser"]>>;
    try {
      result = await auth.getUser();
    } catch {
      throw Error("Phone verification did not complete for this account.");
    }
    if (
      result.error ||
      result.data.user?.id !== userId ||
      !verifiedPhone(result.data.user) ||
      result.data.user.phone?.replace(/^\+/, "") !== phone.slice(1)
    )
      throw Error("Phone verification did not complete for this account.");
  }
  return { ok: true, verified: value.action === "verify" };
}
