import Link from "next/link";
import { AppIcon, type AppIconName } from "./app-icon";
import type { ReactNode } from "react";

/** Standalone navigation only. Actions and disclosures retain button/summary semantics. */
export function NavigationShortcut({
  href,
  icon = "feed",
  children,
  compact = false,
  onClick,
}: {
  href: string;
  icon?: AppIconName;
  children: ReactNode;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`navigation-shortcut${compact ? " navigation-shortcut-compact" : ""}`}
    >
      <span className="navigation-shortcut-icon" aria-hidden="true">
        <AppIcon name={icon} />
      </span>
      <span>{children}</span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
