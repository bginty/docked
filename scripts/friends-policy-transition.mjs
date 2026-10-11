// Operator-only helper; caller supplies an enclosing transaction and its own
// release gate. Does not run on import, open admission or rewrite consent history.
import assert from "node:assert/strict";
import packet from "../config/friends-policy-content.json" with { type: "json" };
export async function transitionFriendsPolicy(tx, { actor, reason }) {
  assert.ok(typeof actor === "string" && actor.length >= 3);
  assert.ok(typeof reason === "string" && reason.length >= 20);
  await tx`select pg_advisory_xact_lock(71820341)`;
  const [gate] =
    await tx`select enabled from beta_private.friends_control where id for update`;
  assert.equal(
    gate.enabled,
    false,
    "Close friends admission before policy transition",
  );
  const [admission] =
    await tx`select policy_versions,testers_enabled from beta_private.admission_control where id for update`;
  assert.equal(
    admission.testers_enabled,
    false,
    "Close tester admission before policy transition",
  );
  const [game] =
    await tx`select terms_version,privacy_version from beta_fantasy.settings for update`;
  assert.equal(
    admission.policy_versions.terms,
    game.terms_version,
    "Existing policy stores disagree",
  );
  assert.equal(
    admission.policy_versions.privacy,
    game.privacy_version,
    "Existing policy stores disagree",
  );
  const versions = Object.fromEntries(
    [
      "terms",
      "privacy",
      "beta",
      "community",
      "fantasy",
      "competition",
      "responsible_gambling",
    ].map((key) => [key, packet.version]),
  );
  if (
    Object.keys(admission.policy_versions).length ===
      Object.keys(versions).length &&
    Object.entries(versions).every(
      ([key, value]) => admission.policy_versions[key] === value,
    )
  )
    return { changed: false, versions };
  await tx`update beta_private.admission_control set policy_versions=${tx.json(versions)} where id`;
  await tx`update beta_fantasy.settings set terms_version=${packet.version},privacy_version=${packet.version}`;
  await tx`insert into beta_private.audit_events(actor,action,subject,details) values(${actor},'friends_policy_transition',${packet.version},${tx.json({ reason, previous: admission.policy_versions, resulting: versions, packetDigest: packet.packetDigest })})`;
  return { changed: true, versions };
}
