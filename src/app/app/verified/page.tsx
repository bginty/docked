import Link from "next/link";
import { appViewer } from "@/server/app-view";
import { redirect } from "next/navigation";
import { isEmailOwnershipVerified } from "@/core/auth-policy";
export default async function AppVerified() {
  const { who } = await appViewer();
  if (!who) redirect("/app/link-expired");
  if (!isEmailOwnershipVerified(who.user)) redirect("/app");
  return (
    <div className="app-auth-state">
      <h1>Email verified</h1>
      <p>You’re ready to continue setting up Docked.</p>
      <Link className="button" href="/app">
        Continue
      </Link>
    </div>
  );
}
