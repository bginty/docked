import test from "node:test";
import assert from "node:assert/strict";
import {
  moderationActions,
  filterModerationReports,
  type SocialReport,
} from "../../src/core/community-social";
import { readFileSync } from "node:fs";

test("moderation filters intersect and staff evidence stays behind the AAL2 server path", () => {
  const reports: SocialReport[] = [
    {
      id: "a",
      targetId: "a",
      targetType: "post",
      status: "open",
      reason: "spam",
      details: "",
      createdAt: "2026-10-16",
      reporter: { name: "Local Member", handle: "local" },
      target: { content: "Reported commentary", status: "visible" },
    },
    {
      id: "b",
      targetId: "b",
      targetType: "profile",
      status: "dismissed",
      reason: "spam",
      details: "",
      createdAt: "2026-10-16",
    },
  ];
  assert.deepEqual(
    filterModerationReports(reports, {
      status: "open",
      type: "post",
      search: " LOCAL ",
    }).map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    filterModerationReports(reports, {
      status: "dismissed",
      type: "post",
      search: "",
    }),
    [],
  );
  assert.equal(
    filterModerationReports(reports, {
      status: "",
      type: "",
      search: "commentary",
    }).length,
    1,
  );
  const server = readFileSync("src/server/community-social.ts", "utf8");
  const guarded = server.slice(
    server.indexOf("export async function communityModeration"),
    server.indexOf("export async function ownCommunityMedia"),
  );
  assert.ok(
    guarded.indexOf("await requireRole") <
      guarded.indexOf("tx.unsafe(moderationReportsQuery)"),
  );
  assert.match(
    readFileSync("src/server/auth.ts", "utf8"),
    /who.aal !== "aal2"/,
  );
  assert.doesNotMatch(
    readFileSync("src/app/api/community/route.ts", "utf8"),
    /communityModeration|moderationReportsQuery/,
  );
});

test("moderation offers only the existing server-authorised actions for each target", () => {
  assert.deepEqual(moderationActions("post"), [
    "remove",
    "dismiss",
    "warn",
    "escalate",
  ]);
  assert.deepEqual(moderationActions("comment"), moderationActions("post"));
  assert.deepEqual(moderationActions("profile"), [
    "warn",
    "restrict",
    "suspend",
    "restore",
    "dismiss",
    "escalate",
  ]);
  assert.deepEqual(moderationActions("media"), [
    "approve",
    "reject",
    "dismiss",
    "escalate",
  ]);
  for (const target of ["", "unknown", "constructor", "__proto__"])
    assert.deepEqual(moderationActions(target), []);
  assert.equal(moderationActions("post").includes("suspend"), false);
  assert.equal(moderationActions("profile").includes("remove"), false);
});
