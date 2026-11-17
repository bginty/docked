import assert from "node:assert/strict";

/** Preparation only. This module has no enable/send operation. Its caller must
 * verify a separately approved exact operator/plan before invoking any API. */
export function validateProductionPhoneWindow(plan, now = Date.now()) {
  assert.equal(plan?.version, 1);
  assert.equal(plan.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(plan.organizationId, "otldyeunbqabbcjydjpe");
  assert.match(plan.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(plan.approvalSha256, /^[a-f0-9]{64}$/);
  assert.match(plan.founderIdentitySha256, /^[a-f0-9]{64}$/);
  assert.match(plan.windowId, /^[a-z0-9-]{8,80}$/);
  assert.equal(plan.maximumAttempts, 1);
  assert.equal(plan.maximumReservedAudCents, 100);
  assert.equal(plan.attended, true);
  assert.equal(plan.signupEnabled, false);
  const starts = Date.parse(plan.startsAt), deadline = Date.parse(plan.until);
  assert(Number.isFinite(starts) && starts <= now && starts >= now - 300000);
  assert(deadline > now && deadline - starts <= 7200000);
  return { ...plan, deadline };
}

function safeAuth(config) {
  assert.equal(config.disable_signup, true);
  assert.equal(config.sms_autoconfirm, false);
  assert.equal(config.sms_otp_length, 6);
  assert.equal(config.sms_otp_exp, 300);
  assert(Number(config.sms_max_frequency) >= 60);
  assert(!String(config.sms_test_otp ?? "").trim());
  assert.equal(config.hook_send_sms_uri, "https://docked.com.au/api/webhooks/auth-sms");
  assert.equal(config.mfa_totp_enroll_enabled, true);
  assert.equal(config.mfa_totp_verify_enabled, true);
  assert.equal(typeof config.external_phone_enabled, "boolean");
  assert.equal(typeof config.hook_send_sms_enabled, "boolean");
  assert(!config.external_phone_enabled || config.hook_send_sms_enabled,
    "Phone must never be enabled without the budgeted hook");
}

function safeWindow(window, plan) {
  assert.equal(window.id, plan.windowId);
  assert.equal(window.budgetAudCents, 100);
  assert(Number.isInteger(window.reservedAudCents) && window.reservedAudCents >= 0 && window.reservedAudCents <= 100);
  assert(Number.isInteger(window.attempts) && window.attempts >= 0 && window.attempts <= 1);
  assert.equal(window.allowlistCount, 1);
  assert.equal(window.founderIdentitySha256, plan.founderIdentitySha256);
  assert.equal(Date.parse(window.startsAt), Date.parse(plan.startsAt));
  assert.equal(Date.parse(window.until), plan.deadline);
  assert.equal(window.authoritySha256, plan.approvalSha256);
}

/** Hard database expiry/cap remain independent of this attended watchdog.
 * Shutdown closes only this window, then Phone+hook. It never replenishes,
 * deletes evidence, changes credentials/MFA, restores accounts or sends SMS. */
export async function watchProductionPhoneWindow(plan, api, options = {}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const p = validateProductionPhoneWindow(plan, now());
  const project = await api.project(p.projectRef);
  assert.equal(project.id, p.projectRef);
  assert.equal(project.organization_id, p.organizationId);
  assert.equal(project.status, "ACTIVE_HEALTHY");
  let armed = false, reason = "expiry", safetyFailure = false;
  let windowClosed = false, providerClosed = false;
  try {
    const initial = await api.config(p.projectRef);
    safeAuth(initial);
    assert.equal(initial.external_phone_enabled, false);
    assert.equal(initial.hook_send_sms_enabled, false);
    const window = await api.window(p.windowId);
    safeWindow(window, p);
    assert.equal(window.enabled, false);
    assert.equal(window.attempts, 0);
    assert.equal(window.reservedAudCents, 0);
    armed = true;
    await options.onReady?.();
    while (now() < p.deadline) {
      if (await options.stopRequested?.()) { reason = "manual-stop"; break; }
      safeAuth(await api.config(p.projectRef));
      safeWindow(await api.window(p.windowId), p);
      await wait(Math.min(15000, p.deadline - now()));
    }
  } catch {
    safetyFailure = true;
    reason = "safety-check-failed";
  } finally {
    // Independently attempt both barriers even if the other service is unavailable.
    for (let attempt = 0; attempt < 3 && (!windowClosed || !providerClosed); attempt++) {
      if (!windowClosed) {
        try {
          await api.closeWindow(p.windowId);
          const closed = await api.window(p.windowId);
          windowClosed = closed.id === p.windowId && closed.enabled === false;
        } catch { /* no sensitive error output */ }
      }
      if (!providerClosed) {
        try {
          await api.disable(p.projectRef, { external_phone_enabled: false, hook_send_sms_enabled: false });
          const final = await api.config(p.projectRef);
          providerClosed = final.external_phone_enabled === false && final.hook_send_sms_enabled === false;
          if (final.disable_signup !== true || final.mfa_totp_verify_enabled !== true) safetyFailure = true;
        } catch { /* closure must be independently observed */ }
      }
      if ((!windowClosed || !providerClosed) && attempt < 2) await wait(1000);
    }
  }
  if (!windowClosed || !providerClosed) throw Error("PRODUCTION_PHONE_CLOSURE_UNVERIFIED: independently close the named budget window and Auth Phone/hook");
  return { armed, reason, safetyFailure, windowClosed, providerClosed, enabledProvider: false, smsSent: 0, maximumAttempts: 1, maximumReservedAudCents: 100 };
}
