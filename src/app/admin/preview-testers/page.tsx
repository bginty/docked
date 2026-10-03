import Link from "next/link";
import { requireRole } from "@/server/auth";
import { previewTesterAdministration } from "@/server/preview-invitations";
import { PreviewTesterControls } from "@/components/preview-tester-controls";
import { PageHeading, Notice } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Preview testers",
  robots: { index: false, follow: false },
};
export default async function PreviewTesters() {
  let who, data;
  try {
    who = await requireRole(["owner", "admin", "auditor"]);
    data = await previewTesterAdministration();
  } catch {
    return (
      <div className="page">
        <PageHeading eyebrow="RESTRICTED OPERATIONS" title="Preview testers" />
        <Notice>
          Docked Preview, an authorised staff role and MFA are required.
        </Notice>
        <Link href="/login">Sign in</Link>
      </div>
    );
  }
  const canEdit = who.role !== "auditor";
  return (
    <div className="page">
      <PageHeading
        eyebrow="ISOLATED PREVIEW OPERATIONS"
        title="Invited testers"
      />
      <Notice>
        Expiring Preview access only. This does not approve a legal region,
        enable official live Edges or grant staff privileges. Existing account
        legal acceptance still applies.
      </Notice>
      {canEdit && (
        <div className="grid two">
          <section className="card">
            <h2>Invite a new tester</h2>
            <p>
              Approve the exact recipient first. The private code confirms test
              access, not email ownership. Public registration stays closed.
            </p>
            <PreviewTesterControls action="invite" />
          </section>
          <section className="card">
            <h2>Approve an existing member</h2>
            <p>
              Community, profiles, isolated demo prices and the Preview Top
              Docked screen only. Genuine performance remains gated.
            </p>
            <PreviewTesterControls action="grant" />
          </section>
        </div>
      )}
      <h2>Tester grants</h2>
      {data.grants.length ? (
        data.grants.map((g) => (
          <section className="card" key={String(g.id)}>
            <h3>
              {g.handle
                ? `@${String(g.handle)}`
                : "Member awaiting public profile"}
            </h3>
            <p>
              Member: <code>{String(g.user_id)}</code>
            </p>
            <p>
              Status:{" "}
              {g.revoked_at
                ? "REVOKED"
                : new Date(String(g.expires_at)).getTime() > Date.now()
                  ? "ACTIVE"
                  : "EXPIRED"}{" "}
              · expires {new Date(String(g.expires_at)).toISOString()}
            </p>
            <p>{(g.capabilities as string[]).join(" · ")}</p>
            <p>{String(g.reason)}</p>
            {canEdit && !g.revoked_at && (
              <details>
                <summary>Revoke this grant</summary>
                <PreviewTesterControls
                  action="revoke_grant"
                  id={String(g.id)}
                />
              </details>
            )}
          </section>
        ))
      ) : (
        <p>No grants recorded.</p>
      )}
      <h2>Invitations</h2>
      {data.invitations.length ? (
        data.invitations.map((i) => (
          <section className="card" key={String(i.id)}>
            <h3>{String(i.status).toUpperCase()}</h3>
            <p>
              Reference: <code>{String(i.id)}</code>
            </p>
            <p>Expires {new Date(String(i.expires_at)).toISOString()}</p>
            <p>{String(i.reason)}</p>
            {canEdit && ["pending", "reserved"].includes(String(i.status)) && (
              <details>
                <summary>Revoke this invitation</summary>
                <PreviewTesterControls
                  action="revoke_invitation"
                  id={String(i.id)}
                />
              </details>
            )}
          </section>
        ))
      ) : (
        <p>No invitations recorded.</p>
      )}
      <Link href="/admin">Back to operations</Link>
    </div>
  );
}
