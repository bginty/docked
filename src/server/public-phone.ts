import "server-only";
import { z } from "zod";
import { authClient } from "./auth";
import { requireOnboardingIdentity } from "./onboarding-identity";
import { db, rateLimit } from "./db";
import {
  normalizedPhone,
  phoneDeliveryReady,
  verifiedPhone,
} from "../core/public-phone";
import { publicCustomersEnabled } from "../core/public-customer";

const request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), phone: z.string().max(40) }).strict(),
  z
    .object({
      action: z.literal("verify"),
      phone: z.string().max(40),
      token: z.string().regex(/^[0-9]{6,10}$/),
    })
    .strict(),
]);
/** User-session Auth methods only; never admin phone_confirm or service keys. */
export async function publicPhoneCommand(input: unknown) {
  if (!publicCustomersEnabled() || !phoneDeliveryReady())
    throw Error("Phone verification is not available yet.");
  const who = await requireOnboardingIdentity();
  const value = request.parse(input);
  const phone = normalizedPhone(value.phone);
  if (verifiedPhone(who.user))
    throw Error(
      "Your phone is already verified. Contact support to change it.",
    );
  if (
    !(await rateLimit(
      `phone:${value.action}:${who.user.id}`,
      value.action === "send" ? 3 : 6,
      3600,
    ))
  )
    throw Error("Too many attempts. Please try again later.");
  // Account limits alone cannot bound SMS expenditure across malicious accounts.
  if (
    value.action === "send" &&
    !(await rateLimit("public-phone-send:global", 30, 3600))
  )
    throw Error("Phone verification is busy. Please try again later.");
  const client = await authClient();
  if (!client) throw Error("Phone verification is unavailable.");
  const result =
    value.action === "send"
      ? await client.auth.updateUser({ phone })
      : await client.auth.verifyOtp({
          phone,
          token: value.token,
          type: "phone_change",
        });
  if (result.error)
    throw Error(
      value.action === "send"
        ? "Unable to send a code. Check your number or contact support."
        : "The code could not be verified. Check it or request a new code.",
    );
  if (value.action === "verify") {
    const { data, error } = await client.auth.getUser();
    if (
      error ||
      data.user?.id !== who.user.id ||
      !verifiedPhone(data.user) ||
      data.user.phone?.replace(/^\+/, "") !== phone.slice(1)
    )
      throw Error("Phone verification did not complete for this account.");
    await db()`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'public_phone_verified',${who.user.id},'{"provider":"supabase-auth","phoneStoredHere":false}'::jsonb)`;
  }
  return { ok: true, verified: value.action === "verify" };
}
