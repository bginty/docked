import { notFound, redirect } from "next/navigation";
import { assertPrivatePreview } from "@/core/private-preview.mjs";
import { previewOwnerMatches } from "@/core/preview-owner";
import { authClient } from "@/server/auth";
export default async function PreviewOwnerReady() {
  if (!assertPrivatePreview(process.env)) notFound();
  const client = (await authClient())!;
  const { data, error } = await client.auth.getUser();
  if (error || !previewOwnerMatches(data.user, process.env))
    redirect("/app/login");
  const { data: assurance } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa");
  return (
    <section className="app-panel">
      <h1>Owner MFA verified</h1>
      <p>Your authenticator is ready for this private Preview account.</p>
      <p>
        Return to the deployment conversation to continue Barry and Luke’s
        access setup. Gameplay and invitations remain closed until their
        separate checks pass.
      </p>
    </section>
  );
}
