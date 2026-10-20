"use client";
import { usePathname, useSearchParams } from "next/navigation";
export function WorkspacePageTitle({ fallback }: { fallback: string }) {
  const path = usePathname(),
    query = useSearchParams();
  if (path.startsWith("/fantasy/test-wallet"))
    return query.get("view") === "packs" ? "Packs" : "Test Wallet";
  if (path.startsWith("/fantasy/results")) return "Rankings";
  if (path.startsWith("/notifications")) return "Notifications";
  if (path.startsWith("/fantasy/announcements")) return "Announcements";
  return fallback;
}
