import Link from "next/link";
import policies from "../../../config/beta-policy-content.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Restricted beta policies",
  robots: { index: false, follow: false },
};

export default function BetaPolicies() {
  return (
    <main className="page-shell">
      <h1>Restricted beta policies</h1>
      <p>
        Version {policies.version}. The owner approved these exact documents
        subject to their unresolved requirements. Historical draft labels are
        preserved in the approved text. Previous research and betting product
        references are historical; the current product is fantasy sports cards.
        External admission is still closed.
      </p>
      <p>
        Australia only, aged 18+, invitation-only and free. Beta cards and
        points have no monetary value.
      </p>
      <nav aria-label="Beta policy documents">
        <ul>
          {policies.documents.map((doc) => (
            <li key={doc.id}>
              <Link href={`#${doc.id}`}>{doc.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
      {policies.documents.map((doc) => (
        <section id={doc.id} key={doc.id}>
          <h2>{doc.title}</h2>
          <p>Approved version: {policies.version}</p>
          <div
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              lineHeight: 1.65,
            }}
          >
            {doc.text}
          </div>
        </section>
      ))}
      <p>
        Support and privacy:{" "}
        <a href="mailto:support@docked.com.au">support@docked.com.au</a>
      </p>
    </main>
  );
}
