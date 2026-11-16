import "server-only";
import { z } from "zod";
import { authClient } from "./auth";
import { requireOnboardingIdentity } from "./onboarding-identity";
import { db, rateLimitStatus } from "./db";
import {
  normalizedPhone,
  phoneDeliveryReady,
  verifiedPhone,
} from "../core/public-phone";
import { publicCustomersEnabled } from "../core/public-customer";
import {
  executePhoneChallenge,
  PhoneThrottleError,
} from "../core/phone-challenge";
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
  // A lost verification response may have already committed in Auth. Only the
  // same authenticated account and verified number can recover that outcome.
  if (verifiedPhone(who.user)) {
    if (value.action === "verify" && normalizedPhone(who.user.phone!) === phone)
      return { ok: true, verified: true };
    throw Error(
      "Your phone is already verified. Contact support to change it.",
    );
  }
  let retryAfterSeconds = 0;
  if (value.action === "send") {
    const cooldown = await rateLimitStatus(
      `phone:cooldown:${who.user.id}`,
      1,
      60,
    );
    retryAfterSeconds = cooldown.retryAfterSeconds;
    if (!cooldown.allowed)
      throw new PhoneThrottleError(
        "Please wait one minute before requesting another code.",
        retryAfterSeconds,
      );
  }
  const attempts = await rateLimitStatus(
    `phone:${value.action}:${who.user.id}`,
    value.action === "send" ? 3 : 6,
    3600,
  );
  if (!attempts.allowed)
    throw new PhoneThrottleError(
      "Too many attempts. Please try again later.",
      attempts.retryAfterSeconds,
    );
  // Account limits alone cannot bound SMS expenditure across malicious accounts.
  if (value.action === "send") {
    const global = await rateLimitStatus("public-phone-send:global", 30, 3600);
    if (!global.allowed)
      throw new PhoneThrottleError(
        "Phone verification is busy. Please try again later.",
        global.retryAfterSeconds,
      );
  }
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
  return {
    ...result,
    ...(value.action === "send" ? { retryAfterSeconds } : {}),
  };
}
