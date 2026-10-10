import Link from "next/link";
import { requireRole } from "@/server/auth";
import { AppAuthShell } from "@/components/app-auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Fantasy operations",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  try {
    await requireRole(["owner", "admin", "analyst", "editor", "auditor"]);
  } catch {
    return (
      <AppAuthShell>
        <h1>Verified staff access required</h1>
        <p>Assigned permissions and MFA are required.</p>
        <Link href="/app/login">Sign in</Link>
      </AppAuthShell>
    );
  }
  return (
    <AppAuthShell>
      <h1>Fantasy operations</h1>
      <nav aria-label="Operations">
        <p><Link href="/admin/operations">Owner dashboard</Link></p>
        <p><Link href="/admin/operations">Owner dashboard</Link></p>
        <p>
          <Link href="/fantasy/admin">Card and competition administration</Link>
        </p>
        <p>
          <Link href="/admin/community">Community moderation</Link>
        </p>
        <p>
          <Link href="/admin/analytics">Acquisition and retention</Link>
        </p>
      </nav>
      <p>
        Each workspace enforces its own permissions. Gameplay activation remains
        separately gated.
      </p>
    </AppAuthShell>
  );
}
