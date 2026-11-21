import { ownerMarketplace } from "@/server/owner-marketplace";
import { OwnerMarketplace } from "@/components/owner-marketplace";
import { AdminShell } from "@/components/admin-shell";
import { requireRole } from "@/server/auth";
import { notFound } from "next/navigation";
import "../../owner-marketplace.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Marketplace controls",
  robots: { index: false, follow: false },
};
export default async function MarketplaceAdmin() {
  try {
    await requireRole(["owner"]);
  } catch {
    notFound();
  }
  if (
    process.env.DOCKED_BETA_STAGING !== "true" &&
    process.env.DOCKED_COMMERCIAL_MARKETPLACE === "true"
  )
    return (
      <AdminShell role="owner" displayName="Owner" active="marketplace">
        <h1>Commercial Marketplace oversight</h1>
        <p>
          Review customer restrictions and payment or refund issues in
          Commercial operations.
        </p>
        <a href="/admin/operations">Commercial operations</a>
      </AdminShell>
    );
  if (process.env.DOCKED_BETA_STAGING !== "true")
    return (
      <AdminShell role="owner" displayName="Owner" active="marketplace">
        <h1>Marketplace is disabled</h1>
        <p>
          Buying, selling and swaps remain unavailable. Commercial payment, pack
          and customer support are available from Commercial operations.
        </p>
      </AdminShell>
    );
  try {
    return (
      <AdminShell role="owner" displayName="Owner" active="marketplace">
        <OwnerMarketplace initial={await ownerMarketplace()} />
      </AdminShell>
    );
  } catch {
    return (
      <AdminShell role="owner" displayName="Owner" active="marketplace">
        <h1>Marketplace controls unavailable</h1>
        <p>
          No control or balance has been changed. Check the release migration
          and reload.
        </p>
      </AdminShell>
    );
  }
}
