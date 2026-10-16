import type {
  AdminRole,
  AdminSection,
  AdminSearchCategory,
} from "./admin-navigation";
export type WorkspaceAction = {
  label: string;
  href: string;
  roles?: readonly AdminRole[];
};
export type AdminWorkspace = {
  description: string;
  category?: AdminSearchCategory;
  actions: WorkspaceAction[];
  restrictions: string[];
};
const owner: readonly AdminRole[] = ["owner"];
const review: readonly AdminRole[] = ["owner", "admin", "auditor"];
export const adminWorkspaces: Record<
  Exclude<AdminSection, "dashboard">,
  AdminWorkspace
> = {
  users: {
    description:
      "Find member accounts and review admission and safety records.",
    category: "members",
    actions: [
      {
        label: "Invitations & admission",
        href: "/admin/preview-testers",
        roles: review,
      },
      {
        label: "Member integrity",
        href: "/admin/community/integrity",
        roles: review,
      },
    ],
    restrictions: [
      "Role changes and support-case management do not have an approved self-service workflow. Existing admission controls and moderation permissions remain authoritative.",
    ],
  },
  cards: {
    description: "Search issued cards and inspect permanent edition supply.",
    category: "cards",
    actions: [
      {
        label: "Inventory & supply report",
        href: "/admin/operations#owner-economy",
        roles: owner,
      },
      {
        label: "Export inventory",
        href: "/api/admin/operations?scope=beta&format=csv",
        roles: owner,
      },
    ],
    restrictions: [
      "Ownership and supply are immutable operational records. Arbitrary minting, ownership reassignment and scarcity editing are unavailable.",
    ],
  },
  packs: {
    description:
      "Inspect purchased packs, configurations and issuance evidence.",
    category: "packs",
    actions: [
      {
        label: "Pack activity & exceptions",
        href: "/admin/operations#owner-activity",
        roles: owner,
      },
      {
        label: "Current pack catalogue",
        href: "/fantasy/test-wallet?view=packs",
      },
    ],
    restrictions: [
      "Hosted pack pricing, probabilities and availability changes require the existing reviewed configuration release. This workspace does not activate or rewrite pack products.",
    ],
  },
  marketplace: {
    description:
      "Review market activity and route suspicious behaviour to moderation.",
    actions: [
      { label: "Marketplace", href: "/fantasy/market" },
      {
        label: "Reports & moderation",
        href: "/admin/community/reports",
        roles: review,
      },
      {
        label: "Economy report",
        href: "/admin/operations#owner-economy",
        roles: owner,
      },
    ],
    restrictions: [
      "Hosted settlement and unrestricted trading remain gated. Dispute resolution and financial corrections require an approved auditable workflow; no direct balance or ownership edits are offered.",
    ],
  },
  competitions: {
    description:
      "Find competition schedules and review existing standings and scoring operations.",
    category: "competitions",
    actions: [
      { label: "Standings & results", href: "/fantasy/results" },
      {
        label: "Data & competition health",
        href: "/admin/operations#owner-data",
        roles: owner,
      },
      { label: "Scoring rules", href: "/fantasy/scoring" },
    ],
    restrictions: [
      "Scoring imports, finalisation and corrections retain their existing server-controlled policies. No ad-hoc statistics or result overrides are enabled here.",
    ],
  },
  content: {
    description:
      "Prepare editorial copy and review existing community publishing.",
    actions: [
      { label: "Community feed", href: "/fantasy/social" },
      { label: "Draft announcement", href: "/admin/workspace/communications" },
    ],
    restrictions: [
      "A separate hosted editorial approval/CMS workflow is not configured. Drafts cannot bypass community publishing rules or audience consent.",
    ],
  },
  moderation: {
    description:
      "Investigate reports, review evidence and apply permitted moderation actions.",
    category: "moderation",
    actions: [
      { label: "Reports & investigations", href: "/admin/community/reports" },
      { label: "Member integrity", href: "/admin/community/integrity" },
    ],
    restrictions: [
      "Existing moderator roles, MFA, target-specific actions and audit history apply. A dedicated appeals intake and retention policy remain pending owner approval.",
    ],
  },
  payments: {
    description:
      "Inspect the existing test-credit ledger and operational reconciliation.",
    category: "transactions",
    actions: [
      {
        label: "Wallet & reconciliation",
        href: "/admin/operations#owner-economy",
        roles: owner,
      },
      {
        label: "Withdrawal operations",
        href: "/admin/redemptions",
        roles: owner,
      },
    ],
    restrictions: [
      "Real payments, cash redemption and bank settlement remain disabled. Test credits have no cash value. No provider token, bank detail or raw member ledger is exposed in global search.",
    ],
  },
  rewards: {
    description:
      "Review approved reward entitlements and credit issuance controls.",
    actions: [
      {
        label: "Reward job health",
        href: "/admin/operations#owner-data",
        roles: owner,
      },
      {
        label: "Credit ledger search",
        href: "/admin/workspace/payments",
        roles: owner,
      },
    ],
    restrictions: [
      "Owner-only beta-credit requests can be saved and reviewed with recipient, amount, reason and confirmation. Approval records a request decision only; hosted discretionary issuance remains disabled. Existing local-preview allocation is not hosted authorisation. No credits are issued from this page.",
      "Weekly reward activation remains subject to its existing environment and approval gates.",
    ],
  },
  analytics: {
    description:
      "Inspect authoritative operations and consent-based engagement measurements.",
    actions: [
      { label: "Executive reports", href: "/admin/operations", roles: owner },
      {
        label: "Acquisition & retention",
        href: "/admin/analytics",
        roles: review,
      },
      {
        label: "Social analytics",
        href: "/admin/community/analytics",
        roles: review,
      },
    ],
    restrictions: [
      "Unavailable retention or conversion measurements remain unavailable; beta credits are never reported as settled AUD revenue.",
    ],
  },
  communications: {
    description:
      "Save announcement drafts for staff review, and inspect existing in-app notification delivery.",
    actions: [
      {
        label: "Notification delivery",
        href: "/admin/community/notifications",
        roles: review,
      },
      { label: "Community publishing", href: "/fantasy/social" },
    ],
    restrictions: [
      "Drafts are saved with version checks and an immutable staff review history. Approval does not send or publish them. Bulk delivery, external email and push are not activated; they require separate audience and delivery approval.",
    ],
  },
  settings: {
    description:
      "Review existing security, integration and operational configuration.",
    actions: [
      { label: "Account security & MFA", href: "/dashboard" },
      { label: "Preview admission", href: "/admin/preview-testers" },
      {
        label: "Integration health",
        href: "/admin/operations#owner-data",
        roles: owner,
      },
    ],
    restrictions: [
      "Staff roles, sensitive feature flags, provider credentials and maintenance controls are managed through reviewed operational changes. No generic super-admin or RLS bypass is provided.",
    ],
  },
};
