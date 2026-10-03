import type { ReactNode } from "react";
export type AppIconName =
  | "home"
  | "feed"
  | "points"
  | "edge"
  | "plus"
  | "community"
  | "profile"
  | "bell"
  | "search"
  | "heart"
  | "comment"
  | "save"
  | "share"
  | "shield"
  | "trophy"
  | "settings"
  | "arrow";
const paths: Record<AppIconName, ReactNode> = {
  feed: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  points: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 6 1.9 3.8 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6Z" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  edge: (
    <>
      <path d="m4 17 6-7 4 3 6-9" />
      <path d="M14 4h6v6M4 21h16" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  community: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v3" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  bell: (
    <>
      <path d="M5 16V9a7 7 0 0 1 14 0v7l2 2H3Z" />
      <path d="M9 21h6" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  heart: <path d="M12 20 3 11C-2 3 8-1 12 6c4-7 14-3 9 5Z" />,
  comment: <path d="M3 3h18v14H9l-6 4Z" />,
  save: <path d="M5 3h14v18l-7-5-7 5Z" />,
  share: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 12v9h16v-9" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
      <path d="m8 11 3 3 5-6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v8a5 5 0 0 1-10 0ZM12 16v5M7 21h10M7 5H3v4a4 4 0 0 0 4 4M17 5h4v4a4 4 0 0 1-4 4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
};
export function AppIcon({
  name,
  size = 22,
}: {
  name: AppIconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
