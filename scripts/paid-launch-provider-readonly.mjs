/** GET-only provider checks. No credentials, numbers, OTPs or message bodies logged. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { managementToken } from "./lib/supabase-management-read.mjs";
let phase = "credential-file";
try {
  const c = JSON.parse(
    fs.readFileSync(
      "C:/Users/61412/.docked-secrets/docked-production-sms-readiness.json",
    ),
  );
  const account = c.accountSid,
    service = c.messageServiceSid ?? c.messagingServiceSid,
    token = c.authToken;
  assert(
    /^AC[0-9a-f]{32}$/i.test(account) &&
      /^MG[0-9a-f]{32}$/i.test(service) &&
      /^[0-9a-f]{32}$/i.test(token),
  );
  const get = async (url, bearer) => {
    const r = await fetch(url, {
      headers: { Authorization: bearer },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    assert(r.ok, "Provider GET unavailable");
    return r.json();
  };
  const auth = "Basic " + Buffer.from(account + ":" + token).toString("base64");
  phase = "twilio-tariff";
  const price = await get(
    "https://pricing.twilio.com/v1/Messaging/Countries/AU",
    auth,
  );
  assert.equal(price.iso_country, "AU");
  assert.equal(price.price_unit, "USD");
  const rates = price.outbound_sms_prices.flatMap((r) =>
    r.prices.map((p) => Number(p.current_price)),
  );
  assert(rates.length > 0 && rates.every((n) => Number.isFinite(n) && n > 0));
  const maxPrice = Math.max(...rates),
    bound = ((maxPrice + 0.025 + 0.015 + 0.001) / 0.5) * 1.1 * 1.1 * 2;
  assert(bound < 1, "A$1 reservation no longer conservatively supported");
  phase = "existing-service";
  const s = await get(
    "https://messaging.twilio.com/v1/Services/" + service,
    auth,
  );
  assert.equal(s.account_sid, account);
  const senders = await get(
    "https://messaging.twilio.com/v1/Services/" +
      service +
      "/AlphaSenders?PageSize=1000",
    auth,
  );
  assert(!senders.meta.next_page_url);
  assert(senders.alpha_senders.some((s) => s.alpha_sender === "DOCKED"));
  phase = "balance";
  const balance = await get(
    "https://api.twilio.com/2010-04-01/Accounts/" + account + "/Balance.json",
    auth,
  );
  assert.equal(balance.account_sid, account);
  phase = "production-auth";
  const management = managementToken();
  const project = await get(
    "https://api.supabase.com/v1/projects/pojoymtniryarxxunyvz",
    "Bearer " + management,
  );
  assert.equal(project.organization_id, "otldyeunbqabbcjydjpe");
  assert.equal(project.status, "ACTIVE_HEALTHY");
  const a = await get(
    "https://api.supabase.com/v1/projects/pojoymtniryarxxunyvz/config/auth",
    "Bearer " + management,
  );
  assert.equal(a.disable_signup, true);
  assert.equal(a.external_phone_enabled, false);
  assert.equal(a.hook_send_sms_enabled, false);
  assert.equal(a.mfa_totp_enroll_enabled, true);
  assert.equal(a.mfa_totp_verify_enabled, true);
  const report = {
    at: new Date().toISOString(),
    passed: true,
    methods: ["GET"],
    productionWrites: 0,
    smsSent: 0,
    twilio: {
      existingCredentialAccepted: true,
      existingServiceMatched: true,
      dockedSenderPresent: true,
      acceptedSenderEvidenceReused: true,
      currency: price.price_unit,
      auNetworkRates: rates.length,
      maxPrice,
      conservativeAudBound: bound,
      reservationAud: 1,
      fundedBalance: Number(balance.balance),
      balanceCurrency: balance.currency,
      providerSettingsWritten: 0,
      noAutomaticRechargeEvidence:
        "Reuse accepted 17-Nov SMS_DECISION; no new recharge-setting inspection claimed",
    },
    auth: {
      signupDisabled: true,
      phoneOff: true,
      hookOff: true,
      totpPreserved: true,
      emailAutoconfirm: a.mailer_autoconfirm === true,
      smtpConfigured: !!(a.smtp_host && a.smtp_admin_email),
      otpLength: a.sms_otp_length,
      otpSeconds: a.sms_otp_exp,
      minimumFrequency: a.sms_max_frequency,
      signedHookConfigured: !!a.hook_send_sms_uri,
    },
  };
  fs.writeFileSync(
    "docs/qa/paid-launch-final-20261118/provider-readonly.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch {
  console.error(
    "Read-only provider verification stopped at " +
      phase +
      "; no private response emitted and no writes/sends.",
  );
  process.exitCode = 1;
}
