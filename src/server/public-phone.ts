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
import { executePhoneChallenge } from "../core/phone-challenge";
import { isolatedPhoneTestIdentity } from "../core/isolated-public-preview.mjs";

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
  if (
    process.env.DOCKED_ISOLATED_PUBLIC === "true" &&
    !isolatedPhoneTestIdentity(process.env, who.user.id)
  )
    throw Error("Phone verification is not available for this account.");
  const value = request.parse(input);
  const phone = normalizedPhone(value.phone);
  if (verifiedPhone(who.user))
    throw Error(
      "Your phone is already verified. Contact support to change it.",
    );
  if (
    value.action === "send" &&
    !(await rateLimit(`phone:cooldown:${who.user.id}`, 1, 60))
  )
    throw Error("Please wait one minute before requesting another code.");
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
  const result = await executePhoneChallenge(
    { ...value, phone },
    who.user.id,
    client.auth,
  );
  if (value.action === "verify") {
    await db()`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'public_phone_verified',${who.user.id},'{"provider":"supabase-auth","phoneStoredHere":false}'::jsonb)`;
  }
  return result;
}
