import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adminNavigation,
  adminHref,
  adminSearchInput,
  canAccessAdminSection,
  permittedSearchCategories,
  searchDestination,
} from "../../src/core/admin-navigation";
import { adminWorkspaces } from "../../src/core/admin-workspaces";
test("administration has the exact navigation order and role-specific workspaces", () => {
  assert.deepEqual(
    adminNavigation.map((item) => item.label),
    [
      "Dashboard",
      "Users",
      "Cards & Inventory",
      "Packs",
      "Marketplace",
      "Competitions",
      "Content & News",
      "Moderation",
      "Payments & Wallets",
      "Rewards & Credits",
      "Analytics",
      "Communications",
      "Settings",
    ],
  );
  for (const item of adminNavigation)
    assert.ok(canAccessAdminSection("owner", item.id));
  assert.equal(adminHref("dashboard", "owner"), "/admin/operations");
  assert.equal(adminHref("dashboard", "editor"), "/admin");
  assert.deepEqual(permittedSearchCategories("analyst"), ["competitions"]);
  assert.deepEqual(permittedSearchCategories("editor"), [
    "competitions",
    "moderation",
  ]);
  for (const role of ["admin", "auditor", "analyst", "editor", "member", ""]) {
    assert.equal(canAccessAdminSection(role, "payments"), false);
    assert.equal(canAccessAdminSection(role, "rewards"), false);
    assert.throws(() =>
      adminSearchInput({ q: "private", category: "transactions" }, role),
    );
  }
  assert.equal(canAccessAdminSection("member", "users"), false);
  assert.equal(canAccessAdminSection("owner", "unknown"), false);
});
test("search is bounded and never accepts categories beyond the current role", () => {
  assert.equal(adminSearchInput({ q: "  name  " }, "owner").query, "name");
  for (const page of ["0", "101", "1.5", "NaN", "Infinity"])
    assert.throws(() => adminSearchInput({ page }, "owner"));
  assert.throws(() => adminSearchInput({ q: "x".repeat(121) }, "owner"));
  assert.throws(() => adminSearchInput({ category: "passwords" }, "owner"));
  assert.equal(
    searchDestination("cards", "a&b"),
    "/admin/workspace/cards?record=a%26b&category=cards",
  );
});
test("workspaces preserve activation boundaries and do not invent successful sends or grants", () => {
  for (const item of adminNavigation.filter(
    (item) => item.id !== "dashboard",
  )) {
    const workspace = adminWorkspaces[item.id as keyof typeof adminWorkspaces];
    assert.ok(
      workspace.description &&
        workspace.actions.length &&
        workspace.restrictions.length,
    );
    for (const action of workspace.actions)
      assert.ok(action.href.startsWith("/") && !action.href.startsWith("//"));
  }
  assert.match(
    adminWorkspaces.rewards.restrictions.join(" "),
    /No credits are issued/,
  );
  assert.match(
    adminWorkspaces.communications.restrictions.join(" "),
    /not activated/,
  );
});
