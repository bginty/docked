export const adminRoles = [
  "owner",
  "admin",
  "analyst",
  "editor",
  "auditor",
] as const;
export type AdminRole = (typeof adminRoles)[number];
const review: readonly AdminRole[] = ["owner", "admin", "auditor"];
const community: readonly AdminRole[] = ["owner", "admin", "editor", "auditor"];
export const adminNavigation = [
  { id: "dashboard", label: "Dashboard", icon: "home", roles: adminRoles },
  { id: "users", label: "Users", icon: "users", roles: review },
  { id: "cards", label: "Cards & Inventory", icon: "cards", roles: review },
  { id: "packs", label: "Packs", icon: "pack", roles: review },
  { id: "marketplace", label: "Marketplace", icon: "market", roles: review },
  {
    id: "competitions",
    label: "Competitions",
    icon: "trophy",
    roles: adminRoles,
  },
  { id: "content", label: "Content & News", icon: "file", roles: community },
  { id: "moderation", label: "Moderation", icon: "shield", roles: community },
  {
    id: "payments",
    label: "Payments & Wallets",
    icon: "wallet",
    roles: ["owner"],
  },
  {
    id: "rewards",
    label: "Rewards & Credits",
    icon: "credits",
    roles: ["owner"],
  },
  { id: "analytics", label: "Analytics", icon: "chart", roles: review },
  {
    id: "communications",
    label: "Communications",
    icon: "message",
    roles: community,
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    roles: ["owner", "admin"],
  },
] as const;
export type AdminSection = (typeof adminNavigation)[number]["id"];
export function adminHref(id: AdminSection, role: string = "owner") {
  return id === "dashboard"
    ? role === "owner"
      ? "/admin/operations"
      : "/admin"
    : `/admin/workspace/${id}`;
}
export function canAccessAdminSection(role: string, id: string) {
  return adminNavigation.some(
    (item) =>
      item.id === id && (item.roles as readonly string[]).includes(role),
  );
}
export const adminSearchCategories = [
  "members",
  "cards",
  "packs",
  "transactions",
  "competitions",
  "moderation",
] as const;
export type AdminSearchCategory = (typeof adminSearchCategories)[number];
const categorySection: Record<AdminSearchCategory, AdminSection> = {
  members: "users",
  cards: "cards",
  packs: "packs",
  transactions: "payments",
  competitions: "competitions",
  moderation: "moderation",
};
export function permittedSearchCategories(role: string) {
  return adminSearchCategories.filter((category) =>
    canAccessAdminSection(role, categorySection[category]),
  );
}
export function searchDestination(category: AdminSearchCategory, id: string) {
  return `/admin/workspace/${categorySection[category]}?record=${encodeURIComponent(id)}&category=${category}`;
}
export type AdminSearchResult = {
  id: string;
  category: AdminSearchCategory;
  title: string;
  detail: string;
  href: string;
};
export type AdminSearchResponse = {
  query: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  results: AdminSearchResult[];
  categories: AdminSearchCategory[];
};
export function adminSearchInput(
  input: Record<string, string | undefined>,
  role: string,
) {
  const query = (input.q ?? "").trim();
  if (query.length > 120) throw Error("Search must be 120 characters or fewer");
  const page = Number(input.page ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 100)
    throw Error("Invalid search page");
  const permitted = permittedSearchCategories(role);
  if (!permitted.length) throw Error("Role denied");
  const category = input.category ?? "all";
  if (
    category !== "all" &&
    !permitted.includes(category as AdminSearchCategory)
  )
    throw Error("Category denied");
  return {
    query,
    page,
    pageSize: 20,
    categories:
      category === "all" ? permitted : [category as AdminSearchCategory],
    permitted,
  };
}
