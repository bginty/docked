import assert from "node:assert/strict";

const projects = {
  bckkllmndoxzpzdqrevb: "ernfnkcbalhyqpsrzdwa",
  pojoymtniryarxxunyvz: "otldyeunbqabbcjydjpe",
};

/** Operator preparation, not authority. The caller must verify the exact reviewed
 * plan/approval before arming. This module contains no enable/send operation. */
export function validatePhoneWindow(plan, now = Date.now()) {
  assert(plan && plan.schemaVersion === 1);
  assert(projects[plan.projectRef] === plan.organizationId);
  assert(/^[a-f0-9]{40}$/.test(plan.sourceCommit));
  assert(/^[a-f0-9]{64}$/.test(plan.memberSetSha256));
  const starts = Date.parse(plan.startsAt),
    until = Date.parse(plan.until);
  assert(Number.isFinite(starts) && Number.isFinite(until));
  assert(
    starts <= now && starts >= now - 300000,
    "Arm within five minutes of attended start",
  );
  assert(until > now && until - starts <= 2 * 3600000 && until > starts);
  assert(plan.maximumAttempts === 6 && plan.maximumSegments === 20);
  assert(plan.maximumAud === 5 && plan.cumulativeMaximumAud === 20);
  assert(plan.attended === true && plan.signupEnabled === false);
  return { ...plan, deadline: until };
}

function assertSafeConfig(c) {
  assert(c.disable_signup === true && c.sms_autoconfirm === false);
  assert(c.sms_otp_length === 6 && c.sms_otp_exp === 300);
  assert(Number(c.sms_max_frequency) >= 60);
  assert(
    Number(c.rate_limit_sms_sent) > 0 && Number(c.rate_limit_sms_sent) <= 6,
  );
  assert(!String(c.sms_test_otp ?? "").trim());
}

/** Independent provider closure, including a manual stop marker or changed
 * safety setting. App expiry remains a separate defence. A host/network outage
 * can prevent remote closure; never label an unverified shutdown successful. */
export async function watchPhoneWindow(plan, api, options = {}) {
  const now = options.now ?? Date.now;
  const wait =
    options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const p = validatePhoneWindow(plan, now());
  const project = await api.project(p.projectRef);
  assert(
    project.id === p.projectRef && project.organization_id === p.organizationId,
  );
  assert(project.status === "ACTIVE_HEALTHY");
  let armed = false,
    failure = false,
    reason = "expiry",
    closureVerified = false;
  try {
    const initial = await api.config(p.projectRef);
    assertSafeConfig(initial);
    assert(
      initial.external_phone_enabled === false,
      "Provider must be OFF before arming",
    );
    armed = true;
    await options.onReady?.();
    while (now() < p.deadline) {
      if (await options.stopRequested?.()) {
        reason = "manual-stop";
        break;
      }
      const c = await api.config(p.projectRef);
      assertSafeConfig(c);
      await wait(Math.min(15000, p.deadline - now()));
    }
  } catch {
    failure = true;
    reason = "safety-check-failed";
  } finally {
    // Project identity was independently checked before any PATCH. The only
    // permitted payload preserves signup, credentials and all unrelated settings.
    for (let attempt = 0; attempt < 3 && !closureVerified; attempt++) {
      try {
        await api.disable(p.projectRef, { external_phone_enabled: false });
        const final = await api.config(p.projectRef);
        closureVerified = final.external_phone_enabled === false;
        if (final.disable_signup !== true) failure = true;
      } catch {
        /* Redacted; closure must still be retried and read back. */
      }
      if (!closureVerified && attempt < 2) await wait(1000);
    }
  }
  const report = {
    armed,
    reason,
    closureVerified,
    safetyFailure: failure,
    enabledProvider: false,
    smsSent: 0,
    signupChanged: false,
  };
  if (!closureVerified)
    throw Error(
      "PHONE_CLOSURE_UNVERIFIED: use the provider console immediately",
    );
  return report;
}
